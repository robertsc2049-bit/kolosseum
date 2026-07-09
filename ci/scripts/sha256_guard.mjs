// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import { createCiTokenReport, emitCiTokenReport } from "./ci_token_report.mjs";

// DEV NOTE: Documentation checksum and generated-drift guard boundary.
// Purpose: verify docs/checksums.sha256 against committed docs bytes and beta
// seal-scope artefacts. This extends the historic checksum guard instead of
// creating a duplicate guard.
// Boundary: this guard checks repository artefact integrity only; it does not
// define product, engine, registry, release, or evidence semantics.
// Determinism: each listed file is hashed from raw bytes with SHA-256.
// Failure: missing checksum files, malformed lines, missing docs, hash drift,
// generated checksum drift, placeholder checksums in beta seal scope, or unstable
// beta manifest formatting emit stable CI_* messages and set a non-zero status.

const TOKEN = {
  checksumMissing: "CI_CHECKSUM_MISSING",
  manifestMismatch: "CI_MANIFEST_MISMATCH",
  missingDoc: "CI_SPINE_MISSING_DOC",
  betaPlaceholder: "CI_BETA_CHECKSUM_PLACEHOLDER",
  betaGeneratedDrift: "CI_BETA_GENERATED_DRIFT",
  betaManifestUnstable: "CI_BETA_MANIFEST_UNSTABLE"
};

const PLACEHOLDER_VALUES = new Set([
  "0".repeat(64),
  "PLACEHOLDER_SHA256",
  "PLACEHOLDER_SHA256_REMOVE_BEFORE_MERGE",
  "CHECKSUM_SENTINEL",
  "TODO_SHA256",
  "TBD_SHA256"
]);

function parseArgs(argv) {
  const args = {
    root: process.cwd()
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--root") {
      args.root = path.resolve(String(argv[++i] || ""));
      continue;
    }

    fail(TOKEN.manifestMismatch, "Unknown sha256_guard argument.", { arg });
  }

  return args;
}

const pendingFailures = [];

function fail(token, message, detail = {}) {
  pendingFailures.push({
    ok: false,
    token,
    message,
    ...detail
  });
}

function flushFailures() {
  if (pendingFailures.length === 0) return;

  const failures = pendingFailures.map((failure) => ({
    token: failure.token,
    message: failure.message,
    source: "ci/scripts/sha256_guard.mjs",
    location: failure.path ? { path: failure.path } : undefined,
    details: Object.fromEntries(
      Object.entries(failure).filter(([key]) => !["ok", "token", "message", "path"].includes(key))
    )
  }));

  emitCiTokenReport(createCiTokenReport({
    guard: "BETA-02",
    token: TOKEN.betaGeneratedDrift,
    failures
  }), { stream: "stderr" });

  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const repo = args.root;
const docsDir = path.join(repo, "docs");
const checksumFile = path.join(docsDir, "checksums.sha256");

function normRel(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/g, "")
    .replace(/\/+/g, "/");
}

