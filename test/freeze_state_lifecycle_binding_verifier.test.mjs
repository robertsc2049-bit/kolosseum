import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  verifyFreezeStateLifecycleBinding,
  extractLifecycleState,
} from "../ci/scripts/run_freeze_state_lifecycle_binding_verifier.mjs";

function writeJson(dir, name, value) {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
  return filePath;
}

function writeText(dir, name, value) {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8");
  return filePath;
}

function runCase(t, freezeStateDoc, lifecycleText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p111-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const freezeStatePath = writeJson(dir, "freeze-state.json", freezeStateDoc);
  const lifecyclePath = writeText(dir, "lifecycle.md", lifecycleText);

  return verifyFreezeStateLifecycleBinding({
    freezeStatePath,
    lifecyclePath,
  });
}

test("extractLifecycleState resolves mode json line", () => {
  assert.equal(extractLifecycleState('{\"mode\":\"sealed\"}'), "sealed");
});

test("extractLifecycleState ignores loose mention without explicit state marker", () => {
  assert.equal(extractLifecycleState("This document discusses pre_seal and sealed states generally."), null);
});

test("passes when freeze state matches lifecycle state", (t) => {
  const result = runCase(
    t,
    {
      schema_version: "kolosseum.freeze_state_declaration.v1",
      freeze_state: "sealed",
      freeze_declared: true,
      freeze_state_declared_by: "registry_seal_lifecycle",
      previous_freeze_state: "pre_seal"
    },
    [
      "Some lifecycle notes.",
      "{",
      "  \"ok\": true,",
      "  \"mode\": \"sealed\",",
      "  \"enforced\": true",
      "}"
    ].join("\n")
  );

  assert.equal(result.ok, true);
  assert.equal(result.freeze_state, "sealed");
  assert.equal(result.lifecycle_state, "sealed");
});

test("fails when freeze state contradicts lifecycle state", (t) => {
  const result = runCase(
    t,
    {
      schema_version: "kolosseum.freeze_state_declaration.v1",
      freeze_state: "pre_seal",
      freeze_declared: true,
      freeze_state_declared_by: "registry_seal_lifecycle"
    },
    "{ \"mode\": \"sealed\" }"
  );

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_FREEZE_STATE_LIFECYCLE_BINDING_INVALID");
  assert.match(result.failures[0].details, /contradicts lifecycle state/i);
});

test("fails when previous state attempts illegal reverse transition", (t) => {
  const result = runCase(
    t,
    {
      schema_version: "kolosseum.freeze_state_declaration.v1",
      freeze_state: "pre_seal",
      freeze_declared: true,
      freeze_state_declared_by: "registry_seal_lifecycle",
      previous_freeze_state: "sealed"
    },
    "{ \"mode\": \"pre_seal\" }"
  );

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_FREEZE_STATE_LIFECYCLE_BINDING_INVALID");
  assert.match(result.failures[0].details, /reverse transition is illegal/i);
});

test("fails when lifecycle state cannot be resolved", (t) => {
  const result = runCase(
    t,
    {
      schema_version: "kolosseum.freeze_state_declaration.v1",
      freeze_state: "sealed",
      freeze_declared: true,
      freeze_state_declared_by: "registry_seal_lifecycle"
    },
    "No valid lifecycle state here."
  );

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_FREEZE_STATE_LIFECYCLE_BINDING_INVALID");
  assert.match(result.failures[0].details, /could not resolve/i);
});

test("repo freeze state and lifecycle pass binding verifier", () => {
  const freezeStatePath = path.resolve("docs/releases/V1_FREEZE_STATE.json");
  const lifecyclePath = path.resolve("docs/releases/V1_REGISTRY_SEAL_LIFECYCLE.md");

  const result = verifyFreezeStateLifecycleBinding({
    freezeStatePath,
    lifecyclePath,
  });

  assert.equal(result.ok, true);
  assert.equal(result.freeze_state, "sealed");
  assert.equal(result.lifecycle_state, "sealed");
});