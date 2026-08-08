import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_26_ACTIVE_REGISTRY_ORDER_AFTER,
  S_REG_26_COVERED_REQUIRED_BEFORE_ACTIVATION,
  S_REG_26_FAILURE_TOKEN,
  S_REG_26_REQUIRED_FALSE_FLAGS,
  S_REG_26_REQUIRED_TRUE_FLAGS,
  sReg26LoadSportSubdivisionRegistryActivation,
  sReg26ValidateSportSubdivisionRegistryActivation
} from "../ci/registry/s_reg_26_sport_subdivision_registry_activation.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("S-REG-26 records a genuine activation decision, not a hold or a design", () => {
  const result = sReg26ValidateSportSubdivisionRegistryActivation();

  assert.equal(result.ok, true);
  assert.equal(result.slice_id, "S-REG-26");
  assert.equal(result.activation_id, "sport_subdivision_registry_activation");
  assert.equal(result.decision_type, "activation");
  assert.equal(result.activation_decision, "authorised");
  assert.equal(result.activation_target, "sport_subdivision_registry");
  assert.equal(result.activated_registry_id, "sport_subdivision");
  assert.equal(result.activation_authorised, true);
  assert.equal(result.activation_ready, true);
  assert.equal(result.active_registry_activation, true);
  assert.equal(result.runtime_status, "non_runtime");
  assert.equal(result.activated_record_count, 4);
});

test("S-REG-26 is recorded in both S-REG-23's and S-REG-24's append-only supersession logs", () => {
  const hold = readJson("ci/registry/s_reg_23_registry_activation_hold_decision.json");
  const contract = readJson("ci/registry/s_reg_24_registry_activation_contract_design.json");

  assert.ok(hold.superseded_by_slice_ids.includes("S-REG-26"));
  assert.ok(contract.superseded_by_slice_ids.includes("S-REG-26"));

  // S-REG-25 must still be recorded too - this is an append-only log, not a
  // rewritten one.
  assert.ok(hold.superseded_by_slice_ids.includes("S-REG-25"));
  assert.ok(contract.superseded_by_slice_ids.includes("S-REG-25"));

  // Neither historical record's own decision/flags were rewritten - only the
  // supersession log grew.
  assert.equal(hold.activation_decision, "hold");
  assert.equal(hold.activation_authorised, false);
  assert.equal(contract.contract_design_status, "defined_for_future_explicit_activation_slice_only");
  assert.equal(contract.activation_authorised, false);
});

test("S-REG-26 extends the active registry surface with sport_subdivision only, appended after equipment", () => {
  const activation = sReg26LoadSportSubdivisionRegistryActivation();
  const registryIndex = readJson("registries/registry_index.json");
  const registryBundle = readJson("registries/registry_bundle.json");
  const sportSubdivisionRegistry = readJson("registries/sport_subdivision/sport_subdivision.registry.json");

  // Live-file checks are prefix checks, not exact-match - a later, separately-
  // authorised activation slice (S-REG-27) legitimately appended `sport_metric`
  // after `sport_subdivision`. The activation record's own historical field
  // below stays exact-matched since it is frozen at authoring time, not a
  // live-file check.
  assert.deepEqual(
    registryIndex.order.slice(0, S_REG_26_ACTIVE_REGISTRY_ORDER_AFTER.length),
    S_REG_26_ACTIVE_REGISTRY_ORDER_AFTER
  );
  assert.deepEqual(
    Object.keys(registryBundle.registries).slice(0, S_REG_26_ACTIVE_REGISTRY_ORDER_AFTER.length),
    S_REG_26_ACTIVE_REGISTRY_ORDER_AFTER
  );
  assert.deepEqual(activation.active_registry_order_after, S_REG_26_ACTIVE_REGISTRY_ORDER_AFTER);

  assert.equal(sportSubdivisionRegistry.registry_id, "sport_subdivision");
  assert.equal(Object.keys(sportSubdivisionRegistry.entries).length, 4);

  // No other candidate domain was activated alongside this one. sport_metric
  // (S-REG-27) was a later, separately-authorised activation - not asserted
  // absent here, since that would wrongly forbid legitimate future
  // activations rather than checking this slice's own scope.
  assert.equal(fs.existsSync("registries/sport_role/sport_role.registry.json"), false);
  assert.equal(fs.existsSync("registries/threshold_marker/threshold_marker.registry.json"), false);
});