function asciiCompare(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function repoPath(rel) {
  return path.resolve(repo, normRel(rel));
}

function docsRelToAbs(rel) {
  return path.resolve(docsDir, normRel(rel));
}

function repoRelToDocsRel(rel) {
  const abs = repoPath(rel);
  return normRel(path.relative(docsDir, abs));
}

function sha256File(absPath) {
  const bytes = fs.readFileSync(absPath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readJsonIfPresent(rel) {
  const abs = repoPath(rel);
  if (!fs.existsSync(abs)) return null;

  try {
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (error) {
    fail(TOKEN.betaGeneratedDrift, "JSON artefact cannot be parsed for generated checksum scope.", {
      path: rel,
      error: String(error?.message || error)
    });
    return null;
  }
}

function isSafeRepoRel(rel) {
  const p = normRel(rel);
  if (!p || p.startsWith("/") || p.startsWith("../") || p.includes("/../") || /^[a-zA-Z]:\//.test(p) || p.includes("\0")) {
    return false;
  }

  const abs = repoPath(p);
  const back = normRel(path.relative(repo, abs));
  return !(back.startsWith("../") || path.isAbsolute(back));
}

function collectDocsRootFiles() {
  if (!fs.existsSync(docsDir)) {
    fail(TOKEN.missingDoc, "docs directory is missing.", { path: "docs" });
    return [];
  }

  return fs.readdirSync(docsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name !== "checksums.sha256")
    .sort(asciiCompare);
}

function collectBetaManifestRepoPaths() {
  const out = new Set();
  const manifestRel = "spine/BETA_ARTEFACT_MANIFEST.json";

  if (!fs.existsSync(repoPath(manifestRel))) {
    return out;
  }

  out.add(manifestRel);

  const manifest = readJsonIfPresent(manifestRel);
  if (!manifest || typeof manifest !== "object") {
    return out;
  }

  const entries = [];

  if (Array.isArray(manifest.artefacts)) {
    for (const artefact of manifest.artefacts) {
      if (artefact && typeof artefact === "object" && artefact.path) {
        entries.push(String(artefact.path));
      }
    }
  }

  if (Array.isArray(manifest.spine_references)) {
    for (const ref of manifest.spine_references) {
      if (typeof ref === "string") {
        entries.push(ref);
      } else if (ref && typeof ref === "object" && ref.path) {
        entries.push(String(ref.path));
      }
    }
  }

  for (const rel of entries) {
    const safe = normRel(rel);
    if (isSafeRepoRel(safe)) {
      out.add(safe);
    } else {
      fail(TOKEN.betaGeneratedDrift, "Unsafe path in beta manifest checksum scope.", {
        path: rel
      });
    }
  }

  return out;
}

function assertStableJsonManifest(rel) {
  const abs = repoPath(rel);
  if (!fs.existsSync(abs)) return;

  const raw = fs.readFileSync(abs, "utf8");
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(TOKEN.betaManifestUnstable, "Beta manifest JSON is invalid.", {
      path: rel,
      error: String(error?.message || error)
    });
    return;
  }

  const expected = `${JSON.stringify(parsed, null, 2)}\n`;
  if (raw !== expected) {
    fail(TOKEN.betaManifestUnstable, "Beta artefact manifest is not stable pretty JSON.", {
      path: rel,
      command: "node ci/scripts/write_checksums.mjs --write"
    });
  }
}

function collectExpectedDocsRelPaths() {
  const paths = new Set();

  for (const rel of collectDocsRootFiles()) {
    paths.add(normRel(rel));
  }

  const generatedDocs = [
    "docs/dev/DOC_MANUAL_REVIEW_RECORD.md",
    "docs/dev/doc-manual-review-record.json",
    "docs/dev/FAILURE_TOKEN_INDEX.md"
  ];

  for (const rel of generatedDocs) {
    if (fs.existsSync(repoPath(rel))) {
      paths.add(repoRelToDocsRel(rel));
    }
  }

  const betaRepoPaths = collectBetaManifestRepoPaths();
  for (const rel of betaRepoPaths) {
    if (fs.existsSync(repoPath(rel))) {
      paths.add(repoRelToDocsRel(rel));
    }
  }

  return [...paths].sort(asciiCompare);
}

function renderExpectedChecksums() {
  const relPaths = collectExpectedDocsRelPaths();
  const lines = [];

  for (const rel of relPaths) {
    const abs = docsRelToAbs(rel);
    if (!fs.existsSync(abs)) {
      fail(TOKEN.missingDoc, "Generated checksum scope references missing file.", {
        path: rel
      });
      continue;
    }

    lines.push(`${sha256File(abs)}  ${rel}`);
  }

  return lines.join("\n") + (lines.length ? "\n" : "");
}

function isPlaceholder(value) {
  const raw = String(value || "").trim();
  return PLACEHOLDER_VALUES.has(raw) || /^0{64}$/.test(raw);
}

function isBetaSealDocsRel(rel) {
  const p = normRel(rel);
  return p.startsWith("../spine/");
}

function isGeneratedDocsRel(rel) {
  const p = normRel(rel);
  return new Set([
    "GUARDS_INDEX.md",
    "dev/FAILURE_TOKEN_INDEX.md",
    "dev/DOC_MANUAL_REVIEW_RECORD.md",
    "dev/doc-manual-review-record.json",
    "../spine/BUILD_TARGET_september_beta_2026.md",
    "../spine/BETA_ARTEFACT_MANIFEST.json"
  ]).has(p) || isBetaSealDocsRel(p);
}

if (!fs.existsSync(checksumFile)) {
  fail(TOKEN.checksumMissing, "docs/checksums.sha256 missing.");
  flushFailures();
}

assertStableJsonManifest("spine/BETA_ARTEFACT_MANIFEST.json");

const checksumText = fs.readFileSync(checksumFile, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const lines = checksumText
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

for (const line of lines) {
  const loose = line.match(/^(\S+)\s+(.+)$/);
  const checksumValue = loose ? loose[1] : "";
  const looseFile = loose ? normRel(loose[2]) : "";

  if (looseFile && isBetaSealDocsRel(looseFile) && isPlaceholder(checksumValue)) {
    fail(TOKEN.betaPlaceholder, "Placeholder checksum found in beta seal scope.", {
      path: looseFile,
      checksum: checksumValue
    });
    continue;
  }

  const match = line.match(/^([a-f0-9]{64})\s{2}(.+)$/);
  if (!match) {
    fail(TOKEN.manifestMismatch, "Invalid checksum line.", { line });
    continue;
  }

  const expected = match[1];
  const file = normRel(match[2]);
  const abs = docsRelToAbs(file);

  if (!fs.existsSync(abs)) {
    fail(TOKEN.missingDoc, "Checksum references missing file.", {
      path: file
    });
    continue;
  }

  const actual = sha256File(abs);
  if (actual !== expected) {
    fail(isGeneratedDocsRel(file) ? TOKEN.betaGeneratedDrift : TOKEN.manifestMismatch, "SHA-256 mismatch.", {
      path: file,
      expected,
      actual
    });
  }
}

const expectedText = renderExpectedChecksums();
if (checksumText !== expectedText) {
  fail(TOKEN.betaGeneratedDrift, "docs/checksums.sha256 is not the deterministic generated output.", {
    path: "docs/checksums.sha256",
    command: "node ci/scripts/write_checksums.mjs --write"
  });
}

flushFailures();

console.log("sha256_guard: OK");
