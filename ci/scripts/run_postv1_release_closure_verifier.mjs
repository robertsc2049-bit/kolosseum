import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const FAILURE = {
  CLOSURE_SOURCE_UNPARSEABLE: "closure_source_unparseable",
  CLOSURE_INVALID_DECLARATION: "closure_invalid_declaration",
  CLOSURE_NOT_ON_MAIN: "closure_not_on_main",
  CLOSURE_WORKTREE_DIRTY: "closure_worktree_dirty",
  CLOSURE_DECLARED_PATH_MISSING: "closure_declared_path_missing",
  CLOSURE_CHECK_EXECUTION_FAILED: "closure_check_execution_failed",
  CLOSURE_CHECK_OUTPUT_INVALID: "closure_check_output_invalid",
  CLOSURE_CHECK_REPORTED_FAILURE: "closure_check_reported_failure",
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

function runCommand(binary, args, options = {}) {
  const normalizedBinary = String(binary);
  const invocation =
    normalizedBinary.endsWith(".mjs") ||
    normalizedBinary.endsWith(".js") ||
    normalizedBinary.endsWith(".cjs")
      ? {
          command: process.execPath,
          args: [normalizedBinary, ...args],
        }
      : {
          command: normalizedBinary,
          args,
        };

  return spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
  });
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

