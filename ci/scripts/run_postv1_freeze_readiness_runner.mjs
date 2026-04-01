import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const thisFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(thisFile), "..", "..");
const outputPath = path.join(repoRoot, "docs", "releases", "V1_FREEZE_READINESS.json");

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const json = JSON.stringify(value, null, 2) + "\n";
  fs.writeFileSync(filePath, json, "utf8");
}

function runCheck(checkId, relativeScriptPath, extraArgs = []) {
  const scriptPath = path.join(repoRoot, relativeScriptPath);

  if (!fs.existsSync(scriptPath)) {
    return {
      check_id: checkId,
      script: normalizePath(relativeScriptPath),
      ok: false,
      exit_code: null,
      error: "missing_script",
    };
  }

  const result = spawnSync(process.execPath, [scriptPath, ...extraArgs], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  return {
    check_id: checkId,
    script: normalizePath(relativeScriptPath),
    ok: result.status === 0,
    exit_code: result.status,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

const checks = [
  runCheck(
    "freeze_evidence_manifest",
    "ci/scripts/run_postv1_freeze_evidence_manifest_verifier.mjs"
  ),
];

const ok = checks.every((check) => check.ok === true);

const readiness = {
  ok,
  release_id: "V1",
  phase: "freeze",
  checks: checks.map((check) => ({
    check_id: check.check_id,
    script: check.script,
    ok: check.ok,
    exit_code: check.exit_code,
  })),
};

writeJson(outputPath, readiness);
process.stdout.write(JSON.stringify(readiness, null, 2) + "\n");
process.exit(ok ? 0 : 1);