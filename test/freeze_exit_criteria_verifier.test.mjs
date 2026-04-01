import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifyFreezeExitCriteria } from "../ci/scripts/run_freeze_exit_criteria_verifier.mjs";

function writeJson(dir, name, value) {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
  return filePath;
}

function runCase(t, criteriaDoc, freezeStateDoc) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p113-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const criteriaPath = writeJson(dir, "criteria.json", criteriaDoc);
  const freezeStatePath = writeJson(dir, "freeze-state.json", freezeStateDoc);

  return verifyFreezeExitCriteria({
    criteriaPath,
    freezeStatePath,
  });
}

test("passes when freeze exit criteria are complete and freeze state is sealed", (t) => {
  const result = runCase(
    t,
    {
      schema_version: "kolosseum.freeze_exit_criteria.v1",
      freeze_exit_permitted: false,
      freeze_exit_declared_by: "freeze_exit_criteria_law",
      required_exit_checks: [
        "freeze_state_bound_to_lifecycle",
        "promotion_readiness_bound_to_freeze_state",
        "freeze_drift_evidence_present",
        "freeze_packaging_composition_closed_world"
      ],
      required_exit_artefacts: [
        "docs/releases/V1_FREEZE_STATE.json",
        "docs/releases/V1_FREEZE_DRIFT_EVIDENCE.json",
        "docs/releases/V1_FREEZE_PACKAGING_ARTEFACT_SET.json",
        "docs/releases/V1_PROMOTION_READINESS.json"
      ],
      allowed_exit_transition: "sealed -> released",
      notes: "ok"
    },
    {
      schema_version: "kolosseum.freeze_state_declaration.v1",
      freeze_state: "sealed",
      freeze_declared: true,
      freeze_state_declared_by: "registry_seal_lifecycle"
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.freeze_state, "sealed");
});

test("fails when required exit checks are incomplete", (t) => {
  const result = runCase(
    t,
    {
      schema_version: "kolosseum.freeze_exit_criteria.v1",
      freeze_exit_permitted: false,
      freeze_exit_declared_by: "freeze_exit_criteria_law",
      required_exit_checks: [
        "freeze_state_bound_to_lifecycle"
      ],
      required_exit_artefacts: [
        "docs/releases/V1_FREEZE_STATE.json",
        "docs/releases/V1_FREEZE_DRIFT_EVIDENCE.json",
        "docs/releases/V1_FREEZE_PACKAGING_ARTEFACT_SET.json",
        "docs/releases/V1_PROMOTION_READINESS.json"
      ],
      allowed_exit_transition: "sealed -> released",
      notes: "ok"
    },
    {
      schema_version: "kolosseum.freeze_state_declaration.v1",
      freeze_state: "sealed",
      freeze_declared: true,
      freeze_state_declared_by: "registry_seal_lifecycle"
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_FREEZE_EXIT_CRITERIA_INVALID");
  assert.match(result.failures[0].details, /required_exit_checks is incomplete/i);
});

test("fails when required exit artefacts are incomplete", (t) => {
  const result = runCase(
    t,
    {
      schema_version: "kolosseum.freeze_exit_criteria.v1",
      freeze_exit_permitted: false,
      freeze_exit_declared_by: "freeze_exit_criteria_law",
      required_exit_checks: [
        "freeze_state_bound_to_lifecycle",
        "promotion_readiness_bound_to_freeze_state",
        "freeze_drift_evidence_present",
        "freeze_packaging_composition_closed_world"
      ],
      required_exit_artefacts: [
        "docs/releases/V1_FREEZE_STATE.json"
      ],
      allowed_exit_transition: "sealed -> released",
      notes: "ok"
    },
    {
      schema_version: "kolosseum.freeze_state_declaration.v1",
      freeze_state: "sealed",
      freeze_declared: true,
      freeze_state_declared_by: "registry_seal_lifecycle"
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_FREEZE_EXIT_CRITERIA_INVALID");
  assert.match(result.failures[0].details, /required_exit_artefacts is incomplete/i);
});

test("fails when exit transition is not pinned to sealed -> released", (t) => {
  const result = runCase(
    t,
    {
      schema_version: "kolosseum.freeze_exit_criteria.v1",
      freeze_exit_permitted: false,
      freeze_exit_declared_by: "freeze_exit_criteria_law",
      required_exit_checks: [
        "freeze_state_bound_to_lifecycle",
        "promotion_readiness_bound_to_freeze_state",
        "freeze_drift_evidence_present",
        "freeze_packaging_composition_closed_world"
      ],
      required_exit_artefacts: [
        "docs/releases/V1_FREEZE_STATE.json",
        "docs/releases/V1_FREEZE_DRIFT_EVIDENCE.json",
        "docs/releases/V1_FREEZE_PACKAGING_ARTEFACT_SET.json",
        "docs/releases/V1_PROMOTION_READINESS.json"
      ],
      allowed_exit_transition: "sealed -> pre_seal",
      notes: "ok"
    },
    {
      schema_version: "kolosseum.freeze_state_declaration.v1",
      freeze_state: "sealed",
      freeze_declared: true,
      freeze_state_declared_by: "registry_seal_lifecycle"
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_FREEZE_EXIT_CRITERIA_INVALID");
  assert.match(result.failures[0].details, /allowed_exit_transition must equal 'sealed -> released'/i);
});

test("fails when freeze state is not sealed", (t) => {
  const result = runCase(
    t,
    {
      schema_version: "kolosseum.freeze_exit_criteria.v1",
      freeze_exit_permitted: false,
      freeze_exit_declared_by: "freeze_exit_criteria_law",
      required_exit_checks: [
        "freeze_state_bound_to_lifecycle",
        "promotion_readiness_bound_to_freeze_state",
        "freeze_drift_evidence_present",
        "freeze_packaging_composition_closed_world"
      ],
      required_exit_artefacts: [
        "docs/releases/V1_FREEZE_STATE.json",
        "docs/releases/V1_FREEZE_DRIFT_EVIDENCE.json",
        "docs/releases/V1_FREEZE_PACKAGING_ARTEFACT_SET.json",
        "docs/releases/V1_PROMOTION_READINESS.json"
      ],
      allowed_exit_transition: "sealed -> released",
      notes: "ok"
    },
    {
      schema_version: "kolosseum.freeze_state_declaration.v1",
      freeze_state: "pre_seal",
      freeze_declared: true,
      freeze_state_declared_by: "registry_seal_lifecycle"
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.failures[0].token, "CI_FREEZE_EXIT_CRITERIA_INVALID");
  assert.match(result.failures[0].details, /can only be evaluated from freeze_state 'sealed'/i);
});

test("repo freeze exit criteria and freeze state pass verifier", () => {
  const criteriaPath = path.resolve("docs/releases/V1_FREEZE_EXIT_CRITERIA.json");
  const freezeStatePath = path.resolve("docs/releases/V1_FREEZE_STATE.json");

  const result = verifyFreezeExitCriteria({
    criteriaPath,
    freezeStatePath,
  });

  assert.equal(result.ok, true);
  assert.equal(result.freeze_state, "sealed");
});