import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repo = process.cwd();
const helperSourcePath = path.join(repo, "engine", "src", "contracts", "canonical_failure.ts");
const runnerSourcePath = path.join(repo, "src", "run_pipeline.ts");
const positiveFixturePath = path.join(repo, "test", "fixtures", "phase1_to_phase6.valid.general_strength.individual.json");
const negativeFixturePath = path.join(repo, "test", "fixtures", "phase1_to_phase6.invalid.unsupported-activity.json");

function hasBuiltRunner() {
  const candidates = [
    path.join(repo, "dist", "src", "run_pipeline.js"),
    path.join(repo, "dist", "engine", "src", "run_pipeline.js"),
    path.join(repo, "dist", "run_pipeline.js")
  ];

  return candidates.some((candidate) => fs.existsSync(candidate));
}

function hasBuiltHelper() {
  const helperPath = path.join(repo, "dist", "engine", "src", "contracts", "canonical_failure.js");
  return fs.existsSync(helperPath);
}

async function importBuiltRunner() {
  const candidates = [
    path.join(repo, "dist", "src", "run_pipeline.js"),
    path.join(repo, "dist", "engine", "src", "run_pipeline.js"),
    path.join(repo, "dist", "run_pipeline.js")
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    return import(pathToFileURL(candidate).href);
  }

  throw new Error("built run_pipeline.js not found");
}

async function importBuiltHelper() {
  const helperPath = path.join(repo, "dist", "engine", "src", "contracts", "canonical_failure.js");
  if (!fs.existsSync(helperPath)) {
    throw new Error("built canonical_failure.js not found");
  }

  return import(pathToFileURL(helperPath).href);
}

test("failure token canonical source contract: helper exists and run_pipeline uses canonical failure enforcement", () => {
  const helperSrc = fs.readFileSync(helperSourcePath, "utf8");
  const runnerSrc = fs.readFileSync(runnerSourcePath, "utf8");

  assert.equal(fs.existsSync(helperSourcePath), true, "expected canonical failure helper source to exist");
  assert.equal(fs.existsSync(runnerSourcePath), true, "expected run_pipeline source to exist");

  assert.match(helperSrc, /export const CANONICAL_FAILURE_TOKENS = \[/, "expected canonical failure token allowlist");
  assert.match(helperSrc, /assertCanonicalFailureEnvelope/, "expected canonical failure assertion");
  assert.match(helperSrc, /assertCanonicalSuccessEnvelope/, "expected canonical success assertion");
  assert.match(helperSrc, /coerceCanonicalFailureEnvelope/, "expected canonical failure coercion");
  assert.match(runnerSrc, /canonicalFailure/, "expected run_pipeline to use canonical failure helper");
  assert.match(runnerSrc, /coerceCanonicalFailureEnvelope/, "expected run_pipeline to coerce failures through canonical helper");
  assert.match(runnerSrc, /assertCanonicalFailureEnvelope\(out, "phase6"\)/, "expected phase6 canonical failure assertion");
  assert.match(runnerSrc, /assertCanonicalSuccessEnvelope\(out, "phase6"\)/, "expected phase6 canonical success assertion");
});

test(
  "failure token canonical runtime contract: helper accepts known tokens and rejects missing, empty, unknown, and mixed envelopes",
  { skip: !hasBuiltHelper() },
  async () => {
    const mod = await importBuiltHelper();

    assert.equal(mod.isCanonicalFailureToken("type_mismatch"), true);
    assert.equal(mod.isCanonicalFailureToken("phase6_requires_planned_items"), true);
    assert.equal(mod.isCanonicalFailureToken("totally_fake_token"), false);

    assert.doesNotThrow(() => mod.assertCanonicalFailureEnvelope({ ok: false, failure_token: "type_mismatch" }));
    assert.doesNotThrow(() => mod.assertCanonicalFailureEnvelope({ ok: false, failure_token: "type_mismatch", details: [] }));

    assert.throws(
      () => mod.assertCanonicalFailureEnvelope({ ok: false }),
      /must include failure_token/
    );

    assert.throws(
      () => mod.assertCanonicalFailureEnvelope({ ok: false, failure_token: "" }),
      /non-empty failure_token/
    );

    assert.throws(
      () => mod.assertCanonicalFailureEnvelope({ ok: false, failure_token: "totally_fake_token" }),
      /unknown canonical failure_token/
    );

    assert.throws(
      () => mod.assertCanonicalFailureEnvelope({ ok: false, failure_token: "type_mismatch", session: {} }),
      /must not mix failure envelope with extra keys/
    );

    assert.doesNotThrow(() => mod.assertCanonicalSuccessEnvelope({ ok: true, session: {} }));

    assert.throws(
      () => mod.assertCanonicalSuccessEnvelope({ ok: true, failure_token: "type_mismatch" }),
      /must not carry failure_token/
    );
  }
);

test(
  "failure token canonical runtime contract: runPipeline success has no failure_token and invalid input returns canonical failure envelope",
  { skip: !hasBuiltRunner() },
  async () => {
    const runnerMod = await importBuiltRunner();
    const runPipeline = runnerMod.runPipeline ?? runnerMod.default?.runPipeline ?? runnerMod.default;

    assert.equal(typeof runPipeline, "function", "expected built runPipeline function");

    const positiveInput = JSON.parse(fs.readFileSync(positiveFixturePath, "utf8"));
    const negativeInput = JSON.parse(fs.readFileSync(negativeFixturePath, "utf8"));

    const success = await runPipeline(positiveInput);
    assert.equal(success.ok, true, "expected positive fixture success");
    assert.equal(Object.prototype.hasOwnProperty.call(success, "failure_token"), false, "success must not carry failure_token");

    const failure = await runPipeline(negativeInput);
    assert.equal(failure.ok, false, "expected negative fixture failure");
    assert.equal(typeof failure.failure_token, "string", "expected failure_token string");
    assert.equal(failure.failure_token.length > 0, true, "expected non-empty failure_token");
    assert.deepEqual(Object.keys(failure).sort(), ["details", "failure_token", "ok"], "expected canonical failure envelope shape");
  }
);
