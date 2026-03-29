import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const FAILURE = {
  READINESS_SOURCE_UNPARSEABLE: "readiness_source_unparseable",
  READINESS_INVALID_DECLARATION: "readiness_invalid_declaration",
  READINESS_PREREQ_PATH_MISSING: "readiness_prereq_path_missing",
  READINESS_PREREQ_EXECUTION_FAILED: "readiness_prereq_execution_failed",
  READINESS_PREREQ_OUTPUT_INVALID: "readiness_prereq_output_invalid",
  READINESS_PREREQ_REPORTED_FAILURE: "readiness_prereq_reported_failure",
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

function createFailure(token, filePath, details, prereqId = null) {
  return {
    token,
    path: normalizeRelativePath(filePath),
    details,
    ...(prereqId ? { prereq_id: prereqId } : {}),
  };
}

function resolveDeclaredPath(repoRoot, declarationDirAbs, rawPath) {
  const normalizedRaw = normalizeRelativePath(rawPath).replace(/^\.\/+/, "");

  const repoCandidateAbs = path.resolve(repoRoot, normalizedRaw);
  if (fs.existsSync(repoCandidateAbs)) {
    return {
      repoRelative: normalizeRelativePath(path.relative(repoRoot, repoCandidateAbs)),
      absolute: repoCandidateAbs,
    };
  }

  const declarationCandidateAbs = path.resolve(declarationDirAbs, normalizedRaw);
  if (fs.existsSync(declarationCandidateAbs)) {
    return {
      repoRelative: normalizeRelativePath(path.relative(repoRoot, declarationCandidateAbs)),
      absolute: declarationCandidateAbs,
    };
  }

  return {
    repoRelative: normalizedRaw,
    absolute: path.resolve(repoRoot, normalizedRaw),
  };
}

function loadReadinessDeclaration(repoRoot, declarationPath) {
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationDirAbs = path.dirname(declarationAbs);
  const declarationJson = readJson(declarationAbs);

  if (!declarationJson || typeof declarationJson !== "object" || Array.isArray(declarationJson)) {
    throw new Error("Promotion readiness declaration must be a JSON object.");
  }

  if (!Array.isArray(declarationJson.prerequisites)) {
    throw new Error("Promotion readiness declaration must contain a prerequisites array.");
  }

  const prerequisites = declarationJson.prerequisites.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Promotion readiness prerequisite at index ${index} must be an object.`);
    }

    if (typeof item.prereq_id !== "string" || item.prereq_id.trim().length === 0) {
      throw new Error(`Promotion readiness prerequisite at index ${index} must declare a non-empty prereq_id.`);
    }

    if (typeof item.script_path !== "string" || item.script_path.trim().length === 0) {
      throw new Error(`Promotion readiness prerequisite '${item.prereq_id}' must declare a non-empty script_path.`);
    }

    if ("args" in item && !Array.isArray(item.args)) {
      throw new Error(`Promotion readiness prerequisite '${item.prereq_id}' args must be an array when present.`);
    }

    const resolved = resolveDeclaredPath(repoRoot, declarationDirAbs, item.script_path);

    return {
      prereqId: item.prereq_id.trim(),
      scriptPath: resolved.repoRelative,
      scriptAbsolute: resolved.absolute,
      args: Array.isArray(item.args) ? item.args.map((value) => String(value)) : [],
    };
  });

  return {
    readinessId:
      typeof declarationJson.readiness_id === "string" && declarationJson.readiness_id.trim().length > 0
        ? declarationJson.readiness_id.trim()
        : null,
    prerequisites,
  };
}

function runDeclaredPrerequisite(repoRoot, prerequisite) {
  const result = spawnSync(process.execPath, [prerequisite.scriptAbsolute, ...prerequisite.args], {
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

function verifyPromotionReadiness({ repoRoot, declarationPath }) {
  const failures = [];
  const executedPrerequisites = [];
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationRepoRelative = normalizeRelativePath(path.relative(repoRoot, declarationAbs));

  let declaration;
  try {
    declaration = loadReadinessDeclaration(repoRoot, declarationPath);
  } catch (error) {
    return {
      ok: false,
      executed_prerequisites: [],
      failures: [
        createFailure(
          FAILURE.READINESS_SOURCE_UNPARSEABLE,
          declarationRepoRelative,
          error instanceof Error ? error.message : String(error)
        ),
      ],
    };
  }

  if (!declaration.readinessId) {
    failures.push(
      createFailure(
        FAILURE.READINESS_INVALID_DECLARATION,
        declarationRepoRelative,
        "Promotion readiness declaration must declare a non-empty readiness_id."
      )
    );
  }

  const seenPrereqIds = new Set();
  for (const prerequisite of declaration.prerequisites) {
    if (seenPrereqIds.has(prerequisite.prereqId)) {
      failures.push(
        createFailure(
          FAILURE.READINESS_INVALID_DECLARATION,
          declarationRepoRelative,
          `Duplicate promotion prerequisite '${prerequisite.prereqId}' is not permitted.`,
          prerequisite.prereqId
        )
      );
      continue;
    }
    seenPrereqIds.add(prerequisite.prereqId);

    if (!fs.existsSync(prerequisite.scriptAbsolute)) {
      failures.push(
        createFailure(
          FAILURE.READINESS_PREREQ_PATH_MISSING,
          prerequisite.scriptPath,
          `Declared promotion prerequisite '${prerequisite.prereqId}' script does not exist.`,
          prerequisite.prereqId
        )
      );
    }
  }

  if (failures.length > 0) {
    return {
      ok: false,
      readiness_id: declaration.readinessId,
      executed_prerequisites: [],
      failures,
    };
  }

  for (const prerequisite of declaration.prerequisites) {
    const execution = runDeclaredPrerequisite(repoRoot, prerequisite);
    const executionRecord = {
      prereq_id: prerequisite.prereqId,
      script_path: prerequisite.scriptPath,
      args: prerequisite.args,
      status: execution.status,
    };

    if (execution.status !== 0) {
      executedPrerequisites.push(executionRecord);
      failures.push(
        createFailure(
          FAILURE.READINESS_PREREQ_EXECUTION_FAILED,
          prerequisite.scriptPath,
          execution.stderr || execution.stdout || `Declared promotion prerequisite '${prerequisite.prereqId}' exited non-zero.`,
          prerequisite.prereqId
        )
      );
      return {
        ok: false,
        readiness_id: declaration.readinessId,
        executed_prerequisites: executedPrerequisites,
        failures,
      };
    }

    let report;
    try {
      report = JSON.parse(execution.stdout);
    } catch (error) {
      executedPrerequisites.push(executionRecord);
      failures.push(
        createFailure(
          FAILURE.READINESS_PREREQ_OUTPUT_INVALID,
          prerequisite.scriptPath,
          `Declared promotion prerequisite '${prerequisite.prereqId}' did not emit valid JSON. ${error instanceof Error ? error.message : String(error)}`,
          prerequisite.prereqId
        )
      );
      return {
        ok: false,
        readiness_id: declaration.readinessId,
        executed_prerequisites: executedPrerequisites,
        failures,
      };
    }

    if (!report || typeof report !== "object" || report.ok !== true) {
      executedPrerequisites.push(executionRecord);
      failures.push(
        createFailure(
          FAILURE.READINESS_PREREQ_REPORTED_FAILURE,
          prerequisite.scriptPath,
          `Declared promotion prerequisite '${prerequisite.prereqId}' reported failure.`,
          prerequisite.prereqId
        )
      );
      return {
        ok: false,
        readiness_id: declaration.readinessId,
        executed_prerequisites: executedPrerequisites,
        failures,
      };
    }

    executedPrerequisites.push({
      ...executionRecord,
      ok: true,
    });
  }

  return {
    ok: true,
    readiness_id: declaration.readinessId,
    executed_prerequisites: executedPrerequisites,
    failures: [],
  };
}

function main() {
  const repoRoot = process.cwd();
  const declarationPath = process.argv[2] ?? "docs/releases/V1_PROMOTION_READINESS.json";

  const report = verifyPromotionReadiness({
    repoRoot,
    declarationPath,
  });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.ok ? 0 : 1;
}

try {
  main();
} catch (error) {
  const declarationPath = process.argv[2] ?? "docs/releases/V1_PROMOTION_READINESS.json";
  const report = {
    ok: false,
    executed_prerequisites: [],
    failures: [
      createFailure(
        FAILURE.READINESS_SOURCE_UNPARSEABLE,
        normalizeRelativePath(declarationPath),
        error instanceof Error ? error.message : String(error)
      ),
    ],
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}