function loadClosureDeclaration(repoRoot, declarationPath) {
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationDirAbs = path.dirname(declarationAbs);
  const declarationJson = readJson(declarationAbs);

  if (!declarationJson || typeof declarationJson !== "object" || Array.isArray(declarationJson)) {
    throw new Error("Release closure declaration must be a JSON object.");
  }

  if (typeof declarationJson.closure_id !== "string" || declarationJson.closure_id.trim().length === 0) {
    throw new Error("Release closure declaration must declare a non-empty closure_id.");
  }

  if (!Array.isArray(declarationJson.required_release_surfaces)) {
    throw new Error("Release closure declaration must contain a required_release_surfaces array.");
  }

  if (!Array.isArray(declarationJson.post_merge_checks)) {
    throw new Error("Release closure declaration must contain a post_merge_checks array.");
  }

  const requiredReleaseSurfaces = declarationJson.required_release_surfaces.map((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error(`Release closure required_release_surfaces[${index}] must be a non-empty string.`);
    }

    const resolved = resolveDeclaredPath(repoRoot, declarationDirAbs, item);

    return {
      path: resolved.repoRelative,
      absolute: resolved.absolute,
    };
  });

  const postMergeChecks = declarationJson.post_merge_checks.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Release closure post_merge_checks[${index}] must be an object.`);
    }

    if (typeof item.check_id !== "string" || item.check_id.trim().length === 0) {
      throw new Error(`Release closure post_merge_checks[${index}] must declare a non-empty check_id.`);
    }

    if (typeof item.script_path !== "string" || item.script_path.trim().length === 0) {
      throw new Error(`Release closure check '${item.check_id}' must declare a non-empty script_path.`);
    }

    if ("args" in item && !Array.isArray(item.args)) {
      throw new Error(`Release closure check '${item.check_id}' args must be an array when present.`);
    }

    const resolved = resolveDeclaredPath(repoRoot, declarationDirAbs, item.script_path);

    return {
      checkId: item.check_id.trim(),
      scriptPath: resolved.repoRelative,
      scriptAbsolute: resolved.absolute,
      args: Array.isArray(item.args) ? item.args.map((value) => String(value)) : [],
    };
  });

  return {
    closureId: declarationJson.closure_id.trim(),
    requiredReleaseSurfaces,
    postMergeChecks,
  };
}

function runGit(repoRoot, args) {
  const gitBin = process.env.KOLOSSEUM_GIT_BIN || "git";
  const result = runCommand(gitBin, args, {
    cwd: repoRoot,
    env: process.env,
  });

  return {
    status: result.status ?? 1,
    stdout: typeof result.stdout === "string" ? result.stdout.trim() : "",
    stderr: typeof result.stderr === "string" ? result.stderr.trim() : "",
    error: result.error ? String(result.error.message || result.error) : "",
  };
}

function runDeclaredCheck(repoRoot, check) {
  const result = runCommand(check.scriptAbsolute, check.args, {
    cwd: repoRoot,
    env: process.env,
  });

  return {
    status: result.status ?? 1,
    stdout: typeof result.stdout === "string" ? result.stdout.trim() : "",
    stderr: typeof result.stderr === "string" ? result.stderr.trim() : "",
    error: result.error ? String(result.error.message || result.error) : "",
  };
}

function verifyReleaseClosure({ repoRoot, declarationPath }) {
  const failures = [];
  const declarationAbs = path.resolve(repoRoot, declarationPath);
  const declarationRepoRelative = normalizeRelativePath(path.relative(repoRoot, declarationAbs));

  let declaration;
  try {
    declaration = loadClosureDeclaration(repoRoot, declarationPath);
  } catch (error) {
    return {
      ok: false,
      executed_checks: [],
      failures: [
        createFailure(
          FAILURE.CLOSURE_SOURCE_UNPARSEABLE,
          declarationRepoRelative,
          error instanceof Error ? error.message : String(error)
        ),
      ],
    };
  }

  const seenSurfacePaths = new Set();
  for (const surface of declaration.requiredReleaseSurfaces) {
    if (seenSurfacePaths.has(surface.path)) {
      failures.push(
        createFailure(
          FAILURE.CLOSURE_INVALID_DECLARATION,
          declarationRepoRelative,
          `Duplicate required release surface '${surface.path}' is not permitted.`
        )
      );
      continue;
    }
    seenSurfacePaths.add(surface.path);

    if (!fs.existsSync(surface.absolute)) {
      failures.push(
        createFailure(
          FAILURE.CLOSURE_DECLARED_PATH_MISSING,
          surface.path,
          `Declared release surface '${surface.path}' does not exist on disk.`
        )
      );
    }
  }

  const seenCheckIds = new Set();
  for (const check of declaration.postMergeChecks) {
    if (seenCheckIds.has(check.checkId)) {
      failures.push(
        createFailure(
          FAILURE.CLOSURE_INVALID_DECLARATION,
          declarationRepoRelative,
          `Duplicate post-merge check '${check.checkId}' is not permitted.`,
          check.checkId
        )
      );
      continue;
    }
    seenCheckIds.add(check.checkId);

    if (!fs.existsSync(check.scriptAbsolute)) {
      failures.push(
        createFailure(
          FAILURE.CLOSURE_DECLARED_PATH_MISSING,
          check.scriptPath,
          `Declared post-merge check script '${check.checkId}' does not exist.`,
          check.checkId
        )
      );
    }
  }

  if (failures.length > 0) {
    return {
      ok: false,
      closure_id: declaration.closureId,
      executed_checks: [],
      failures,
    };
  }

  const branchResult = runGit(repoRoot, ["branch", "--show-current"]);
  if (branchResult.status !== 0) {
    return {
      ok: false,
      closure_id: declaration.closureId,
      executed_checks: [],
      failures: [
        createFailure(
          FAILURE.CLOSURE_NOT_ON_MAIN,
          declarationRepoRelative,
          branchResult.stderr || branchResult.error || "Failed to resolve current git branch."
        ),
      ],
    };
  }

  const currentBranch = branchResult.stdout;
  if (currentBranch !== "main") {
    return {
      ok: false,
      closure_id: declaration.closureId,
      current_branch: currentBranch,
      executed_checks: [],
      failures: [
        createFailure(
          FAILURE.CLOSURE_NOT_ON_MAIN,
          declarationRepoRelative,
          `Release closure verification must run on main; found '${currentBranch}'.`
        ),
      ],
    };
  }

  const statusResult = runGit(repoRoot, ["status", "--porcelain"]);
  if (statusResult.status !== 0) {
    return {
      ok: false,
      closure_id: declaration.closureId,
      current_branch: currentBranch,
      executed_checks: [],
      failures: [
        createFailure(
          FAILURE.CLOSURE_WORKTREE_DIRTY,
          declarationRepoRelative,
          statusResult.stderr || statusResult.error || "Failed to inspect git worktree state."
        ),
      ],
    };
  }

  if (statusResult.stdout.length > 0) {
    return {
      ok: false,
      closure_id: declaration.closureId,
      current_branch: currentBranch,
      executed_checks: [],
      failures: [
        createFailure(
          FAILURE.CLOSURE_WORKTREE_DIRTY,
          declarationRepoRelative,
          "Release closure verification requires a clean main worktree."
        ),
      ],
    };
  }

  const executedChecks = [];
  for (const check of declaration.postMergeChecks) {
    const execution = runDeclaredCheck(repoRoot, check);
    const executionRecord = {
      check_id: check.checkId,
      script_path: check.scriptPath,
      args: check.args,
      status: execution.status,
    };

    if (execution.status !== 0) {
      executedChecks.push(executionRecord);
      return {
        ok: false,
        closure_id: declaration.closureId,
        current_branch: currentBranch,
        executed_checks: executedChecks,
        failures: [
          createFailure(
            FAILURE.CLOSURE_CHECK_EXECUTION_FAILED,
            check.scriptPath,
            execution.stderr || execution.stdout || execution.error || `Post-merge check '${check.checkId}' exited non-zero.`,
            check.checkId
          ),
        ],
      };
    }

    let report;
    try {
      report = JSON.parse(execution.stdout);
    } catch (error) {
      executedChecks.push(executionRecord);
      return {
        ok: false,
        closure_id: declaration.closureId,
        current_branch: currentBranch,
        executed_checks: executedChecks,
        failures: [
          createFailure(
            FAILURE.CLOSURE_CHECK_OUTPUT_INVALID,
            check.scriptPath,
            `Post-merge check '${check.checkId}' did not emit valid JSON. ${error instanceof Error ? error.message : String(error)}`,
            check.checkId
          ),
        ],
      };
    }

    if (!report || typeof report !== "object" || report.ok !== true) {
      executedChecks.push(executionRecord);
      return {
        ok: false,
        closure_id: declaration.closureId,
        current_branch: currentBranch,
        executed_checks: executedChecks,
        failures: [
          createFailure(
            FAILURE.CLOSURE_CHECK_REPORTED_FAILURE,
            check.scriptPath,
            `Post-merge check '${check.checkId}' reported failure.`,
            check.checkId
          ),
        ],
      };
    }

    executedChecks.push({
      ...executionRecord,
      ok: true,
    });
  }

  return {
    ok: true,
    closure_id: declaration.closureId,
    current_branch: currentBranch,
    verified_release_surfaces: declaration.requiredReleaseSurfaces.map((item) => item.path),
    executed_checks: executedChecks,
    failures: [],
  };
}

function main() {
  const repoRoot = process.cwd();
  const declarationPath = process.argv[2] ?? "docs/releases/V1_RELEASE_CLOSURE.json";

  const report = verifyReleaseClosure({
    repoRoot,
    declarationPath,
  });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.ok ? 0 : 1;
}

try {
  main();
} catch (error) {
  const declarationPath = process.argv[2] ?? "docs/releases/V1_RELEASE_CLOSURE.json";
  const report = {
    ok: false,
    executed_checks: [],
    failures: [
      createFailure(
        FAILURE.CLOSURE_SOURCE_UNPARSEABLE,
        normalizeRelativePath(declarationPath),
        error instanceof Error ? error.message : String(error)
      ),
    ],
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}