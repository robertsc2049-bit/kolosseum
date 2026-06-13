// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-10 release boundary file closure guard.
 * Purpose: proves canonical v1 boundary docs agree before product implementation widens.
 * Boundary: documentation and CI guard registration only. This guard must not change
 * product implementation, engine behaviour, registry content, payment implementation,
 * auth implementation, UI behaviour, database state, workflow semantics, or release approval.
 * Determinism: reads fixed repository files and git status only; no network, database,
 * runtime, clock, API, or GitHub state is used.
 * Failure: emits CI_V1_RELEASE_BOUNDARY_FILE_CLOSURE when v1 release-boundary closure drifts.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const GUARD = "S-V1-10";
const TOKEN = "CI_V1_RELEASE_BOUNDARY_FILE_CLOSURE";

const FILES = {
  activeBoundary: "docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md",
  releaseBoundary: "docs/v1/V1_RELEASE_BOUNDARY.md",
  acceptanceGate: "docs/v1/V1_ACCEPTANCE_GATE.md",
  notInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  authorityMap: "docs/v1/V1_DOC_AUTHORITY_MAP.md",
  ciMasterGate: "docs/v1/V1_CI_MASTER_GATE.md",
  packageJson: "package.json"
};

const PRIMARY_DOCS = [
  FILES.releaseBoundary,
  FILES.acceptanceGate,
  FILES.notInScope
];

const POINTER_DOCS = [
  FILES.activeBoundary,
  FILES.authorityMap
];

const REQUIRED_MARKERS = {
  [FILES.activeBoundary]: "S-V1-10:ACTIVE-RELEASE-BOUNDARY-CLOSURE:START",
  [FILES.releaseBoundary]: "S-V1-10:RELEASE-BOUNDARY-CLOSURE:START",
  [FILES.acceptanceGate]: "S-V1-10:ACCEPTANCE-GATE-CLOSURE:START",
  [FILES.notInScope]: "S-V1-10:NOT-IN-SCOPE-CLOSURE:START",
  [FILES.authorityMap]: "S-V1-10:AUTHORITY-MAP-CLOSURE:START"
};

const REQUIRED_PRIMARY_PHRASES = [
  "complete coach-athlete product",
  "proof layer",
  "full supported registry/template/substitution coverage",
  "controlled launch",
  "cannot alter engine truth",
  "deterministic engine truth",
  "programme assignment legality",
  "compile output",
  "substitution legality",
  "replay truth",
  "proof truth",
  "factual history",
  "coach-athlete relationship authority",
  "organisations",
  "organizations",
  "teams",
  "gyms",
  "units",
  "federations",
  "marketplace",
  "messaging",
  "chat",
  "epos",
  "gym access",
  "full dashboards",
  "enterprise"
];

const REQUIRED_POINTER_PHRASES = [
  "complete coach-athlete product",
  "proof layer",
  "full supported registry/template/substitution coverage",
  "controlled launch",
  "cannot alter engine truth",
  "organisations",
  "organizations",
  "teams",
  "gyms",
  "units",
  "federations",
  "marketplace",
  "messaging",
  "chat",
  "epos",
  "gym access",
  "full dashboards",
  "enterprise"
];

const FORBIDDEN_CHANGED_PREFIXES = [
  "engine/",
  "server/",
  "shared/",
  "registries/",
  "app/",
  "web/",
  "ui/",
  "db/",
  "database/",
  "migrations/",
  "supabase/"
];

const ALLOWED_CHANGED_FILES = new Set([
  "docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md",
  "docs/v1/V1_RELEASE_BOUNDARY.md",
  "docs/v1/V1_ACCEPTANCE_GATE.md",
  "docs/v1/V1_NOT_IN_SCOPE.md",
  "docs/v1/V1_DOC_AUTHORITY_MAP.md",
  "ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs",
  "package.json",
  "docs/GUARDS_INDEX.md",
  "docs/dev/FAILURE_TOKEN_INDEX.md",
  "docs/checksums.sha256"
]);

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    message,
    ...details
  }, null, 2));

  process.exitCode = 1;
}

function repoPath(relPath) {
  return path.join(ROOT, relPath);
}

