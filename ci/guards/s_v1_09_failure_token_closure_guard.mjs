// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-09 failure token closure guard.
 * Purpose: proves v1 guard failures use stable CI_V1_* tokens, expose those
 * tokens through a consistent TOKEN constant, and keep generated token/index
 * surfaces in sync.
 * Boundary: CI guard/token documentation only. This guard does not change
 * runtime behaviour, engine behaviour, app implementation, registry content,
 * auth, proof, UI, payment, workflow semantics, or product release scope.
 * Determinism: reads fixed repository files and exact marker strings only.
 * Failure: emits CI_V1_FAILURE_TOKEN_CLOSURE when v1 token coverage drifts.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-09";
const TOKEN = "CI_V1_FAILURE_TOKEN_CLOSURE";

const REQUIRED_PATHS = {
  commandGuide: "docs/dev/COMMAND_GUIDE.md",
  ciFailureGuide: "docs/dev/CI_FAILURE_GUIDE.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md",
  guardsIndex: "docs/GUARDS_INDEX.md",
  packageJson: "package.json"
};

const REQUIRED_DOC_MARKERS = {
  [REQUIRED_PATHS.commandGuide]: [
    "S-V1-09:FAILURE-TOKEN-CLOSURE-COMMANDS:START",
    "node ci/guards/s_v1_09_failure_token_closure_guard.mjs",
    "node ci/scripts/run_failure_token_index_guard.mjs --write",
    "CI_V1_FAILURE_TOKEN_CLOSURE"
  ],
  [REQUIRED_PATHS.ciFailureGuide]: [
    "S-V1-09:FAILURE-TOKEN-CLOSURE-FAILURE-PATH:START",
    "CI_V1_FAILURE_TOKEN_CLOSURE",
    "hidden string-only failures",
    "docs/dev/FAILURE_TOKEN_INDEX.md"
  ]
};

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

function readRequiredText(relPath) {
  const absPath = path.join(ROOT, relPath);

  if (!fs.existsSync(absPath)) {
    fail("Required failure-token closure file is missing.", { path: relPath });
    return "";
  }

  return fs.readFileSync(absPath, "utf8");
}

function listS1GuardFiles() {
  const guardDir = path.join(ROOT, "ci", "guards");

  if (!fs.existsSync(guardDir)) {
    fail("ci/guards directory is missing.");
    return [];
  }

  return fs.readdirSync(guardDir)
    .filter((name) => /^s_v1_.*_guard\.mjs$/.test(name))
    .sort()
    .map((name) => `ci/guards/${name}`);
}

function assertMarkers(relPath, markers) {
  const text = readRequiredText(relPath);

  for (const marker of markers) {
    if (!text.includes(marker)) {
      fail("Required S-V1-09 documentation marker is missing.", {
        path: relPath,
        marker
      });
    }
  }
}

for (const relPath of Object.values(REQUIRED_PATHS)) {
  readRequiredText(relPath);
}

for (const [relPath, markers] of Object.entries(REQUIRED_DOC_MARKERS)) {
  assertMarkers(relPath, markers);
}

const sV1Guards = listS1GuardFiles();
if (sV1Guards.length < 9) {
  fail("Expected at least S-V1-01 through S-V1-09 guard files.", {
    count: sV1Guards.length,
    files: sV1Guards
  });
}

const discoveredTokens = new Map();

for (const relPath of sV1Guards) {
  const text = readRequiredText(relPath);

  const tokenMatch = text.match(/const\s+TOKEN\s*=\s*"(?<token>CI_V1_[A-Z0-9_]+)"\s*;/);
  if (!tokenMatch?.groups?.token) {
    fail("S-V1 guard must define an uppercase stable CI_V1 TOKEN constant.", {
      path: relPath
    });
    continue;
  }

  const guardToken = tokenMatch.groups.token;
  discoveredTokens.set(guardToken, relPath);

  if (!text.includes("token: TOKEN")) {
    fail("S-V1 guard must emit token: TOKEN in its failure payload.", {
      path: relPath,
      token: guardToken
    });
  }

  if (/^\s*const\s+token\b/m.test(text)) {
    fail("S-V1 guard still uses lowercase const token.", {
      path: relPath,
      token: guardToken
    });
  }

  if (/ok:\s*false/.test(text) && !text.includes("token: TOKEN")) {
    fail("S-V1 guard has an ok:false failure payload without token: TOKEN.", {
      path: relPath,
      token: guardToken
    });
  }
}

const failureTokenIndex = readRequiredText(REQUIRED_PATHS.failureTokenIndex);
for (const [guardToken, relPath] of discoveredTokens.entries()) {
  if (!failureTokenIndex.includes(`\`${guardToken}\``) && !failureTokenIndex.includes(guardToken)) {
    fail("Stable CI_V1 token is missing from generated failure-token index.", {
      path: relPath,
      token: guardToken
    });
  }
}

const guardsIndex = readRequiredText(REQUIRED_PATHS.guardsIndex);
for (const relPath of sV1Guards) {
  if (!guardsIndex.includes(relPath)) {
    fail("S-V1 guard is missing from generated guards index.", {
      path: relPath
    });
  }
}

const packageJson = readRequiredText(REQUIRED_PATHS.packageJson);
if (!packageJson.includes("node ci/guards/s_v1_09_failure_token_closure_guard.mjs")) {
  fail("S-V1-09 guard must be registered in the existing lint:fast guard chain.");
}

if (!packageJson.includes("node ci/scripts/run_failure_token_index_guard.mjs")) {
  fail("Failure-token index guard must remain registered in lint:fast.");
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-09 failure token closure guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  s_v1_guards_checked: sV1Guards.length,
  ci_v1_tokens_checked: discoveredTokens.size,
  message: "V1 failure token closure passed."
}, null, 2));
