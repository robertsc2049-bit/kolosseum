
// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  materialiseFirstExecutableSession,
  stableCanonicalJson,
  type FirstExecutableSessionMaterialisationInput,
} from "./firstExecutableSessionStub";

const fixtureDir = path.join(process.cwd(), "engine/session/__fixtures__/s32_first_executable_session");

function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8")) as T;
}

function readText(name: string): string {
  return fs.readFileSync(path.join(fixtureDir, name), "utf8").trim();
}

test("S32 golden fixture passes byte-equivalence", () => {
  const input = readJson<FirstExecutableSessionMaterialisationInput>("golden_input.json");
  const expected = readText("golden_expected_output.canon.json");

  const output = materialiseFirstExecutableSession(input);
  const actual = stableCanonicalJson(output);

  assert.equal(actual, expected);
});

test("S32 repeats identical accepted declaration with byte-identical output", () => {
  const input = readJson<FirstExecutableSessionMaterialisationInput>("golden_input.json");

  const first = stableCanonicalJson(materialiseFirstExecutableSession(input));
  const second = stableCanonicalJson(materialiseFirstExecutableSession(input));
  const third = stableCanonicalJson(materialiseFirstExecutableSession(input));

  assert.equal(first, second);
  assert.equal(second, third);
});

test("S32 payment-only input changes do not alter output", () => {
  const base = readJson<FirstExecutableSessionMaterialisationInput>("golden_input.json");
  const changed = readJson<FirstExecutableSessionMaterialisationInput>("negative_payment_changed_only.json");

  const baseOutput = stableCanonicalJson(materialiseFirstExecutableSession(base));
  const changedOutput = stableCanonicalJson(materialiseFirstExecutableSession(changed));

  assert.equal(changedOutput, baseOutput);
});

test("S32 coach-metadata-only input changes do not alter output", () => {
  const base = readJson<FirstExecutableSessionMaterialisationInput>("golden_input.json");
  const changed = readJson<FirstExecutableSessionMaterialisationInput>("negative_coach_metadata_changed_only.json");

  const baseOutput = stableCanonicalJson(materialiseFirstExecutableSession(base));
  const changedOutput = stableCanonicalJson(materialiseFirstExecutableSession(changed));

  assert.equal(changedOutput, baseOutput);
});

test("S32 presentation-only input changes do not alter output", () => {
  const base = readJson<FirstExecutableSessionMaterialisationInput>("golden_input.json");
  const changed = readJson<FirstExecutableSessionMaterialisationInput>("negative_presentation_changed_only.json");

  const baseOutput = stableCanonicalJson(materialiseFirstExecutableSession(base));
  const changedOutput = stableCanonicalJson(materialiseFirstExecutableSession(changed));

  assert.equal(changedOutput, baseOutput);
});

test("S32 missing accepted declaration fails before materialisation", () => {
  const badInput = readJson<FirstExecutableSessionMaterialisationInput>("negative_missing_accepted_declaration.json");

  assert.throws(
    () => materialiseFirstExecutableSession(badInput),
    /S32_MISSING_ACCEPTED_DECLARATION/,
  );
});

test("S32 non-accepted declaration fails before materialisation", () => {
  const input = readJson<FirstExecutableSessionMaterialisationInput>("golden_input.json") as any;
  input.accepted_declaration.status = "pending";

  assert.throws(
    () => materialiseFirstExecutableSession(input),
    /S32_DECLARATION_NOT_ACCEPTED/,
  );
});

test("S32 unsupported activity fails before materialisation", () => {
  const input = readJson<FirstExecutableSessionMaterialisationInput>("golden_input.json") as any;
  input.accepted_declaration.activity_id = "football_soccer";

  assert.throws(
    () => materialiseFirstExecutableSession(input),
    /S32_UNSUPPORTED_ACTIVITY/,
  );
});

test("S32 unsupported execution scope fails before materialisation", () => {
  const input = readJson<FirstExecutableSessionMaterialisationInput>("golden_input.json") as any;
  input.accepted_declaration.execution_scope = "org_managed";

  assert.throws(
    () => materialiseFirstExecutableSession(input),
    /S32_UNSUPPORTED_EXECUTION_SCOPE/,
  );
});

test("S32 output contains no Phase 7 or Phase 8 evidence/export fields", () => {
  const input = readJson<FirstExecutableSessionMaterialisationInput>("golden_input.json");
  const output = materialiseFirstExecutableSession(input);
  const bytes = stableCanonicalJson(output);

  assert.equal(bytes.includes("phase7"), false);
  assert.equal(bytes.includes("phase8"), false);
  assert.equal(bytes.includes("evidence"), false);
  assert.equal(bytes.includes("export"), false);
  assert.equal(bytes.includes("replay_verdict"), false);
});
