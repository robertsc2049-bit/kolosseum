// @law: Repo Governance
// @severity: medium
// @scope: repo
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TOKEN = "CI_V1_RETENTION_ACCESS_WINDOW_POLICY";

export const guardMeta = Object.freeze({
  id: "s_v1_r_03_retention_access_window_policy_guard",
  slice: "S-V1-R-03",
  title: "Retention and Access Window Policy Guard",
  token: TOKEN,
  owner: "ci",
  description: "Asserts the controlled-launch retention/access policy remains product-policy-only, source-bound, and engine-invisible.",
  files: Object.freeze([
    "src/v1RetentionAccessWindowPolicy.mjs",
    "docs/v1/V1_RETENTION_ACCESS_WINDOW_POLICY.md",
    "test/s_v1_r_03_retention_access_window_policy.test.mjs"
  ])
});

const REQUIRED_FILES = [
  "src/v1RetentionAccessWindowPolicy.mjs",
  "docs/v1/V1_RETENTION_ACCESS_WINDOW_POLICY.md",
  "test/s_v1_r_03_retention_access_window_policy.test.mjs",
  "package.json"
];

const failures = [];

function fail(message) {
  failures.push(message);
}

function readText(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    fail(`Missing required file: ${relPath}`);
    return "";
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relPath) {
  const text = readText(relPath);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`Invalid JSON in ${relPath}: ${error.message}`);
    return null;
  }
}

function assertIncludes(text, needle, file, label) {
  if (!text.includes(needle)) {
    fail(`${file} missing ${label}: ${needle}`);
  }
}

function assertNotMatches(text, pattern, file, label) {
  if (pattern.test(text)) {
    fail(`${file} contains forbidden ${label}: ${pattern}`);
  }
}

for (const relPath of REQUIRED_FILES) {
  if (!fs.existsSync(path.join(ROOT, relPath))) {
    fail(`Missing required file: ${relPath}`);
  }
}

const sourcePath = "src/v1RetentionAccessWindowPolicy.mjs";
const docPath = "docs/v1/V1_RETENTION_ACCESS_WINDOW_POLICY.md";
const testPath = "test/s_v1_r_03_retention_access_window_policy.test.mjs";

const source = readText(sourcePath);
const doc = readText(docPath);
const tests = readText(testPath);
const packageJson = readJson("package.json");

assertIncludes(source, "evaluateRetentionAccessWindowPolicy", sourcePath, "policy evaluator export");
assertIncludes(source, "createRetentionAccessWindowPolicyRecord", sourcePath, "policy record export");
assertIncludes(source, "compileIgnoringRetentionAccessWindowPolicy", sourcePath, "compile no-coupling helper export");
assertIncludes(source, "getRetentionAccessWindowPolicyContract", sourcePath, "contract export");
assertIncludes(source, "product_policy_only: true", sourcePath, "product policy boundary");
assertIncludes(source, "source_bound_export", sourcePath, "source-bound export surface");
assertIncludes(source, "own_user_data", sourcePath, "own-data export scope");
assertIncludes(source, "creates_enterprise_retention: false", sourcePath, "enterprise retention exclusion");
assertIncludes(source, "creates_organisation_export: false", sourcePath, "organisation export exclusion");
assertIncludes(source, "creates_broad_legal_overhaul: false", sourcePath, "broad legal overhaul exclusion");
assertIncludes(source, "reads_engine_input: false", sourcePath, "engine input read boundary");
assertIncludes(source, "writes_engine_input: false", sourcePath, "engine input write boundary");
assertIncludes(source, "mutates_engine_output: false", sourcePath, "engine output mutation boundary");
assertIncludes(source, "mutates_runtime_events: false", sourcePath, "runtime event mutation boundary");
assertIncludes(source, "mutates_replay_or_proof: false", sourcePath, "replay proof mutation boundary");
assertIncludes(source, "triggers_substitution: false", sourcePath, "substitution boundary");

assertNotMatches(source, /from\s+["'][^"']*(?:engine|runtime|substitution|phase1|phase2|phase3|phase4|phase5|phase6)[^"']*["']/i, sourcePath, "engine import");
assertNotMatches(source, /import\s*\([^)]*(?:engine|runtime|substitution|phase1|phase2|phase3|phase4|phase5|phase6)/i, sourcePath, "dynamic engine import");
assertNotMatches(source, /\b(?:appendRuntimeEvent|emitRuntimeEvent|runPipeline|phase2CanonicaliseAndHash|phase3ResolveConstraints|phase4AssembleProgram|phase5|phase6ProduceSessionOutput)\b/, sourcePath, "engine callsite");

assertIncludes(doc, "product policy only", docPath, "product policy wording");
assertIncludes(doc, "source-bound own-data export", docPath, "source-bound export wording");
assertIncludes(doc, "enterprise retention", docPath, "enterprise exclusion wording");
assertIncludes(doc, "organisation export", docPath, "organisation export exclusion wording");
assertIncludes(doc, "broad legal rewrite", docPath, "legal rewrite exclusion wording");
assertIncludes(doc, "The policy does not alter engine truth.", docPath, "engine truth invariant");
assertIncludes(doc, "node --test test/s_v1_r_03_retention_access_window_policy.test.mjs", docPath, "target test proof");
assertIncludes(doc, "node ci/guards/s_v1_r_03_retention_access_window_policy_guard.mjs", docPath, "target guard proof");

assertIncludes(tests, "allows product access inside an active controlled-launch access window", testPath, "access window test");
assertIncludes(tests, "keeps source-bound own-data export separate from paid product access", testPath, "source-bound export test");
assertIncludes(tests, "refuses enterprise retention and organisation export fields", testPath, "broad scope refusal test");
assertIncludes(tests, "policy does not alter engine input or output probes", testPath, "no-coupling test");

if (packageJson?.scripts) {
  const lintFastInline = String(packageJson.scripts["lint:fast:inline"] ?? "");
  const lintFast = String(packageJson.scripts["lint:fast"] ?? "");

  assertIncludes(lintFastInline, "node --test test/s_v1_r_03_retention_access_window_policy.test.mjs", "package.json", "lint:fast:inline test entry");
  assertIncludes(lintFastInline, "node ci/guards/s_v1_r_03_retention_access_window_policy_guard.mjs", "package.json", "lint:fast:inline guard entry");
  assertIncludes(lintFast, "node ci/guards/s_v1_r_03_retention_access_window_policy_guard.mjs", "package.json", "lint:fast guard entry");
} else {
  fail("package.json scripts missing.");
}

if (failures.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    guard: guardMeta.id,
    token: TOKEN,
    failures
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    guard: guardMeta.id,
    token: TOKEN,
    checked_files: REQUIRED_FILES
  }, null, 2));
}