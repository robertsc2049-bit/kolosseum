import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifyFreezeStateDeclaration } from "../ci/scripts/run_freeze_state_declaration_verifier.mjs";

function writeJson(dir, name, value) {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
  return filePath;
}

function runCase(t, value) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p110-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const statePath = writeJson(dir, "freeze-state.json", value);
  return verifyFreezeStateDeclaration({ statePath });
}

test("passes when declaration is well-formed and uses allowed freeze state", (t) => {
  const result = runCase(t, {
    schema_version: "kolosseum.freeze_state_declaration.v1",
    freeze_state: "sealed",
    freeze_declared: true,
    freeze_state_declared_by: "registry_seal_lifecycle",
    notes: "ok"
  });

  assert.equal(result.ok, true);
  assert.equal(result.freeze_state, "sealed");
});

test("fails when freeze_state is unknown", (t) => {
  const result = runCase(t, {
    schema_version: "kolosseum.freeze_state_declaration.v1",
    freeze_state: "frozenish",
    freeze_declared: true,
    freeze_state_declared_by: "registry_seal_lifecycle"
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_FREEZE_STATE_DECLARATION_INVALID");
  assert.match(result.failures[0].details, /unknown/i);
});

test("fails when required field is missing", (t) => {
  const result = runCase(t, {
    schema_version: "kolosseum.freeze_state_declaration.v1",
    freeze_state: "sealed",
    freeze_declared: true
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_FREEZE_STATE_DECLARATION_INVALID");
  assert.match(result.failures[0].details, /freeze_state_declared_by/i);
});

test("fails when declaration contains unknown field", (t) => {
  const result = runCase(t, {
    schema_version: "kolosseum.freeze_state_declaration.v1",
    freeze_state: "sealed",
    freeze_declared: true,
    freeze_state_declared_by: "registry_seal_lifecycle",
    extra_field: "illegal"
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_FREEZE_STATE_DECLARATION_INVALID");
  assert.match(result.failures[0].details, /unknown field/i);
});

test("repo freeze state artefact passes verifier", () => {
  const statePath = path.resolve("docs/releases/V1_FREEZE_STATE.json");
  const result = verifyFreezeStateDeclaration({ statePath });

  assert.equal(result.ok, true);
  assert.equal(result.freeze_state, "sealed");
});