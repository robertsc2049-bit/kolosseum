// @law: Beta Copy Registry Authority
// @severity: high
// @scope: beta-copy
// DEV NOTE: BETA-FIX-01 authoritative beta copy registry reconciliation guard.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  BETA_COPY_TOKENS,
  verifyBetaCopyRegistry
} from "../lib/beta_copy_registry_guard_lib.mjs";

import {
  createCiTokenReport,
  emitCiTokenReport
} from "../scripts/ci_token_report.mjs";

const root = process.cwd();
const failures = [];

function fail(token, message, relPath, details = {}) {
  failures.push({
    token,
    message,
    source: "ci/guards/beta_fix_01_copy_registry_reconciliation_guard.mjs",
    location: relPath ? { path: relPath } : undefined,
    details
  });
}

function read(relPath) {
  const target = path.join(root, relPath);
  if (!fs.existsSync(target)) {
    fail(BETA_COPY_TOKENS.registry, "Required BETA-FIX-01 artefact is missing.", relPath);
    return "";
  }
  return fs.readFileSync(target, "utf8");
}

function readJson(relPath) {
  const raw = read(relPath);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(BETA_COPY_TOKENS.registry, "Required BETA-FIX-01 JSON is invalid.", relPath, { error: String(error.message ?? error) });
    return null;
  }
}

const result = verifyBetaCopyRegistry({ root });
failures.push(...result.failures);

const packageJson = readJson("package.json");
const entrypoints = readJson("ci/guards/_entrypoints.json");
const manifest = readJson("spine/BETA_ARTEFACT_MANIFEST.json");
const record = readJson("docs/releases/BETA_FIX_01_COPY_REGISTRY_RECONCILIATION.json");
const guardIndex = read("docs/GUARDS_INDEX.md");
const tokenIndex = read("docs/dev/FAILURE_TOKEN_INDEX.md");
const checksums = read("docs/checksums.sha256");

const expectedProof = "node ci/scripts/run_beta_fix_01_copy_registry_reconciliation_tests.mjs && node ci/guards/beta_fix_01_copy_registry_reconciliation_guard.mjs";
if (packageJson?.scripts?.["proof:beta-fix-01"] !== expectedProof) {
  fail(BETA_COPY_TOKENS.registry, "BETA-FIX-01 proof script registration is invalid.", "package.json");
}
if (!String(packageJson?.scripts?.["test:unit"] ?? "").includes("npm run proof:beta-fix-01")) {
  fail(BETA_COPY_TOKENS.registry, "BETA-FIX-01 is absent from test:unit.", "package.json");
}
if (!Array.isArray(entrypoints?.package_json_scripts) || !entrypoints.package_json_scripts.includes("proof:beta-fix-01")) {
  fail(BETA_COPY_TOKENS.registry, "BETA-FIX-01 proof is absent from declared guard entrypoints.", "ci/guards/_entrypoints.json");
}
if (!guardIndex.includes("ci/guards/beta_fix_01_copy_registry_reconciliation_guard.mjs")) {
  fail(BETA_COPY_TOKENS.registry, "BETA-FIX-01 guard is absent from the generated guard index.", "docs/GUARDS_INDEX.md");
}
for (const token of Object.values(BETA_COPY_TOKENS)) {
  if (!tokenIndex.includes(String.fromCharCode(96) + token + String.fromCharCode(96))) {
    fail(BETA_COPY_TOKENS.registry, "BETA-FIX-01 failure token is absent from the generated token index.", "docs/dev/FAILURE_TOKEN_INDEX.md", { token });
  }
}

