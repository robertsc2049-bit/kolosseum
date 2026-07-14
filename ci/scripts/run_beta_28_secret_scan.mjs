// DEV NOTE: BETA-28 high-confidence tracked-file secret scan.
// Findings report only path, line and pattern id. Secret values are never printed.

import fs from "node:fs";
import path from "node:path";
import {
  spawnSync
} from "node:child_process";

const binaryExtensions =
  new Set([
    ".7z",
    ".bmp",
    ".doc",
    ".docx",
    ".gif",
    ".gz",
    ".ico",
    ".jpeg",
    ".jpg",
    ".lockb",
    ".mp3",
    ".mp4",
    ".pdf",
    ".png",
    ".ppt",
    ".pptx",
    ".tar",
    ".webp",
    ".woff",
    ".woff2",
    ".xls",
    ".xlsx",
    ".zip"
  ]);

const privateKeyHeader =
  [
    "-----BEGIN ",
    "(?:RSA|EC|OPENSSH|DSA|PGP) ",
    "PRIVATE KEY-----"
  ].join("");

const patterns = [
  {
    id:
      "private_key",
    regex:
      new RegExp(
        privateKeyHeader,
        "u"
      )
  },
  {
    id:
      "github_token",
    regex:
      /\bgh[pousr]_[A-Za-z0-9]{30,}\b/u
  },
  {
    id:
      "aws_access_key",
    regex:
      /\bAKIA[0-9A-Z]{16}\b/u
  },
  {
    id:
      "stripe_live_secret",
    regex:
      /\bsk_live_[A-Za-z0-9]{20,}\b/u
  },
  {
    id:
      "slack_token",
    regex:
      /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u
  }
];

function trackedFiles() {
  const result =
    spawnSync(
      "git",
      [
        "ls-files",
        "-z"
      ],
      {
        encoding:
          "utf8",
        windowsHide:
          true
      }
    );

  if (
    result.error ||
    result.status !== 0
  ) {
    throw new Error(
      "beta28_secret_scan_git_failed"
    );
  }

  return result.stdout
    .split("\u0000")
    .filter(Boolean);
}

function isTrackedEnvironmentFile(
  file
) {
  const name =
    path.basename(file);

  if (!/^\.env(?:\.|$)/u.test(name)) {
    return false;
  }

  return !(
    name.includes(".example") ||
    name.includes(".sample") ||
    name.includes(".template")
  );
}

const findings = [];

for (
  const file
  of trackedFiles()
) {
  if (
    isTrackedEnvironmentFile(file)
  ) {
    findings.push({
      path: file,
      line: 1,
      pattern_id:
        "tracked_environment_file"
    });

    continue;
  }

  if (
    binaryExtensions.has(
      path.extname(file)
        .toLowerCase()
    )
  ) {
    continue;
  }

  let buffer;

  try {
    buffer =
      fs.readFileSync(file);
  }
  catch {
    continue;
  }

  if (
    buffer.length > 2_000_000 ||
    buffer.includes(0)
  ) {
    continue;
  }

  const text =
    buffer.toString("utf8");

  const lines =
    text.split(/\r?\n/u);

  for (
    let index = 0;
    index < lines.length;
    index += 1
  ) {
    for (
      const pattern
      of patterns
    ) {
      if (
        pattern.regex.test(
          lines[index]
        )
      ) {
        findings.push({
          path: file,
          line: index + 1,
          pattern_id:
            pattern.id
        });
      }

      pattern.regex.lastIndex = 0;
    }
  }
}

if (findings.length > 0) {
  console.error(
    JSON.stringify({
      ok: false,
      failure_token:
        "beta28_secret_detected",
      finding_count:
        findings.length,
      findings
    })
  );

  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    guard:
      "BETA-28",
    scan:
      "tracked_file_secret_scan",
    finding_count: 0
  })
);
