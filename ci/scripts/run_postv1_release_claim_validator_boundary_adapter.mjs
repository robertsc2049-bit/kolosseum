import path from "node:path";
import { spawnSync } from "node:child_process";

const FAILURE = {
  RELEASE_CLAIM_ADAPTER_EXECUTION_FAILED: "release_claim_adapter_execution_failed",
  RELEASE_CLAIM_ADAPTER_REPORTED_FAILURE: "release_claim_adapter_reported_failure",
};

function normalizeRelativePath(value) {
  return String(value).replace(/\\/g, "/");
}

function createFailure(token, filePath, details) {
  return {
    token,
    path: normalizeRelativePath(filePath),
    details,
  };
}

function main() {
  const repoRoot = process.cwd();
  const targetScript = path.resolve(repoRoot, "ci/scripts/run_release_claim_validator.mjs");

  const result = spawnSync(process.execPath, [targetScript], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";

  if ((result.status ?? 1) !== 0) {
    const report = {
      ok: false,
      failures: [
        createFailure(
          FAILURE.RELEASE_CLAIM_ADAPTER_EXECUTION_FAILED,
          "ci/scripts/run_release_claim_validator.mjs",
          stderr || stdout || "Release claim validator exited non-zero."
        ),
      ],
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  if (/^RELEASE_CLAIM_VALIDATOR_OK$/m.test(stdout)) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, failures: [] }, null, 2)}\n`
    );
    process.exitCode = 0;
    return;
  }

  const report = {
    ok: false,
    failures: [
      createFailure(
        FAILURE.RELEASE_CLAIM_ADAPTER_REPORTED_FAILURE,
        "ci/scripts/run_release_claim_validator.mjs",
        stdout || "Release claim validator did not report the expected success token."
      ),
    ],
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}

main();