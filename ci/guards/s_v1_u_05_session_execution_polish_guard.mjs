// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-U-05 guard boundary.
 * Purpose: proves session execution polish remains a presentation-only mobile UI surface.
 * Boundary: this guard checks docs, fixtures, package wiring, and target tests; it does not define engine behaviour.
 * Failure: missing proof or forbidden coupling markers fail the slice guard.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const GUARD = "S-V1-U-05";
const TOKEN = "CI_V1_U_05_SESSION_EXECUTION_POLISH_BOUNDARY";

const FILES = {
  source: "src/v1SessionExecutionPolish.mjs",
  test: "test/s_v1_u_05_session_execution_polish.test.mjs",
  guard: "ci/guards/s_v1_u_05_session_execution_polish_guard.mjs",
  fixture: "ci/fixtures/v1_session_execution_polish/s_v1_u_05_session_execution_polish_cases.json",
  doc: "docs/v1/V1_SESSION_EXECUTION_POLISH.md",
  releaseBoundary: "docs/v1/V1_RELEASE_BOUNDARY.md",
  acceptance: "docs/v1/V1_ACCEPTANCE_GATE.md",
  notInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  authorityMap: "docs/v1/V1_DOC_AUTHORITY_MAP.md",
  packageJson: "package.json"
};

function fail(message) {
  throw new Error(`${TOKEN}: ${message}`);
}

function read(path) {
  if (!fs.existsSync(path)) fail(`missing required file ${path}`);
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) fail(`${label} missing marker: ${needle}`);
}

function assertExcludes(text, needles, label) {
  for (const needle of needles) {
    if (text.includes(needle)) fail(`${label} contains forbidden marker: ${needle}`);
  }
}

function assertPackageWiring() {
  const pkg = JSON.parse(read(FILES.packageJson));
  for (const scriptName of ["lint:fast", "lint:fast:inline"]) {
    const script = String(pkg.scripts?.[scriptName] ?? "");
    assertIncludes(script, "node --test test/s_v1_u_05_session_execution_polish.test.mjs", `package scripts.${scriptName}`);
    assertIncludes(script, "node ci/guards/s_v1_u_05_session_execution_polish_guard.mjs", `package scripts.${scriptName}`);
  }
}

function assertFixture() {
  const fixture = JSON.parse(read(FILES.fixture));
  assert.equal(fixture.slice_id, GUARD);
  assert.equal(fixture.contract, "v1_session_execution_polish");
  assert.ok(Array.isArray(fixture.cases));
  assert.ok(fixture.cases.length >= 2);
  assert.ok(fixture.boundary.allowed.includes("accessibility_contract"));
  assert.ok(fixture.boundary.allowed.includes("nd_presentation"));
  assert.ok(fixture.boundary.forbidden.includes("engine_logic"));
  assert.ok(fixture.boundary.forbidden.includes("runtime_reducer_semantics"));
}

function assertTargetTestPasses() {
  const result = spawnSync(process.execPath, ["--test", FILES.test], {
    encoding: "utf8",
    stdio: "pipe"
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    fail(`${FILES.test} failed`);
  }
}

const source = read(FILES.source);
const tests = read(FILES.test);
const doc = read(FILES.doc);
const releaseBoundary = read(FILES.releaseBoundary);
const acceptance = read(FILES.acceptance);
const notInScope = read(FILES.notInScope);
const authorityMap = read(FILES.authorityMap);

assertIncludes(source, "renderV1SessionExecutionPolish", "source");
assertIncludes(source, "extractSessionExecutionTruth", "source");
assertIncludes(source, "lintSessionExecutionPolishCopySurface", "source");
assertIncludes(source, "presentation_only: true", "source");
assertIncludes(source, "engine_visible: false", "source");
assertIncludes(source, "engine_mutation_permitted: false", "source");
assertIncludes(source, "accessibility_contract", "source");
assertIncludes(source, "minimum_touch_target_px: MIN_TOUCH_TARGET_PX", "source");
assertIncludes(source, "SESSION_POLISH_ACTION_COMPLETE_RECORDED", "source");
assertIncludes(source, "SESSION_POLISH_ACTION_PARTIAL_RECORDED", "source");

assertExcludes(source, [
  "@kolosseum/engine",
  "../engine",
  "runPipeline",
  "applyRuntimeEvent",
  "applyEvent(",
  "registry_bundle",
  "substitution"
], "source");

assertIncludes(tests, "S-V1-U-05 renders a mobile session execution polish surface", "tests");
assertIncludes(tests, "S-V1-U-05 accessibility contract is explicit for mobile execution", "tests");
assertIncludes(tests, "S-V1-U-05 ND and low-input presentation do not alter session truth", "tests");
assertIncludes(tests, "S-V1-U-05 copy lint keeps copy IDs factual and registry-shaped", "tests");
assertIncludes(tests, "S-V1-U-05 renderer does not mutate source session state", "tests");
assertIncludes(tests, "S-V1-U-05 return decision state exposes return actions without reducer changes", "tests");

assertIncludes(doc, "Slice: S-V1-U-05.", "doc");
assertIncludes(doc, "presentation surface over existing session execution state", "doc");
assertIncludes(doc, "does not create engine truth", "doc");
assertIncludes(doc, "ND presentation state must not alter session truth", "doc");

assertIncludes(releaseBoundary, "<!-- S-V1-U-05:SESSION-EXECUTION-POLISH:START -->", "release boundary");
assertIncludes(acceptance, "<!-- S-V1-U-05:SESSION-EXECUTION-POLISH-ACCEPTANCE:START -->", "acceptance");
assertIncludes(notInScope, "<!-- S-V1-U-05:SESSION-EXECUTION-POLISH-NON-SCOPE:START -->", "not in scope");
assertIncludes(authorityMap, "<!-- S-V1-U-05:DOC-AUTHORITY:START -->", "authority map");

assertPackageWiring();
assertFixture();
assertTargetTestPasses();

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  message: "Session execution polish remains presentation-only and engine-inert."
}, null, 2));
