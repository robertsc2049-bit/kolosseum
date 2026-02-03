import test from "node:test";
import assert from "node:assert/strict";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import schema from "../ci/schemas/phase4.output.schema.v1.0.0.json" with { type: "json" };

// Phase4 is compiled under dist/engine/... (node runs .mjs tests, so import JS output).
import { phase4AssembleProgram } from "../dist/engine/src/phases/phase4.js";

function makeAjv() {
  const ajv = new Ajv({
    allErrors: true,
    strict: true,
    strictRequired: false,
  });
  addFormats(ajv);
  ajv.addSchema(schema, "phase4.output.schema.v1.0.0.json");
  return ajv;
}

function validateOrDie(ajv, value) {
  const ok = ajv.validate("phase4.output.schema.v1.0.0.json", value);
  if (!ok) {
    const msg = JSON.stringify(ajv.errors, null, 2);
    assert.fail(`Phase4 output failed schema validation:\n${msg}`);
  }
}

function runPhase4ForActivity(activity_id) {
  // IMPORTANT:
  // phase4AssembleProgram signature is (canonicalInput, phase3).
  // If you call the default export with one argument, phase3 is undefined and will crash.
  const canonicalInput = {
    activity_id,
    // keep minimal; add fields here only if Phase4 contract grows.
  };

  // Minimal Phase3 payload: Phase4 currently only needs constraints carried forward.
  const phase3 = {
    constraints: {},
  };

  return phase4AssembleProgram(canonicalInput, phase3);
}

test("Phase4 output conforms to schema (powerlifting)", () => {
  const ajv = makeAjv();
  const out = runPhase4ForActivity("powerlifting");
  validateOrDie(ajv, out);
});

test("Phase4 output conforms to schema (rugby_union)", () => {
  const ajv = makeAjv();
  const out = runPhase4ForActivity("rugby_union");
  validateOrDie(ajv, out);
});

test("Phase4 output conforms to schema (general_strength)", () => {
  const ajv = makeAjv();
  const out = runPhase4ForActivity("general_strength");
  validateOrDie(ajv, out);
});

test("Phase4 output conforms to schema (unsupported activity)", () => {
  const ajv = makeAjv();
  const out = runPhase4ForActivity("unsupported_activity");
  validateOrDie(ajv, out);

  // sanity
  assert.equal(typeof out.ok, "boolean");
});