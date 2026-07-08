// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";

// DEV NOTE: Checksum writer boundary.
// Purpose: generate docs/checksums.sha256 deterministically for docs root files,
// approved generated docs/dev indexes, and beta seal-scope spine artefacts.
// Boundary: this writer changes files only in --write mode. --check and --print
// must stay read-only so proof commands cannot create hidden working-tree drift.
// It does not define product, engine, registry, release, or evidence semantics.

const TOKEN = "CI_BETA_GENERATED_DRIFT";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    mode: "write"
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--root") {
      args.root = path.resolve(String(argv[++i] || ""));
      continue;
    }

    if (arg === "--write") {
      args.mode = "write";
      continue;
    }

    if (arg === "--check") {
      args.mode = "check";
      continue;
    }

    if (arg === "--print") {
      args.mode = "print";
      continue;
    }

    console.error(`${TOKEN}: unknown write_checksums argument ${arg}`);
    process.exit(1);
  }

  return args;
}

const args = parseArgs(process.argv.slice(2));
const repo = args.root;
const docsDir = path.join(repo, "docs");
const outPath = path.join(docsDir, "checksums.sha256");

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
  return normRel(path.relative(docsDir, repoPath(rel)));
}

function sha256File(absPath) {
  const bytes = fs.readFileSync(absPath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
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

function readJsonIfPresent(rel) {
  const abs = repoPath(rel);
  if (!fs.existsSync(abs)) return null;
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function collectDocsRootFiles() {
  if (!fs.existsSync(docsDir)) {
    console.error("docs/ folder missing");
    process.exit(1);
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
      console.error(`${TOKEN}: unsafe beta manifest checksum path ${rel}`);
      process.exit(1);
    }
  }

  return out;
}

function normalizeBetaManifestForWrite() {
  const rel = "spine/BETA_ARTEFACT_MANIFEST.json";
  const abs = repoPath(rel);

  if (!fs.existsSync(abs)) return;

  const parsed = JSON.parse(fs.readFileSync(abs, "utf8"));
  fs.writeFileSync(abs, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

function assertBetaManifestStableForReadOnlyMode() {
  const rel = "spine/BETA_ARTEFACT_MANIFEST.json";
  const abs = repoPath(rel);

  if (!fs.existsSync(abs)) return;

  const raw = fs.readFileSync(abs, "utf8");
  const parsed = JSON.parse(raw);
  const expected = `${JSON.stringify(parsed, null, 2)}\n`;

  if (raw !== expected) {
    console.error(`${TOKEN}: spine/BETA_ARTEFACT_MANIFEST.json is not stable pretty JSON; run node ci/scripts/write_checksums.mjs --write`);
    process.exit(1);
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

function render() {
  if (args.mode === "write") {
    normalizeBetaManifestForWrite();
  } else {
    assertBetaManifestStableForReadOnlyMode();
  }

  const relPaths = collectExpectedDocsRelPaths();
  const lines = [];

  for (const rel of relPaths) {
    const abs = docsRelToAbs(rel);
    if (!fs.existsSync(abs)) {
      console.error(`${TOKEN}: checksum scope references missing file ${rel}`);
      process.exit(1);
    }

    lines.push(`${sha256File(abs)}  ${rel}`);
  }

  return lines.join("\n") + (lines.length ? "\n" : "");
}

const output = render();

if (args.mode === "print") {
  process.stdout.write(output);
  process.exit(0);
}

if (args.mode === "check") {
  const actual = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n") : "";
  if (actual !== output) {
    console.error(`${TOKEN}: docs/checksums.sha256 is out of date; run node ci/scripts/write_checksums.mjs --write`);
    process.exit(1);
  }

  console.log("checksums current: docs/checksums.sha256");
  process.exit(0);
}

fs.writeFileSync(outPath, output, "utf8");
console.log(`checksums written: ${outPath}`);
