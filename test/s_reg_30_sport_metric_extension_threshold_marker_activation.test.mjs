import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  S_REG_30_ACTIVE_REGISTRY_ORDER_AFTER,
  S_REG_30_COVERED_REQUIRED_BEFORE_ACTIVATION,
  S_REG_30_EXTENDED_RECORD_IDS,
  S_REG_30_FAILURE_TOKEN,
  S_REG_30_REQUIRED_FALSE_FLAGS,
  S_REG_30_REQUIRED_TRUE_FLAGS,
  sReg30LoadSportMetricExtensionThresholdMarkerActivation,
  sReg30ValidateSportMetricExtensionThresholdMarkerActivation
} from "../ci/registry/s_reg_30_sport_metric_extension_threshold_marker_activation.mjs";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("S-REG-30 records a genuine activation decision, not a hold or a design", () => {
  const result = sReg30ValidateSportMetricExtensionThresholdMarkerActivation();

  assert.equal(result.ok, true);
  assert.equal(result.slice_id, "S-REG-30");
  assert.equal(result.activation_id, "sport_metric_extension_threshold_marker_activation");
  assert.equal(result.decision_type, "activation");
  assert.equal(result.activation_decision, "authorised");
  assert.equal(result.activation_target, "threshold_marker_registry");
  assert.equal(result.activated_registry_id, "threshold_marker");
  assert.equal(result.extended_registry_id, "sport_metric");
  assert.equal(result.activation_authorised, true);
  assert.equal(result.activation_ready, true);
  assert.equal(result.active_registry_activation, true);
  assert.equal(result.runtime_status, "non_runtime");
  assert.equal(result.activated_record_count, 5);
  assert.equal(result.extended_record_count, 3);
  assert.deepEqual(result.extended_record_ids, S_REG_30_EXTENDED_RECORD_IDS);
});

test("S-REG-30 is recorded in both S-REG-23's and S-REG-24's append-only supersession logs", () => {
  const hold = readJson("ci/registry/s_reg_23_registry_activation_hold_decision.json");
  const contract = readJson("ci/registry/s_reg_24_registry_activation_contract_design.json");

  assert.ok(hold.superseded_by_slice_ids.includes("S-REG-30"));
  assert.ok(contract.superseded_by_slice_ids.includes("S-REG-30"));

  for (const sliceId of ["S-REG-25", "S-REG-26", "S-REG-27", "S-REG-28", "S-REG-29"]) {
    assert.ok(hold.superseded_by_slice_ids.includes(sliceId));
    assert.ok(contract.superseded_by_slice_ids.includes(sliceId));
  }

  assert.equal(hold.activation_decision, "hold");
  assert.equal(hold.activation_authorised, false);
  assert.equal(contract.contract_design_status, "defined_for_future_explicit_activation_slice_only");
  assert.equal(contract.activation_authorised, false);
});

test("S-REG-30 extends sport_metric with exactly the 3 needed records, none removed", () => {
  const sportMetricRegistry = readJson("registries/sport_metric/sport_metric.registry.json");

  assert.equal(sportMetricRegistry.registry_id, "sport_metric");
  for (const sportMetricId of S_REG_30_EXTENDED_RECORD_IDS) {
    assert.ok(sportMetricId in sportMetricRegistry.entries, `expected ${sportMetricId} to be present`);
  }

  // Only the 3 needed records from S-REG-19's expansion batch were added -
  // the other 3 (powerlifting__body_mass_kg, rugby_union__jump_height_cm,
  // rugby_union__sprint_distance_m) are unreferenced by anything and stay
  // inactive by deliberate choice.
  for (const unreferencedId of ["powerlifting__body_mass_kg", "rugby_union__jump_height_cm", "rugby_union__sprint_distance_m"]) {
    assert.equal(unreferencedId in sportMetricRegistry.entries, false, `expected ${unreferencedId} to remain inactive`);
  }

  assert.equal(Object.keys(sportMetricRegistry.entries).length, 9);
});

