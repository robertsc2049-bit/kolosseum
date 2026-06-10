import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const FAILURE = {
  BOUNDARY_SOURCE_UNPARSEABLE: "boundary_source_unparseable",
  BOUNDARY_INVALID_DECLARATION: "boundary_invalid_declaration",
  BOUNDARY_CHECK_PATH_MISSING: "boundary_check_path_missing",
  BOUNDARY_CHECK_EXECUTION_FAILED: "boundary_check_execution_failed",
  BOUNDARY_CHECK_OUTPUT_INVALID: "boundary_check_output_invalid",
  BOUNDARY_CHECK_REPORTED_FAILURE: "boundary_check_reported_failure",
};

function normalizeRelativePath(value) {
  return String(value).replace(/\\/g, "/");
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readUtf8(filePath));
}

function createFailure(token, filePath, details, checkId = null) {
  return {
    token,
    path: normalizeRelativePath(filePath),
    details,
    ...(checkId ? { check_id: checkId } : {}),
  };
}

function resolveDeclaredPath(repoRoot, boundaryDirAbs, rawPath) {
  const normalizedRaw = normalizeRelativePath(rawPath).replace(/^\.\/+/, "");

  const repoCandidateAbs = path.resolve(repoRoot, normalizedRaw);
  if (fs.existsSync(repoCandidateAbs)) {
    return {
      repoRelative: normalizeRelativePath(path.relative(repoRoot, repoCandidateAbs)),
      absolute: repoCandidateAbs,
    };
  }

  const boundaryCandidateAbs = path.resolve(boundaryDirAbs, normalizedRaw);
  if (fs.existsSync(boundaryCandidateAbs)) {
    return {
      repoRelative: normalizeRelativePath(path.relative(repoRoot, boundaryCandidateAbs)),
      absolute: boundaryCandidateAbs,
    };
  }

  return {
    repoRelative: normalizedRaw,
    absolute: path.resolve(repoRoot, normalizedRaw),
  };
}

