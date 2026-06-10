import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const copyModule = await import("../src/ui/copy/founder_demo_copy.ts");
const { FOUNDER_DEMO_COPY } = copyModule;

const bannedRegexes = [
  /\bsafer?\b/i,
  /\bsafety\b/i,
  /\bsuitable\b/i,
  /\bright for you\b/i,
  /\bideal for you\b/i,
  /\btailored?\b/i,
  /\bpersonal(?:ised|ized)\b/i,
  /\boptim(?:ise|ize|ised|ized|ization|isation)\b/i,
  /\bimprov(?:e|ed|ement)\b/i,
  /\brecommend(?:ed|ation)?\b/i,
  /\bbest\b/i,
  /\bbetter results?\b/i,
  /\bprotect(?:ion)?\b/i,
  /\bprevent(?:ion)?\b/i,
  /\brecover(?:y)?\b/i,
  /\brehab(?:ilitation)?\b/i,
  /\bfix(?:ed|es)?\b/i,
  /\bcorrect(?:ed|ion)?\b/i,
  /\breadiness\b/i,
  /\bfatigue\b/i,
  /\bperformance insight\b/i,
  /\badherence\b/i,
];

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), "utf8"));
}

function mustRead(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function hasFounderDemoCopyUsage(text) {
  return text.includes("FOUNDER_DEMO_COPY") || text.includes("founder_demo_copy");
}

test("founder demo copy registry is pinned and non-empty", () => {
  const keys = Object.keys(FOUNDER_DEMO_COPY).sort();
  assert.deepEqual(keys, [
    "action_not_permitted",
    "based_on_declarations",
    "continue_where_left_off",
    "demo_title",
    "extra_work_recorded",
    "no_executable_session",
    "no_options_current_setup",
    "option_not_available_current_setup",
    "session_ready",
    "skip_and_move_on",
    "stop_recorded",
    "substitution_required",
    "summary_completed",
    "summary_extra_work",
    "summary_remaining",
    "summary_runtime_events",
    "summary_skipped",
    "summary_title",
    "using_available_equipment",
    "within_declared_limits",
    "work_dropped",
  ]);
  for (const value of Object.values(FOUNDER_DEMO_COPY)) {
    assert.equal(typeof value, "string");
    assert.ok(value.length > 0);
  }
});

test("founder demo copy registry contains no banned semantic drift", () => {
  for (const [key, value] of Object.entries(FOUNDER_DEMO_COPY)) {
    for (const rx of bannedRegexes) {
      assert.equal(rx.test(value), false, `banned founder demo copy drift: ${key} => ${value}`);
    }
  }
});

test("founder demo scope file exists and is non-empty", () => {
  const scope = readJson("ci/locks/founder_demo_copy_scope.json");
  assert.equal(scope.schema_version, "kolosseum.founder_demo_copy_scope.v1.0.0");
  assert.ok(Array.isArray(scope.paths));
  assert.ok(scope.paths.length > 0, "founder demo scope discovery produced no files; add founder/demo markers or update scope generation.");
});

test("scoped founder demo files reference founder demo copy registry", () => {
  const scope = readJson("ci/locks/founder_demo_copy_scope.json");
  for (const relPath of scope.paths) {
    const text = mustRead(relPath);
    assert.equal(hasFounderDemoCopyUsage(text), true, `founder demo file missing founder demo copy registry usage: ${relPath}`);
  }
});

test("scoped founder demo files contain no banned inline unsafe copy", () => {
  const scope = readJson("ci/locks/founder_demo_copy_scope.json");
  for (const relPath of scope.paths) {
    const text = mustRead(relPath);
    for (const rx of bannedRegexes) {
      assert.equal(rx.test(text), false, `banned founder demo inline copy drift in ${relPath} for ${rx}`);
    }
  }
});