const requiredChecksumPaths = [
  "../copy/beta_copy_registry.json",
  "../copy/beta_16_app_path_phase1_6_copy.json",
  "../public/beta_16_app_path_phase1_6_copy.json",
  "../copy/beta_17_coach_managed_path_copy.json",
  "../public/beta_17_coach_managed_path_copy.json",
  "../copy/beta_20_phase7_projection_copy.json",
  "../ci/locks/beta_copy_scope.json",
  "../ci/lib/beta_copy_registry_guard_lib.mjs",
  "../ci/guards/beta_fix_01_copy_registry_reconciliation_guard.mjs",
  "../ci/scripts/run_beta_fix_01_copy_registry_reconciliation_tests.mjs",
  "../test/beta_fix_01_copy_registry_reconciliation.test.mjs",
  "../test/fixtures/beta_fix_01_copy_registry_reconciliation/cases.json",
  "../test/fixtures/beta_fix_01_copy_registry_reconciliation/manifest.json",
  "releases/BETA_FIX_01_COPY_REGISTRY_RECONCILIATION.json",
  "releases/BETA_FIX_01_COPY_REGISTRY_RECONCILIATION.md"
];
for (const relPath of requiredChecksumPaths) {
  if (!checksums.includes("  " + relPath + "\n")) {
    fail(BETA_COPY_TOKENS.registry, "BETA-FIX-01 checksum coverage is incomplete.", "docs/checksums.sha256", { path: relPath });
  }
}

const manifestPaths = new Set(Array.isArray(manifest?.artefacts) ? manifest.artefacts.map((item) => item.path) : []);
for (const relPath of requiredChecksumPaths.map((item) => item.startsWith("../") ? item.slice(3) : "docs/" + item)) {
  if (!manifestPaths.has(relPath)) {
    fail(BETA_COPY_TOKENS.registry, "BETA-FIX-01 artefact is absent from beta manifest checksum authority.", "spine/BETA_ARTEFACT_MANIFEST.json", { path: relPath });
  }
}

if (
  record?.outcome !== "RECONCILED" ||
  record?.pr_764?.during_slice !== "KEEP_OPEN_UNMERGED" ||
  record?.pr_764?.recommended_post_merge_disposition !== "CLOSE_AS_SUPERSEDED"
) {
  fail(BETA_COPY_TOKENS.registry, "BETA-FIX-01 reconciliation record is incomplete.", "docs/releases/BETA_FIX_01_COPY_REGISTRY_RECONCILIATION.json");
}

const report = createCiTokenReport({
  guard: "BETA-FIX-01",
  token: BETA_COPY_TOKENS.guard,
  message: failures.length === 0
    ? "Authoritative beta copy registry reconciliation passed."
    : "Authoritative beta copy registry reconciliation failed.",
  failures,
  details: {
    registry_path: result.registry_path,
    scope_path: result.scope_path,
    canonical_copy_id_count: result.canonical_copy_id_count,
    baseline_copy_id_count: result.baseline_copy_id_count,
    subordinate_registry_count: result.subordinate_registry_count,
    scoped_explicit_path_count: result.scoped_explicit_path_count,
    scoped_prefix_count: result.scoped_prefix_count
  }
});

emitCiTokenReport(report, { stream: report.ok ? "stdout" : "stderr" });
process.exit(report.ok ? 0 : 1);
// DEV NOTE: Stable guard-owned tokens are declared in ci/guards because the
// generated failure-token index intentionally does not scan the ci/lib folder.
const BETA_FIX_01_INDEXED_FAILURE_TOKENS = Object.freeze([
  "CI_COPY_GUARD",
  "CI_BETA_COPY_REGISTRY_RECONCILIATION",
  "CI_BETA_COPY_REGISTRY_BASELINE",
  "CI_LINT_COPY_INLINE_STRING",
  "CI_LINT_COPY_ID_UNKNOWN",
  "CI_LINT_FORBIDDEN_LANGUAGE_FOUND",
  "CI_LINT_FORBIDDEN_CLAIM_SEMANTIC",
  "CI_BETA_COPY_ID_DUPLICATE",
  "CI_BETA_COPY_ID_REQUIRED_MISSING",
  "CI_BETA_COPY_SCOPE_INVALID",
  "CI_BETA_COPY_SUBORDINATE_CONFLICT"
]);

void BETA_FIX_01_INDEXED_FAILURE_TOKENS;