function readRequiredText(relPath) {
  const absPath = repoPath(relPath);

  if (!fs.existsSync(absPath)) {
    fail("Required S-V1-10 boundary file is missing.", { path: relPath });
    return "";
  }

  return fs.readFileSync(absPath, "utf8");
}

function normalise(text) {
  return String(text).toLowerCase();
}

function assertIncludes(relPath, text, phrase) {
  if (!normalise(text).includes(normalise(phrase))) {
    fail("Required S-V1-10 boundary phrase is missing.", {
      path: relPath,
      phrase
    });
  }
}

function gitOutput(args) {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch {
    return "";
  }
}

function parsePorcelainPath(line) {
  if (!line) return "";

  let relPath = "";
  if (line.length >= 3 && line[2] === " ") {
    relPath = line.slice(3);
  } else if (line.length >= 2) {
    relPath = line.slice(2).trimStart();
  } else {
    relPath = line.trim();
  }

  if (relPath.includes(" -> ")) {
    relPath = relPath.split(" -> ").pop().trim();
  }

  return relPath.replace(/^"|"$/gu, "").replace(/\\/gu, "/");
}

function currentChangedFiles() {
  const files = new Set();

  const porcelain = gitOutput(["status", "--porcelain=v1", "-uall"]);
  for (const line of porcelain.split(/\r?\n/u).filter(Boolean)) {
    const relPath = parsePorcelainPath(line);
    if (relPath) {
      files.add(relPath);
    }
  }

  const base = gitOutput(["merge-base", "HEAD", "origin/main"]);
  if (base) {
    const committed = gitOutput(["diff", "--name-only", `${base}..HEAD`]);
    for (const relPath of committed.split(/\r?\n/u).filter(Boolean)) {
      files.add(relPath.replace(/\\/gu, "/"));
    }
  }

  return [...files].sort();
}

for (const relPath of Object.values(FILES)) {
  readRequiredText(relPath);
}

for (const [relPath, marker] of Object.entries(REQUIRED_MARKERS)) {
  assertIncludes(relPath, readRequiredText(relPath), marker);
}

for (const relPath of PRIMARY_DOCS) {
  const text = readRequiredText(relPath);

  for (const phrase of REQUIRED_PRIMARY_PHRASES) {
    assertIncludes(relPath, text, phrase);
  }
}

for (const relPath of POINTER_DOCS) {
  const text = readRequiredText(relPath);

  for (const phrase of REQUIRED_POINTER_PHRASES) {
    assertIncludes(relPath, text, phrase);
  }
}

const authorityMap = readRequiredText(FILES.authorityMap);
for (const relPath of [
  FILES.activeBoundary,
  FILES.releaseBoundary,
  FILES.acceptanceGate,
  FILES.notInScope,
  FILES.authorityMap,
  FILES.ciMasterGate
]) {
  assertIncludes(FILES.authorityMap, authorityMap, relPath);
}

const ciMasterGate = readRequiredText(FILES.ciMasterGate);
for (const phrase of [
  "v1 boundary",
  "registry",
  "copy and claims",
  "auth and permissions",
  "proof, replay, and export",
  "no-coupling and engine truth"
]) {
  assertIncludes(FILES.ciMasterGate, ciMasterGate, phrase);
}

const packageJson = readRequiredText(FILES.packageJson);
if (!packageJson.includes("node ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs")) {
  fail("S-V1-10 guard must be registered in the existing lint:fast guard chain.");
}

const changedFiles = currentChangedFiles();

// S-V1-10 guard intentionally checks forbidden implementation prefixes only.
// It must not freeze future v1 slices to the S-V1-10 changed-file allowlist.
for (const changedFile of changedFiles) {
  for (const forbiddenPrefix of FORBIDDEN_CHANGED_PREFIXES) {
    if (changedFile.startsWith(forbiddenPrefix)) {
      fail("S-V1-10 touched a forbidden implementation surface.", {
        path: changedFile,
        forbidden_prefix: forbiddenPrefix
      });
    }
  }
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-10 release boundary file closure guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  primary_docs_checked: PRIMARY_DOCS.length,
  pointer_docs_checked: POINTER_DOCS.length,
  changed_files_checked: changedFiles.length,
  message: "V1 release boundary file closure passed."
}, null, 2));
