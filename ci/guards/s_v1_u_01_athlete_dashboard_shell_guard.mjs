// @law: Repo Governance
// @severity: medium
// @scope: repo
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TOKEN = "CI_V1_ATHLETE_DASHBOARD_SHELL";

export const guardMeta = Object.freeze({
  id: "s_v1_u_01_athlete_dashboard_shell_guard",
  slice: "S-V1-U-01",
  title: "Athlete Dashboard Shell Guard",
  token: TOKEN,
  owner: "ci",
  description: "Asserts the athlete dashboard shell remains own-data-only, factual, engine-invisible, and outside social/ranking/marketplace scope.",
  files: Object.freeze([
    "src/v1AthleteDashboardShell.mjs",
    "copy/athlete_dashboard_shell_copy.json",
    "docs/v1/V1_ATHLETE_DASHBOARD_SHELL.md",
    "test/s_v1_u_01_athlete_dashboard_shell.test.mjs"
  ])
});

const REQUIRED_FILES = [
  "src/v1AthleteDashboardShell.mjs",
  "copy/athlete_dashboard_shell_copy.json",
  "docs/v1/V1_ATHLETE_DASHBOARD_SHELL.md",
  "test/s_v1_u_01_athlete_dashboard_shell.test.mjs",
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

const sourcePath = "src/v1AthleteDashboardShell.mjs";
const copyPath = "copy/athlete_dashboard_shell_copy.json";
const docPath = "docs/v1/V1_ATHLETE_DASHBOARD_SHELL.md";
const testPath = "test/s_v1_u_01_athlete_dashboard_shell.test.mjs";

const source = readText(sourcePath);
const doc = readText(docPath);
const tests = readText(testPath);
const packageJson = readJson("package.json");
const copySurface = readJson(copyPath);

assertIncludes(source, "createAthleteDashboardShellReadModel", sourcePath, "dashboard read model export");
assertIncludes(source, "compileIgnoringAthleteDashboardShell", sourcePath, "no-coupling helper export");
assertIncludes(source, "lintAthleteDashboardShellCopy", sourcePath, "copy lint export");
assertIncludes(source, "getAthleteDashboardShellContract", sourcePath, "contract export");
assertIncludes(source, "viewer_not_subject", sourcePath, "viewer self-only blocked reason");
assertIncludes(source, "record_not_owned_by_athlete", sourcePath, "record ownership blocked reason");
assertIncludes(source, "own_assignments", sourcePath, "own assignments section");
assertIncludes(source, "own_sessions", sourcePath, "own sessions section");
assertIncludes(source, "factual_history", sourcePath, "factual history section");
assertIncludes(source, "ui_shell_only: true", sourcePath, "UI shell boundary");
assertIncludes(source, "read_model_only: true", sourcePath, "read model boundary");
assertIncludes(source, "own_data_only: true", sourcePath, "own data boundary");
assertIncludes(source, "mutates_engine_output: false", sourcePath, "engine output mutation boundary");
assertIncludes(source, "mutates_runtime_events: false", sourcePath, "runtime mutation boundary");
assertIncludes(source, "changes_compile_output: false", sourcePath, "compile output boundary");
assertIncludes(source, "triggers_substitution: false", sourcePath, "substitution boundary");
assertIncludes(source, "creates_social_feed: false", sourcePath, "social exclusion");
assertIncludes(source, "creates_friend_connections: false", sourcePath, "friend exclusion");
assertIncludes(source, "creates_rankings: false", sourcePath, "ranking exclusion");
assertIncludes(source, "creates_post_v1_exchange_surface: false", sourcePath, "post-v1 exchange-surface exclusion");

assertNotMatches(source, /from\s+["'][^"']*(?:engine|runtime|substitution|phase1|phase2|phase3|phase4|phase5|phase6)[^"']*["']/i, sourcePath, "engine import");
assertNotMatches(source, /import\s*\([^)]*(?:engine|runtime|substitution|phase1|phase2|phase3|phase4|phase5|phase6)/i, sourcePath, "dynamic engine import");
assertNotMatches(source, /\b(?:appendRuntimeEvent|emitRuntimeEvent|runPipeline|phase2CanonicaliseAndHash|phase3ResolveConstraints|phase4AssembleProgram|phase5|phase6ProduceSessionOutput)\b/, sourcePath, "engine callsite");

if (copySurface) {
  if (copySurface.surface_id !== "v1_athlete_dashboard_shell") {
    fail(`${copyPath} has wrong surface_id.`);
  }

  if (!Array.isArray(copySurface.entries)) {
    fail(`${copyPath} entries must be an array.`);
  } else {
    const ids = new Set(copySurface.entries.map((entry) => entry.copy_id));
    for (const copyId of [
      "ATHLETE_DASHBOARD_SHELL_TITLE",
      "ATHLETE_DASHBOARD_ASSIGNMENTS_TITLE",
      "ATHLETE_DASHBOARD_SESSIONS_TITLE",
      "ATHLETE_DASHBOARD_FACTUAL_HISTORY_TITLE",
      "ATHLETE_DASHBOARD_EMPTY_SECTION",
      "ATHLETE_DASHBOARD_BOUNDARY"
    ]) {
      if (!ids.has(copyId)) {
        fail(`${copyPath} missing copy_id ${copyId}`);
      }
    }

    const copyText = copySurface.entries.map((entry) => String(entry.text ?? "")).join("\n").toLowerCase();
    for (const blocked of [
      joined("reco", "mmend"),
      joined("opti", "mal"),
      joined("read", "iness"),
      joined("fa", "tigue"),
      joined("ri", "sk"),
      joined("sa", "fe"),
      joined("suit", "able"),
      joined("ad", "vice"),
      joined("effect", "ive"),
      joined("adher", "ence"),
      joined("rank"),
      joined("friend"),
      joined("market", "place"),
      joined("social"),
      joined("good"),
      joined("bad"),
      joined("poor")
    ]) {
      if (copyText.includes(blocked)) {
        fail(`${copyPath} contains forbidden dashboard copy term: ${blocked}`);
      }
    }
  }

  const boundary = copySurface.engine_boundary ?? {};
  for (const [key, expected] of Object.entries({
    ui_shell_only: true,
    read_model_only: true,
    own_data_only: true,
    reads_engine_input: false,
    writes_engine_input: false,
    mutates_engine_output: false,
    mutates_runtime_events: false,
    mutates_phase1_declaration: false,
    mutates_replay_or_proof: false,
    changes_compile_output: false,
    triggers_substitution: false,
    creates_social_feed: false,
    creates_friend_connections: false,
    creates_rankings: false,
    creates_post_v1_exchange_surface: false
  })) {
    if (boundary[key] !== expected) {
      fail(`${copyPath} engine_boundary.${key} must be ${expected}`);
    }
  }
}

assertIncludes(doc, "own assignments", docPath, "own assignments wording");
assertIncludes(doc, "own sessions", docPath, "own sessions wording");
assertIncludes(doc, "factual history", docPath, "factual history wording");
assertIncludes(doc, "social feed", docPath, "social feed exclusion wording");
assertIncludes(doc, "friends", docPath, "friends exclusion wording");
assertIncludes(doc, "rankings", docPath, "rankings exclusion wording");
assertIncludes(doc, "marketplace", docPath, "marketplace exclusion wording");
assertIncludes(doc, "The shell does not alter engine truth.", docPath, "engine truth invariant");
assertIncludes(doc, "node --test test/s_v1_u_01_athlete_dashboard_shell.test.mjs", docPath, "target test proof");
assertIncludes(doc, "node ci/guards/s_v1_u_01_athlete_dashboard_shell_guard.mjs", docPath, "target guard proof");

assertIncludes(tests, "renders own assignments sessions and factual history sections", testPath, "render test");
assertIncludes(tests, "blocks dashboard access when viewer is not the athlete subject", testPath, "viewer permission test");
assertIncludes(tests, "blocks mixed-owner assignment session and factual history records", testPath, "record ownership test");
assertIncludes(tests, "copy lint permits factual shell copy", testPath, "copy lint test");
assertIncludes(tests, "dashboard shell does not alter engine input or output probes", testPath, "no-coupling test");

if (packageJson?.scripts) {
  const lintFastInline = String(packageJson.scripts["lint:fast:inline"] ?? "");
  const lintFast = String(packageJson.scripts["lint:fast"] ?? "");

  assertIncludes(lintFastInline, "node --test test/s_v1_u_01_athlete_dashboard_shell.test.mjs", "package.json", "lint:fast:inline test entry");
  assertIncludes(lintFastInline, "node ci/guards/s_v1_u_01_athlete_dashboard_shell_guard.mjs", "package.json", "lint:fast:inline guard entry");
  assertIncludes(lintFast, "node ci/guards/s_v1_u_01_athlete_dashboard_shell_guard.mjs", "package.json", "lint:fast guard entry");
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