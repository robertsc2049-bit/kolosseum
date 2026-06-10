import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifyPromotionReadinessFreezeStateBinding } from "../ci/scripts/run_promotion_readiness_freeze_state_binding_verifier.mjs";

function writeJson(dir, name, value) {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
  return filePath;
}

function runCase(t, readinessDoc, freezeStateDoc) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p112-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const readinessPath = writeJson(dir, "readiness.json", readinessDoc);
  const freezeStatePath = writeJson(dir, "freeze-state.json", freezeStateDoc);

  return verifyPromotionReadinessFreezeStateBinding({
    readinessPath,
    freezeStatePath,
  });
}

test("passes when readiness consumes sealed freeze state", (t) => {
  const result = runCase(
    t,
    {
      readiness: "ok"
    },
    {
      schema_version: "kolosseum.freeze_state_declaration.v1",
      freeze_state: "sealed",
      freeze_declared: true,
      freeze_state_declared_by: "registry_seal_lifecycle",
      previous_freeze_state: "pre_seal"
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.freeze_state, "sealed");
});

test("fails when freeze state file is absent or malformed", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p112-missing-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const readinessPath = writeJson(dir, "readiness.json", { readiness: "ok" });
  const freezeStatePath = path.join(dir, "freeze-state.json");

  const result = verifyPromotionReadinessFreezeStateBinding({
    readinessPath,
    freezeStatePath,
  });

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_PROMOTION_READINESS_FREEZE_STATE_INVALID");
  assert.match(result.failures[0].details, /failed to read json/i);
});

test("fails when freeze state is pre_seal", (t) => {
  const result = runCase(
    t,
    {
      readiness: "ok"
    },
    {
      schema_version: "kolosseum.freeze_state_declaration.v1",
      freeze_state: "pre_seal",
      freeze_declared: true,
      freeze_state_declared_by: "registry_seal_lifecycle"
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_PROMOTION_READINESS_FREEZE_STATE_INVALID");
  assert.match(result.failures[0].details, /requires freeze_state 'sealed'/i);
});

test("fails when freeze_declared is not true", (t) => {
  const result = runCase(
    t,
    {
      readiness: "ok"
    },
    {
      schema_version: "kolosseum.freeze_state_declaration.v1",
      freeze_state: "sealed",
      freeze_declared: false,
      freeze_state_declared_by: "registry_seal_lifecycle"
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_PROMOTION_READINESS_FREEZE_STATE_INVALID");
  assert.match(result.failures[0].details, /freeze_declared=true/i);
});

test("fails when freeze_state_declared_by is empty", (t) => {
  const result = runCase(
    t,
    {
      readiness: "ok"
    },
    {
      schema_version: "kolosseum.freeze_state_declaration.v1",
      freeze_state: "sealed",
      freeze_declared: true,
      freeze_state_declared_by: ""
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_PROMOTION_READINESS_FREEZE_STATE_INVALID");
  assert.match(result.failures[0].details, /freeze_state_declared_by/i);
});

test("repo promotion readiness and freeze state pass verifier", () => {
  const readinessPath = path.resolve("docs/releases/V1_PROMOTION_READINESS.json");
  const freezeStatePath = path.resolve("docs/releases/V1_FREEZE_STATE.json");

  const result = verifyPromotionReadinessFreezeStateBinding({
    readinessPath,
    freezeStatePath,
  });

  assert.equal(result.ok, true);
  assert.equal(result.freeze_state, "sealed");
});