import test from "node:test";
import assert from "node:assert/strict";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import schema from "../ci/schemas/phase4.output.schema.v1.0.0.json" assert { type: "json" };

import * as P3 from "../engine/src/phases/phase3.js";
import * as P4 from "../engine/src/phases/phase4.js";

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

async function phase4FromActivity(activity) {
  // Minimal Phase3-shaped input to Phase4.
  // If your Phase4 expects more, add it here once and keep it minimal.
  const p3 = {
    ok: true,
    constraints: {},
    activity,
  };

  // If Phase4 requires full Phase3 output, route through Phase3.
  // If it accepts a minimal stub, this will still work.
  const o3 = (typeof P3.phase3 === "function")
    ? await P3.phase3(p3)
    : p3;

  // Some phase modules export different names; Phase4 in your repo is already used in tests,
  // so prefer the canonical export first.
  const phase4Fn =
    P4.phase4 ||
    P4.runPhase4 ||
    P4.runPHASE4 ||
    P4.default;

  assert.equal(typeof phase4Fn, "function", "Phase4 function export not found.");

  return await phase4Fn(o3);
}

test("Phase4 output conforms to schema (powerlifting)", async () => {
  const ajv = makeAjv();
  const out = await phase4FromActivity("powerlifting");
  validateOrDie(ajv, out);
});

test("Phase4 output conforms to schema (rugby_union)", async () => {
  const ajv = makeAjv();
  const out = await phase4FromActivity("rugby_union");
  validateOrDie(ajv, out);
});

test("Phase4 output conforms to schema (general_strength)", async () => {
  const ajv = makeAjv();
  const out = await phase4FromActivity("general_strength");
  validateOrDie(ajv, out);
});

test("Phase4 output conforms to schema (unsupported activity)", async () => {
  const ajv = makeAjv();
  const out = await phase4FromActivity("unsupported_activity");
  validateOrDie(ajv, out);

  // sanity: unsupported should still be ok=false OR ok=true stub depending on your contract.
  assert.equal(typeof out.ok, "boolean");
});