function loadBoundaryDeclaration(repoRoot, boundaryPath) {
  const boundaryAbs = path.resolve(repoRoot, boundaryPath);
  const boundaryDirAbs = path.dirname(boundaryAbs);
  const boundaryJson = readJson(boundaryAbs);

  if (!boundaryJson || typeof boundaryJson !== "object" || Array.isArray(boundaryJson)) {
    throw new Error("Boundary declaration must be a JSON object.");
  }

  if (!Array.isArray(boundaryJson.checks)) {
    throw new Error("Boundary declaration must contain a checks array.");
  }

  const checks = boundaryJson.checks.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Boundary check at index ${index} must be an object.`);
    }

    if (typeof item.check_id !== "string" || item.check_id.trim().length === 0) {
      throw new Error(`Boundary check at index ${index} must declare a non-empty check_id.`);
    }

    if (typeof item.script_path !== "string" || item.script_path.trim().length === 0) {
      throw new Error(`Boundary check '${item.check_id}' must declare a non-empty script_path.`);
    }

    if ("args" in item && !Array.isArray(item.args)) {
      throw new Error(`Boundary check '${item.check_id}' args must be an array when present.`);
    }

    const resolved = resolveDeclaredPath(repoRoot, boundaryDirAbs, item.script_path);

    return {
      checkId: item.check_id.trim(),
      scriptPath: resolved.repoRelative,
      scriptAbsolute: resolved.absolute,
      args: Array.isArray(item.args) ? item.args.map((value) => String(value)) : [],
    };
  });

  return {
    boundaryId:
      typeof boundaryJson.boundary_id === "string" && boundaryJson.boundary_id.trim().length > 0
        ? boundaryJson.boundary_id.trim()
        : null,
    checks,
  };
}

function runDeclaredCheck(repoRoot, check) {
  const result = spawnSync(process.execPath, [check.scriptAbsolute, ...check.args], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";

  return {
    status: result.status ?? 1,
    stdout,
    stderr,
  };
}

function verifyFinalAcceptanceBoundary({
  repoRoot,
  boundaryPath,
}) {
  const failures = [];
  const executedChecks = [];
  const boundaryAbs = path.resolve(repoRoot, boundaryPath);
  const boundaryRepoRelative = normalizeRelativePath(path.relative(repoRoot, boundaryAbs));

  let boundary;
  try {
    boundary = loadBoundaryDeclaration(repoRoot, boundaryPath);
  } catch (error) {
    return {
      ok: false,
      executed_checks: [],
      failures: [
        createFailure(
          FAILURE.BOUNDARY_SOURCE_UNPARSEABLE,
          boundaryRepoRelative,
          error instanceof Error ? error.message : String(error)
        ),
      ],
    };
  }

  if (!boundary.boundaryId) {
    failures.push(
      createFailure(
        FAILURE.BOUNDARY_INVALID_DECLARATION,
        boundaryRepoRelative,
        "Boundary declaration must declare a non-empty boundary_id."
      )
    );
  }

  const seenCheckIds = new Set();
  for (const check of boundary.checks) {
    if (seenCheckIds.has(check.checkId)) {
      failures.push(
        createFailure(
          FAILURE.BOUNDARY_INVALID_DECLARATION,
          boundaryRepoRelative,
          `Duplicate boundary check_id '${check.checkId}' is not permitted.`,
          check.checkId
        )
      );
      continue;
    }
    seenCheckIds.add(check.checkId);

    if (!fs.existsSync(check.scriptAbsolute)) {
      failures.push(
        createFailure(
          FAILURE.BOUNDARY_CHECK_PATH_MISSING,
          check.scriptPath,
          `Declared boundary check '${check.checkId}' script does not exist.`,
          check.checkId
        )
      );
    }
  }

  if (failures.length > 0) {
    return {
      ok: false,
      boundary_id: boundary.boundaryId,
      executed_checks: [],
      failures,
    };
  }

  for (const check of boundary.checks) {
    const execution = runDeclaredCheck(repoRoot, check);
    const executionRecord = {
      check_id: check.checkId,
      script_path: check.scriptPath,
      args: check.args,
      status: execution.status,
    };

    if (execution.status !== 0) {
      executedChecks.push(executionRecord);
      failures.push(
        createFailure(
          FAILURE.BOUNDARY_CHECK_EXECUTION_FAILED,
          check.scriptPath,
          execution.stderr || execution.stdout || `Declared check '${check.checkId}' exited non-zero.`,
          check.checkId
        )
      );
      return {
        ok: false,
        boundary_id: boundary.boundaryId,
        executed_checks: executedChecks,
        failures,
      };
    }

    let report;
    try {
      report = JSON.parse(execution.stdout);
    } catch (error) {
      executedChecks.push(executionRecord);
      failures.push(
        createFailure(
          FAILURE.BOUNDARY_CHECK_OUTPUT_INVALID,
          check.scriptPath,
          `Declared check '${check.checkId}' did not emit valid JSON. ${error instanceof Error ? error.message : String(error)}`,
          check.checkId
        )
      );
      return {
        ok: false,
        boundary_id: boundary.boundaryId,
        executed_checks: executedChecks,
        failures,
      };
    }

    if (!report || typeof report !== "object" || report.ok !== true) {
      executedChecks.push(executionRecord);
      failures.push(
        createFailure(
          FAILURE.BOUNDARY_CHECK_REPORTED_FAILURE,
          check.scriptPath,
          `Declared check '${check.checkId}' reported failure.`,
          check.checkId
        )
      );
      return {
        ok: false,
        boundary_id: boundary.boundaryId,
        executed_checks: executedChecks,
        failures,
      };
    }

    executedChecks.push({
      ...executionRecord,
      ok: true,
    });
  }

  return {
    ok: true,
    boundary_id: boundary.boundaryId,
    executed_checks: executedChecks,
    failures: [],
  };
}

function main() {
  const repoRoot = process.cwd();
  const boundaryPath = process.argv[2] ?? "docs/releases/V1_FINAL_ACCEPTANCE_BOUNDARY.json";

  const report = verifyFinalAcceptanceBoundary({
    repoRoot,
    boundaryPath,
  });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.ok ? 0 : 1;
}

try {
  main();
} catch (error) {
  const boundaryPath = process.argv[2] ?? "docs/releases/V1_FINAL_ACCEPTANCE_BOUNDARY.json";
  const report = {
    ok: false,
    executed_checks: [],
    failures: [
      createFailure(
        FAILURE.BOUNDARY_SOURCE_UNPARSEABLE,
        normalizeRelativePath(boundaryPath),
        error instanceof Error ? error.message : String(error)
      ),
    ],
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}