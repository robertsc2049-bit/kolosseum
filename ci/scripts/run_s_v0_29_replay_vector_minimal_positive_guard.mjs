#!/usr/bin/env node
/**
 * DEV NOTE: S-V0-29 replay vector minimal positive closure guard.
 * Purpose: prove the required v0 minimal positive replay vector exists,
 * remains small/readable, avoids post-v0 and claim language, and is visible
 * to the replay/full-suite command surface.
 * Boundary: this guard validates replay-vector presence and byte stability
 * only. It does not define engine law, registry law, evidence semantics,
 * progression logic, coaching advice, recommendations, or post-v0 scope.
 * Failure: emits stable S_V0_29_* tokens and exits non-zero so replay
 * closure drift is visible in PowerShell and CI output.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repoRoot = process.cwd();
const vectorRel = "replay/suite/v0_minimal_positive/envelope.json";
const vectorAbs = path.join(repoRoot, vectorRel);
const MAX_BYTES = 8192;

const FORBIDDEN_TEXT = [
  "recommend",
  "recommendation",
  "recommended",
  "optimal",
  "optimise",
  "optimize",
  "risk",
  "safe",
  "unsafe",
  "fatigue",
  "readiness",
  "diagnose",
  "diagnosis",
  "injury",
  "medical",
  "treatment",
  "effective",
  "adherence",
  "programme worked",
  "programme failed"
];

const POST_V0_KEYS = [
  "billing",
  "subscription",
  "payment",
  "marketplace",
  "organisation",
  "organization",
  "team",
  "gym_access",
  "epos",
  "message",
  "messaging",
  "coach_note",
  "coach_notes",
  "dashboard",
  "analytics",
  "recommendation",
  "readiness",
  "fatigue",
  "risk"
];

function fail(token, message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: "s_v0_29_replay_vector_minimal_positive_guard",
    token,
    message,
    ...details
  }, null, 2));
  process.exit(1);
}

function readUtf8(relPath) {
  const absPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(absPath)) {
    fail("S_V0_29_REPLAY_VECTOR_MISSING", "Required replay vector is missing.", { path: relPath });
  }
  return fs.readFileSync(absPath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function sha256Bytes(absPath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absPath)).digest("hex");
}

function collectKeys(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, output);
    return output;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      output.push(key);
      collectKeys(value[key], output);
    }
  }
  return output;
}

function listSearchFiles(dirAbs, output = []) {
  if (!fs.existsSync(dirAbs)) return output;
  for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    const abs = path.join(dirAbs, entry.name);
    const rel = path.relative(repoRoot, abs).replaceAll(path.sep, "/");
    if (entry.isDirectory()) {
      if ([".git", "node_modules", "dist", "coverage"].includes(entry.name)) continue;
      listSearchFiles(abs, output);
      continue;
    }
    if (!entry.isFile()) continue;
    if (![".json", ".mjs", ".js", ".ts", ".md", ".txt", ".yml", ".yaml"].includes(path.extname(entry.name).toLowerCase())) continue;
    output.push(rel);
  }
  return output;
}

const text = readUtf8(vectorRel);
const bytes = fs.readFileSync(vectorAbs);

if (bytes.length === 0) {
  fail("S_V0_29_REPLAY_VECTOR_EMPTY", "Replay vector envelope is empty.", { path: vectorRel });
}

if (bytes.length > MAX_BYTES) {
  fail("S_V0_29_REPLAY_VECTOR_TOO_LARGE", "Replay vector must stay small and readable.", { path: vectorRel, bytes: bytes.length, max_bytes: MAX_BYTES });
}

if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
  fail("S_V0_29_REPLAY_VECTOR_BOM_FORBIDDEN", "Replay vector has a UTF-8 BOM.", { path: vectorRel });
}

if (text.includes("\r")) {
  fail("S_V0_29_REPLAY_VECTOR_CRLF_FORBIDDEN", "Replay vector must use LF line endings.", { path: vectorRel });
}

let parsed;
try {
  parsed = JSON.parse(text);
} catch (error) {
  fail("S_V0_29_REPLAY_VECTOR_INVALID_JSON", "Replay vector envelope contains invalid JSON.", { path: vectorRel, error: String(error.message || error) });
}

if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
  fail("S_V0_29_REPLAY_VECTOR_INVALID_SHAPE", "Replay vector envelope must be a JSON object.", { path: vectorRel });
}

const lowerText = text.toLowerCase();
for (const forbidden of FORBIDDEN_TEXT) {
  if (lowerText.includes(forbidden)) {
    fail("S_V0_29_REPLAY_VECTOR_FORBIDDEN_LANGUAGE", "Replay vector contains claim/recommendation language.", { path: vectorRel, forbidden });
  }
}

const keys = collectKeys(parsed).map((key) => String(key).toLowerCase());
for (const forbiddenKey of POST_V0_KEYS) {
  if (keys.includes(forbiddenKey)) {
    fail("S_V0_29_REPLAY_VECTOR_POST_V0_FIELD", "Replay vector contains a post-v0 field.", { path: vectorRel, field: forbiddenKey });
  }
}

const firstHash = sha256Bytes(vectorAbs);
const secondHash = sha256Bytes(vectorAbs);
if (firstHash !== secondHash) {
  fail("S_V0_29_REPLAY_VECTOR_HASH_UNSTABLE", "Replay vector bytes are not stable across repeated reads.", { path: vectorRel });
}

const searchableFiles = listSearchFiles(repoRoot);
const referenceNeedles = [
  "v0_minimal_positive",
  "replay/suite/v0_minimal_positive/envelope.json",
  "replay\\\\suite\\\\v0_minimal_positive\\\\envelope.json"
];

const references = [];
for (const rel of searchableFiles) {
  if (rel === "ci/scripts/run_s_v0_29_replay_vector_minimal_positive_guard.mjs") continue;
  if (rel === vectorRel) continue;
  const fileText = fs.readFileSync(path.join(repoRoot, rel), "utf8");
  if (referenceNeedles.some((needle) => fileText.includes(needle))) {
    references.push(rel);
  }
}

if (references.length === 0) {
  fail("S_V0_29_REPLAY_VECTOR_NOT_REFERENCED", "Replay vector is not referenced by replay/full-suite surfaces.", { path: vectorRel });
}

const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const scripts = packageJson.scripts || {};
if (!String(scripts["test:full"] || "").includes("kolosseum_full_test_suite.mjs")) {
  fail("S_V0_29_FULL_SUITE_SCRIPT_MISSING", "package.json test:full must call the comprehensive suite runner.");
}

console.log(JSON.stringify({
  ok: true,
  guard: "s_v0_29_replay_vector_minimal_positive_guard",
  path: vectorRel,
  bytes: bytes.length,
  sha256: firstHash,
  references: references.sort()
}, null, 2));
