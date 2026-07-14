// DEV NOTE: BETA-28 production dependency vulnerability audit.
// High and critical production vulnerabilities fail closed.

import process from "node:process";

import {
  spawnSync
} from "node:child_process";

const isWindows =
  process.platform === "win32";

const command =
  isWindows
    ? (
        process.env.ComSpec ||
        "cmd.exe"
      )
    : "npm";

const args =
  isWindows
    ? [
        "/d",
        "/s",
        "/c",
        "npm.cmd audit --json --omit=dev --audit-level=high"
      ]
    : [
        "audit",
        "--json",
        "--omit=dev",
        "--audit-level=high"
      ];

const result =
  spawnSync(
    command,
    args,
    {
      encoding:
        "utf8",
      windowsHide:
        true,
      maxBuffer:
        20 * 1024 * 1024
    }
  );

if (result.error) {
  console.error(
    JSON.stringify({
      ok: false,
      failure_token:
        "beta28_dependency_audit_failed",
      reason:
        result.error.message
    })
  );

  process.exit(1);
}

const stdout =
  String(result.stdout ?? "");

const firstBrace =
  stdout.indexOf("{");

let report;

try {
  report =
    JSON.parse(
      firstBrace >= 0
        ? stdout.slice(firstBrace)
        : stdout
    );
}
catch {
  console.error(
    JSON.stringify({
      ok: false,
      failure_token:
        "beta28_dependency_audit_failed",
      reason:
        "audit_json_invalid"
    })
  );

  process.exit(1);
}

const vulnerabilities =
  report?.metadata
    ?.vulnerabilities ??
  {};

const high =
  Number(
    vulnerabilities.high ?? 0
  );

const critical =
  Number(
    vulnerabilities.critical ?? 0
  );

if (
  !Number.isFinite(high) ||
  !Number.isFinite(critical) ||
  high > 0 ||
  critical > 0 ||
  result.status !== 0
) {
  console.error(
    JSON.stringify({
      ok: false,
      failure_token:
        "beta28_dependency_audit_failed",
      high,
      critical,
      npm_exit_code:
        result.status
    })
  );

  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    guard:
      "BETA-28",
    audit:
      "production_dependencies",
    high,
    critical
  })
);
