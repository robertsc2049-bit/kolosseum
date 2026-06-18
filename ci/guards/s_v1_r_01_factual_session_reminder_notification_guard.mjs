// @law: Repo Governance
// @severity: medium
// @scope: repo
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TOKEN = "CI_V1_FACTUAL_SESSION_REMINDER_NOTIFICATION";

export const guardMeta = Object.freeze({
  id: "s_v1_r_01_factual_session_reminder_notification_guard",
  slice: "S-V1-R-01",
  title: "Factual Session Reminder Notification Guard",
  token: TOKEN,
  owner: "ci",
  description: "Asserts the factual session reminder notification remains deliberately activated, copy-linted, and outside engine truth.",
  files: Object.freeze([
    "src/v1FactualSessionReminderNotification.mjs",
    "copy/session_reminder_notification_copy.json",
    "docs/v1/V1_FACTUAL_SESSION_REMINDER_NOTIFICATION.md",
    "test/s_v1_r_01_factual_session_reminder_notification.test.mjs"
  ])
});

const REQUIRED_FILES = [
  "src/v1FactualSessionReminderNotification.mjs",
  "copy/session_reminder_notification_copy.json",
  "docs/v1/V1_FACTUAL_SESSION_REMINDER_NOTIFICATION.md",
  "test/s_v1_r_01_factual_session_reminder_notification.test.mjs",
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

const sourcePath = "src/v1FactualSessionReminderNotification.mjs";
const copyPath = "copy/session_reminder_notification_copy.json";
const docPath = "docs/v1/V1_FACTUAL_SESSION_REMINDER_NOTIFICATION.md";
const testPath = "test/s_v1_r_01_factual_session_reminder_notification.test.mjs";

const source = readText(sourcePath);
const doc = readText(docPath);
const tests = readText(testPath);
const packageJson = readJson("package.json");
const copySurface = readJson(copyPath);

assertIncludes(source, "createFactualSessionReminderScheduleRecord", sourcePath, "schedule record export");
assertIncludes(source, "handleFactualSessionReminderScheduleRecord", sourcePath, "handler export");
assertIncludes(source, "compileIgnoringFactualSessionReminderNotification", sourcePath, "no-coupling compile probe export");
assertIncludes(source, "deliberately_activated !== true", sourcePath, "deliberate activation gate");
assertIncludes(source, "reads_engine_input: false", sourcePath, "engine input read boundary");
assertIncludes(source, "writes_engine_input: false", sourcePath, "engine input write boundary");
assertIncludes(source, "mutates_engine_output: false", sourcePath, "engine output mutation boundary");
assertIncludes(source, "mutates_runtime_events: false", sourcePath, "runtime event mutation boundary");
assertIncludes(source, "triggers_substitution: false", sourcePath, "substitution boundary");

assertNotMatches(source, /from\s+["'][^"']*(?:engine|runtime|substitution|phase1|phase2|phase3|phase4|phase5|phase6)[^"']*["']/i, sourcePath, "engine import");
assertNotMatches(source, /import\s*\([^)]*(?:engine|runtime|substitution|phase1|phase2|phase3|phase4|phase5|phase6)/i, sourcePath, "dynamic engine import");
assertNotMatches(source, /\b(?:appendRuntimeEvent|emitRuntimeEvent|runPipeline|phase2CanonicaliseAndHash|phase3ResolveConstraints|phase4AssembleProgram|phase5|phase6ProduceSessionOutput)\b/, sourcePath, "engine callsite");

if (copySurface) {
  if (copySurface.surface_id !== "v1_factual_session_reminder_notification") {
    fail(`${copyPath} has wrong surface_id.`);
  }

  if (!Array.isArray(copySurface.entries)) {
    fail(`${copyPath} entries must be an array.`);
  } else {
    const ids = new Set(copySurface.entries.map((entry) => entry.copy_id));
    for (const copyId of [
      "SESSION_REMINDER_NOTIFICATION_SUBJECT",
      "SESSION_REMINDER_NOTIFICATION_BODY",
      "SESSION_REMINDER_NOTIFICATION_BOUNDARY"
    ]) {
      if (!ids.has(copyId)) {
        fail(`${copyPath} missing copy_id ${copyId}`);
      }
    }

    const copyText = copySurface.entries.map((entry) => String(entry.text ?? "")).join("\n").toLowerCase();
    for (const blocked of [
      joined("reco", "mmend", "ed"),
      joined("reco", "mmend", "ation"),
      joined("opti", "mal"),
      joined("read", "y"),
      joined("readi", "ness"),
      joined("sa", "fe"),
      joined("sa", "fe", "ty"),
      joined("suit", "able"),
      joined("suit", "ability")
    ]) {
      if (copyText.includes(blocked)) {
        fail(`${copyPath} contains forbidden claim term: ${blocked}`);
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
    triggers_substitution: false
  })) {
    if (boundary[key] !== expected) {
      fail(`${copyPath} engine_boundary.${key} must be ${expected}`);
    }
  }
}

assertIncludes(doc, "deliberately activated", docPath, "deliberate activation wording");
assertIncludes(doc, "cannot alter engine input, engine output, runtime events, replay, proof, substitution, factual history, or coach-athlete relationship authority", docPath, "no-coupling wording");
assertIncludes(doc, "notification copy lint", docPath, "copy lint proof");

assertIncludes(tests, "requires deliberate activation", testPath, "activation test");
assertIncludes(tests, "does not alter engine input or output probes", testPath, "no-coupling test");
assertIncludes(tests, "copy lint blocks forbidden claim terms", testPath, "copy lint test");

if (packageJson?.scripts) {
  const lintFastInline = String(packageJson.scripts["lint:fast:inline"] ?? "");
  const lintFast = String(packageJson.scripts["lint:fast"] ?? "");

  assertIncludes(lintFastInline, "node --test test/s_v1_r_01_factual_session_reminder_notification.test.mjs", "package.json", "lint:fast:inline test entry");
  assertIncludes(lintFastInline, "node ci/guards/s_v1_r_01_factual_session_reminder_notification_guard.mjs", "package.json", "lint:fast:inline guard entry");
  assertIncludes(lintFast, "node ci/guards/s_v1_r_01_factual_session_reminder_notification_guard.mjs", "package.json", "lint:fast guard entry");
} else {
  fail("package.json scripts missing.");
}

if (failures.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    guard: guardMeta.id,
    failures
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    guard: guardMeta.id,
    checked_files: REQUIRED_FILES
  }, null, 2));
}
