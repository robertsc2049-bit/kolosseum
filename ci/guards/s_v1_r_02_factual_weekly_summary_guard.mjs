// @law: Repo Governance
// @severity: medium
// @scope: repo
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TOKEN = "CI_V1_FACTUAL_WEEKLY_SUMMARY";

export const guardMeta = Object.freeze({
  id: "s_v1_r_02_factual_weekly_summary_guard",
  slice: "S-V1-R-02",
  title: "Factual Weekly Summary Guard",
  token: TOKEN,
  owner: "ci",
  description: "Asserts the factual weekly summary remains deliberately activated, copy-linted, and limited to recorded facts.",
  files: Object.freeze([
    "src/v1FactualWeeklySummary.mjs",
    "copy/weekly_summary_copy.json",
    "docs/v1/V1_FACTUAL_WEEKLY_SUMMARY.md",
    "test/s_v1_r_02_factual_weekly_summary.test.mjs"
  ])
});

const REQUIRED_FILES = [
  "src/v1FactualWeeklySummary.mjs",
  "copy/weekly_summary_copy.json",
  "docs/v1/V1_FACTUAL_WEEKLY_SUMMARY.md",
  "test/s_v1_r_02_factual_weekly_summary.test.mjs",
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

function joined(...parts) {
  return parts.join("");
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

const sourcePath = "src/v1FactualWeeklySummary.mjs";
const copyPath = "copy/weekly_summary_copy.json";
const docPath = "docs/v1/V1_FACTUAL_WEEKLY_SUMMARY.md";
const testPath = "test/s_v1_r_02_factual_weekly_summary.test.mjs";

const source = readText(sourcePath);
const doc = readText(docPath);
const tests = readText(testPath);
const packageJson = readJson("package.json");
const copySurface = readJson(copyPath);

assertIncludes(source, "createFactualWeeklySummaryActivationRecord", sourcePath, "activation record export");
assertIncludes(source, "generateFactualWeeklySummary", sourcePath, "summary generator export");
assertIncludes(source, "compileIgnoringFactualWeeklySummary", sourcePath, "no-coupling compile probe export");
assertIncludes(source, "deliberately_activated !== true", sourcePath, "deliberate activation gate");
assertIncludes(source, "recorded_session_count", sourcePath, "recorded session count");
assertIncludes(source, "completed_work_item_count", sourcePath, "completed work item count");
assertIncludes(source, "reads_engine_input: false", sourcePath, "engine input read boundary");
assertIncludes(source, "writes_engine_input: false", sourcePath, "engine input write boundary");
assertIncludes(source, "mutates_engine_output: false", sourcePath, "engine output mutation boundary");
assertIncludes(source, "mutates_runtime_events: false", sourcePath, "runtime event mutation boundary");
assertIncludes(source, "triggers_substitution: false", sourcePath, "substitution boundary");
assertIncludes(source, "emits_score: false", sourcePath, "score boundary");
assertIncludes(source, "emits_comparison_order: false", sourcePath, "comparison order boundary");

assertNotMatches(source, /from\s+["'][^"']*(?:engine|runtime|substitution|phase1|phase2|phase3|phase4|phase5|phase6)[^"']*["']/i, sourcePath, "engine import");
assertNotMatches(source, /import\s*\([^)]*(?:engine|runtime|substitution|phase1|phase2|phase3|phase4|phase5|phase6)/i, sourcePath, "dynamic engine import");
assertNotMatches(source, /\b(?:appendRuntimeEvent|emitRuntimeEvent|runPipeline|phase2CanonicaliseAndHash|phase3ResolveConstraints|phase4AssembleProgram|phase5|phase6ProduceSessionOutput)\b/, sourcePath, "engine callsite");

if (copySurface) {
  if (copySurface.surface_id !== "v1_factual_weekly_summary") {
    fail(`${copyPath} has wrong surface_id.`);
  }

  if (!Array.isArray(copySurface.entries)) {
    fail(`${copyPath} entries must be an array.`);
  } else {
    const ids = new Set(copySurface.entries.map((entry) => entry.copy_id));
    for (const copyId of [
      "FACTUAL_WEEKLY_SUMMARY_TITLE",
      "FACTUAL_WEEKLY_SUMMARY_EMPTY",
      "FACTUAL_WEEKLY_SUMMARY_BOUNDARY"
    ]) {
      if (!ids.has(copyId)) {
        fail(`${copyPath} missing copy_id ${copyId}`);
      }
    }

    const copyText = copySurface.entries.map((entry) => String(entry.text ?? "")).join("\n").toLowerCase();
    for (const blocked of [
      joined("reco", "mmend"),
      joined("opti", "mal"),
      joined("read", "y"),
      joined("readi", "ness"),
      joined("sa", "fe"),
      joined("sa", "fe", "ty"),
      joined("suit", "able"),
      joined("suit", "ability"),
      joined("ad", "vice"),
      joined("effect", "ive"),
      joined("effect", "iveness"),
      joined("rank"),
      joined("infer"),
      joined("adher", "ence"),
      joined("good"),
      joined("bad"),
      joined("poor")
    ]) {
      if (copyText.includes(blocked)) {
        fail(`${copyPath} contains forbidden judgement or claim term: ${blocked}`);
      }
    }
  }

  const boundary = copySurface.engine_boundary ?? {};
  for (const [key, expected] of Object.entries({
    reads_engine_input: false,
    writes_engine_input: false,
    mutates_engine_output: false,
    mutates_runtime_events: false,
    mutates_phase1_declaration: false,
    mutates_replay_or_proof: false,
    changes_compile_output: false,
    triggers_substitution: false,
    emits_score: false,
    emits_comparison_order: false
  })) {
    if (boundary[key] !== expected) {
      fail(`${copyPath} engine_boundary.${key} must be ${expected}`);
    }
  }
}

assertIncludes(doc, "deliberately activated", docPath, "deliberate activation wording");
assertIncludes(doc, "reports recorded facts only", docPath, "recorded facts wording");
assertIncludes(doc, "completion scoring", docPath, "excluded scoring wording");
assertIncludes(doc, "comparative ordering", docPath, "excluded comparison wording");
assertIncludes(doc, "summary fixture test", docPath, "fixture proof wording");

assertIncludes(tests, "requires deliberate activation", testPath, "activation test");
assertIncludes(tests, "summary fixture reports recorded facts only", testPath, "summary fixture test");
assertIncludes(tests, "copy lint blocks forbidden judgement and claim terms", testPath, "copy lint test");
assertIncludes(tests, "does not alter engine input or output probes", testPath, "no-coupling test");

if (packageJson?.scripts) {
  const lintFastInline = String(packageJson.scripts["lint:fast:inline"] ?? "");
  const lintFast = String(packageJson.scripts["lint:fast"] ?? "");

  assertIncludes(lintFastInline, "node --test test/s_v1_r_02_factual_weekly_summary.test.mjs", "package.json", "lint:fast:inline test entry");
  assertIncludes(lintFastInline, "node ci/guards/s_v1_r_02_factual_weekly_summary_guard.mjs", "package.json", "lint:fast:inline guard entry");
  assertIncludes(lintFast, "node ci/guards/s_v1_r_02_factual_weekly_summary_guard.mjs", "package.json", "lint:fast guard entry");
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