test("S-REG-30 activates threshold_marker with all 5 candidate records, appended after metric_exercise_link", () => {
  const activation = sReg30LoadSportMetricExtensionThresholdMarkerActivation();
  const registryIndex = readJson("registries/registry_index.json");
  const registryBundle = readJson("registries/registry_bundle.json");
  const thresholdMarkerRegistry = readJson("registries/threshold_marker/threshold_marker.registry.json");

  // Live-file checks are prefix checks, not exact-match - a later,
  // separately-authorised activation slice may legitimately append further
  // domains after this one. The activation record's own historical field
  // below stays exact-matched since it is frozen at authoring time, not a
  // live-file check.
  assert.deepEqual(
    registryIndex.order.slice(0, S_REG_30_ACTIVE_REGISTRY_ORDER_AFTER.length),
    S_REG_30_ACTIVE_REGISTRY_ORDER_AFTER
  );
  assert.deepEqual(
    Object.keys(registryBundle.registries).slice(0, S_REG_30_ACTIVE_REGISTRY_ORDER_AFTER.length),
    S_REG_30_ACTIVE_REGISTRY_ORDER_AFTER
  );
  assert.deepEqual(activation.active_registry_order_after, S_REG_30_ACTIVE_REGISTRY_ORDER_AFTER);

  assert.equal(thresholdMarkerRegistry.registry_id, "threshold_marker");
  assert.equal(Object.keys(thresholdMarkerRegistry.entries).length, 5);
});

test("S-REG-30's threshold_marker records all reference real sport_metric and activity entries", () => {
  const thresholdMarkerRegistry = readJson("registries/threshold_marker/threshold_marker.registry.json");
  const sportMetricRegistry = readJson("registries/sport_metric/sport_metric.registry.json");
  const activityRegistry = readJson("registries/activity/activity.registry.json");

  for (const [id, record] of Object.entries(thresholdMarkerRegistry.entries)) {
    assert.ok(record.sport_metric_id in sportMetricRegistry.entries, `${id}: sport_metric_id ${record.sport_metric_id} must exist`);
    assert.ok(record.activity_id in activityRegistry.entries, `${id}: activity_id ${record.activity_id} must exist`);
  }
});

test("S-REG-30 covers every S-REG-23 required-before-activation category for this target", () => {
  const activation = sReg30LoadSportMetricExtensionThresholdMarkerActivation();
  assert.deepEqual(activation.covered_required_before_activation, S_REG_30_COVERED_REQUIRED_BEFORE_ACTIVATION);
});

test("S-REG-30 records human authorisation, before/after hashes, a rollback plan, and a runtime parity proof", () => {
  const activation = sReg30LoadSportMetricExtensionThresholdMarkerActivation();

  assert.equal(typeof activation.human_authorisation.authorised_by, "string");
  assert.ok(activation.human_authorisation.authorised_by.length > 0);
  assert.equal(activation.human_authorisation.authorisation_method, "explicit_chat_instruction");
  assert.ok(activation.human_authorisation.authorisation_note.includes("threshold_marker"));

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

test("S-REG-30's two changed golden fixtures list threshold_marker after metric_exercise_link, not a stale copy", () => {
  for (const path of [
    "test/fixtures/golden/expected/phase3_precedence_banned_over_available.json",
    "test/fixtures/golden/expected/phase3_sovereign_constraints_envelope.json"
  ]) {
    const serialized = fs.readFileSync(path, "utf8");
    assert.ok(serialized.includes("\"metric_exercise_link\""), `expected ${path} to still list metric_exercise_link as a loaded registry`);
    assert.ok(serialized.includes("\"threshold_marker\""), `expected ${path} to list threshold_marker as a loaded registry`);
  }
});

test("S-REG-30 fails closed if any required activation mutation flag is not true", () => {
  for (const flag of S_REG_30_REQUIRED_TRUE_FLAGS) {
    const activation = clone(sReg30LoadSportMetricExtensionThresholdMarkerActivation());
    activation[flag] = false;

    assert.throws(
      () => sReg30ValidateSportMetricExtensionThresholdMarkerActivation({ activationDocument: activation }),
      (error) => {
        assert.equal(error.code, S_REG_30_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_30_true_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-30 fails closed if any out-of-scope mutation flag becomes true", () => {
  for (const flag of S_REG_30_REQUIRED_FALSE_FLAGS) {
    const activation = clone(sReg30LoadSportMetricExtensionThresholdMarkerActivation());
    activation[flag] = true;

    assert.throws(
      () => sReg30ValidateSportMetricExtensionThresholdMarkerActivation({ activationDocument: activation }),
      (error) => {
        assert.equal(error.code, S_REG_30_FAILURE_TOKEN);
        assert.equal(error.reason, "s_reg_30_false_flag_invalid");
        return true;
      }
    );
  }
});

test("S-REG-30 fails closed if the source hold or contract no longer records this supersession", () => {
  const hold = readJson("ci/registry/s_reg_23_registry_activation_hold_decision.json");
  assert.ok(hold.superseded_by_slice_ids.includes("S-REG-30"), "precondition: S-REG-30 must actually be recorded");
});