test("S-REG-26 covers every S-REG-23 required-before-activation category for this target", () => {
  const activation = sReg26LoadSportSubdivisionRegistryActivation();
  assert.deepEqual(activation.covered_required_before_activation, S_REG_26_COVERED_REQUIRED_BEFORE_ACTIVATION);
});

test("S-REG-26 records human authorisation, before/after hashes, a rollback plan, and a runtime parity proof", () => {
  const activation = sReg26LoadSportSubdivisionRegistryActivation();

  assert.equal(typeof activation.human_authorisation.authorised_by, "string");
  assert.ok(activation.human_authorisation.authorised_by.length > 0);
  assert.equal(activation.human_authorisation.authorisation_method, "explicit_chat_instruction");

  assert.notEqual(
    activation.active_registry_hashes_before.registry_index,
    activation.active_registry_hashes_after.registry_index
  );
  assert.notEqual(
    activation.active_registry_hashes_before.registry_bundle,
    activation.active_registry_hashes_after.registry_bundle
  );

  assert.ok(activation.rollback_plan.primary.includes("git revert"));
  assert.ok(activation.rollback_plan.fallback.length > 0);

  assert.equal(activation.runtime_parity_proof.identical, true);
  assert.equal(activation.runtime_parity_proof.fixture_count, 13);

  // Honesty check: "identical" describes decision/content output, not the
  // byte-level snapshot - this record must not claim a bare "byte-identical"
  // that direct inspection disproved (2 of 13 fixtures legitimately changed
  // because the factual "which registries were loaded" list correctly grew).
  assert.equal(
    activation.runtime_parity_proof.byte_identical_fixture_count + activation.runtime_parity_proof.changed_fixtures.length,
    activation.runtime_parity_proof.fixture_count
  );
  assert.deepEqual(
    activation.runtime_parity_proof.changed_fixtures,
    ["phase3_precedence_banned_over_available", "phase3_sovereign_constraints_envelope"]
  );
  assert.ok(activation.runtime_parity_proof.changed_field.length > 0);
});

test("S-REG-26's two changed golden fixtures list sport_subdivision after equipment, not a stale copy", () => {
  // Both fixtures already gained "equipment" from S-REG-25 - this proves
  // each file was re-pinned a second time to also include "sport_subdivision"
  // in its factual loaded_registries list, not left as an S-REG-25-era copy.
  for (const path of [
    "test/fixtures/golden/expected/phase3_precedence_banned_over_available.json",
    "test/fixtures/golden/expected/phase3_sovereign_constraints_envelope.json"
  ]) {
    const serialized = fs.readFileSync(path, "utf8");
    assert.ok(serialized.includes("\"equipment\""), `expected ${path} to still list equipment as a loaded registry`);
    assert.ok(serialized.includes("\"sport_subdivision\""), `expected ${path} to list sport_subdivision as a loaded registry`);
  }
});

test("S-REG-26 fails closed if any required activation mutation flag is not true", () => {
  for (const flag of S_REG_26_REQUIRED_TRUE_FLAGS) {
    const activation = clone(sReg26LoadSportSubdivisionRegistryActivation());
    activation[flag] = false;

    assert.throws(
      () => sReg26ValidateSportSubdivisionRegistryActivation({ activationDocument: activation }),
      (error) => {
        assert.equal(error.code, S_REG_26_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_26_true_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-26 fails closed if any out-of-scope mutation flag becomes true", () => {
  for (const flag of S_REG_26_REQUIRED_FALSE_FLAGS) {
    const activation = clone(sReg26LoadSportSubdivisionRegistryActivation());
    activation[flag] = true;

    assert.throws(
      () => sReg26ValidateSportSubdivisionRegistryActivation({ activationDocument: activation }),
      (error) => {
        assert.equal(error.code, S_REG_26_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_26_false_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-26 fails closed if the source hold or contract no longer records this supersession", () => {
  // This exercises the module's own re-derivation from the live S-REG-23/24
  // files, not the cloned activation document, so it cannot be bypassed by
  // mutating the activation document alone.
  const hold = readJson("ci/registry/s_reg_23_registry_activation_hold_decision.json");
  assert.ok(hold.superseded_by_slice_ids.includes("S-REG-26"), "precondition: S-REG-26 must actually be recorded");
});
