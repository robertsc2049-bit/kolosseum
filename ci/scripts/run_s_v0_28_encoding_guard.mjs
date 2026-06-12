#!/usr/bin/env node
/**
 * DEV NOTE: S-V0-28 encoding closure guard.
 * Purpose: protect workflow and critical CI guard/script surfaces from UTF-8
 * BOM, CRLF/CR line-ending drift, mojibake, and new non-ASCII drift where the
 * repo expects ASCII-only CI control files.
 * Boundary: this guard checks bytes/text only. It does not define engine,
 * product, registry, workflow trigger, or release semantics.
 * Failure: emits stable S_V0_28_* tokens and exits non-zero so the failing
 * encoding class and file are visible in local PowerShell and GitHub Actions.
 */

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const MOJIBAKE_PATTERNS = [
  "\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u00a2",
  "\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u0153",
  "\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u009d",
  "\u00c3\u00a2\u00e2\u201a\u00ac\u00cb\u0153",
  "\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u201e\u00a2",
  "\u00c3\u00a2\u00e2\u201a\u00ac\u00c5\u201c",
  "\u00c3\u00a2\u00e2\u201a\u00ac\u00c2",
  "\u00e2\u0153\u2026",
  "\u00e2\u009d\u0152"
];

const CRITICAL_CI_SCRIPTS = [
  "ci/scripts/run_ci_wrapper_contract_guard.mjs",
  "ci/scripts/run_s_v0_27_workflow_policy_and_parity_guard.mjs",
  "ci/scripts/run_s_v0_28_encoding_guard.mjs",
  "ci/scripts/run_failure_token_index_guard.mjs",
  "ci/scripts/sha256_guard.mjs",
  "ci/scripts/schema_guard.mjs",
  "ci/scripts/spine_guard.mjs"
];

function normalizeRel(value) {
  return value.replaceAll(path.sep, "/");
}

function exists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function listFiles(dirRel, extensions) {
  const dirAbs = path.join(repoRoot, dirRel);
  if (!fs.existsSync(dirAbs)) return [];
  return fs
    .readdirSync(dirAbs, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => extensions.some((extension) => name.toLowerCase().endsWith(extension)))
    .sort()
    .map((name) => normalizeRel(path.join(dirRel, name)));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function isAsciiControlSurface(relPath) {
  if (relPath.startsWith(".github/workflows/")) return true;
  if (relPath === "ci/scripts/run_s_v0_27_workflow_policy_and_parity_guard.mjs") return true;
  if (relPath === "ci/scripts/run_s_v0_28_encoding_guard.mjs") return true;
  return false;
}

function buildFailure(token, relPath, message, details = {}) {
  return {
    token,
    path: relPath,
    message,
    ...details
  };
}

const governedFiles = uniqueSorted([
  ...listFiles(".github/workflows", [".yml", ".yaml"]),
  ...listFiles("ci/guards", [".mjs"]),
  ...CRITICAL_CI_SCRIPTS.filter(exists)
]);

const failures = [];

for (const relPath of governedFiles) {
  const absPath = path.join(repoRoot, relPath);
  const bytes = fs.readFileSync(absPath);
  const text = bytes.toString("utf8");

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    failures.push(buildFailure("S_V0_28_UTF8_BOM_FORBIDDEN", relPath, "File has a UTF-8 BOM."));
  }

  if (text.includes("\r\n") || text.includes("\r")) {
    failures.push(buildFailure("S_V0_28_CRLF_FORBIDDEN", relPath, "File has CRLF or CR line endings."));
  }

  for (const pattern of MOJIBAKE_PATTERNS) {
    if (text.includes(pattern)) {
      failures.push(buildFailure("S_V0_28_MOJIBAKE_FORBIDDEN", relPath, "File contains known mojibake text.", { pattern }));
    }
  }

  if (isAsciiControlSurface(relPath)) {
    const nonAscii = [...text.matchAll(/[^\u0009\u000A\u000D\u0020-\u007E]/g)];
    if (nonAscii.length > 0) {
      failures.push(buildFailure("S_V0_28_NON_ASCII_FORBIDDEN", relPath, "ASCII-only CI control surface contains non-ASCII text.", { count: nonAscii.length }));
    }
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    guard: "s_v0_28_encoding_guard",
    failures
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  guard: "s_v0_28_encoding_guard",
  governed_file_count: governedFiles.length
}, null, 2));
