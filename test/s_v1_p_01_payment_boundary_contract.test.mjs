import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  PAYMENT_BOUNDARY_ALLOWED_CONTROLS,
  PAYMENT_BOUNDARY_FORBIDDEN_EFFECTS,
  PAYMENT_BOUNDARY_REASON_CODES,
  assertV1PaymentBoundary,
  buildPaymentNoCouplingProbe,
  createV1PaymentBoundary
} from "../src/v1PaymentBoundaryContract.mjs";

const deterministicProbe = Object.freeze({
  canonical_input_hash: "a".repeat(64),
  compile_output_hash: "b".repeat(64),
  substitution_output_hash: "c".repeat(64),
  replay_record_hash: "d".repeat(64),
  proof_record_hash: "e".repeat(64),
  factual_history_hash: "f".repeat(64)
});

function baseRequest(overrides = {}) {
  return {
    commercial_access: {
      state: "access_active",
      plan_id: "controlled_launch_coach",
      seat_limit: 6,
      billing_surface_visible: true,
      actor_id: "coach_001",
      subject_id: "coach_001",
      automated_upsell: false,
      change_timing: "pre_session",
      requested_effects: []
    },
    requested_control: "access_state",
    session_state: "not_started",
    requested_at: "2026-06-17T10:00:00.000Z",
    deterministic_probe: deterministicProbe,
    ...overrides
  };
}

test("S-V1-P-01 exposes a closed commercial access boundary", () => {
  assert.deepEqual(PAYMENT_BOUNDARY_ALLOWED_CONTROLS, [
    "access_state",
    "plan_visibility",
    "seat_limit",
    "billing_surface_visibility"
  ]);

  for (const forbidden of [
    "engine_legality",
    "compile_output",
    "substitution_selection",
    "replay_record",
    "proof_record",
    "factual_history_record",
    "mid_session_engine_access_rewrite",
    "enterprise_billing",
    "multi_entity_billing"
  ]) {
    assert.ok(PAYMENT_BOUNDARY_FORBIDDEN_EFFECTS.includes(forbidden));
  }
});

test("S-V1-P-01 records access control without changing deterministic surfaces", () => {
  const result = createV1PaymentBoundary(baseRequest());

  assert.equal(result.ok, true);
  assert.equal(result.status, "payment_boundary_recorded");
  assert.equal(result.reason_code, PAYMENT_BOUNDARY_REASON_CODES.ALLOWED);
  assert.equal(result.boundary.access_state_control, "permitted_product_surface");
  assert.equal(result.boundary.engine_legality, "not_mutated");
  assert.equal(result.boundary.compile_output, "not_mutated");
  assert.equal(result.boundary.substitution_selection, "not_mutated");
  assert.equal(result.boundary.replay_record, "not_mutated");
  assert.equal(result.boundary.proof_record, "not_mutated");
  assert.equal(result.boundary.factual_history_record, "not_mutated");
  assert.equal(Object.isFrozen(result), true);

  const assertion = assertV1PaymentBoundary(result);
  assert.equal(assertion.ok, true);
});

test("S-V1-P-01 commercial access changes do not alter deterministic probe output", () => {
  const activeProbe = buildPaymentNoCouplingProbe(deterministicProbe);
  const blockedProbe = buildPaymentNoCouplingProbe(deterministicProbe);

  assert.equal(activeProbe.ok, true);
  assert.equal(blockedProbe.ok, true);
  assert.equal(activeProbe.deterministic_probe_hash, blockedProbe.deterministic_probe_hash);

  const active = createV1PaymentBoundary(baseRequest({
    commercial_access: {
      ...baseRequest().commercial_access,
      state: "access_active"
    }
  }));

  const suspended = createV1PaymentBoundary(baseRequest({
    commercial_access: {
      ...baseRequest().commercial_access,
      state: "access_suspended"
    }
  }));

  assert.equal(active.ok, true);
  assert.equal(suspended.ok, true);
  assert.equal(active.deterministic_probe_hash, suspended.deterministic_probe_hash);
});

test("S-V1-P-01 refuses deterministic effect requests", () => {
  const result = createV1PaymentBoundary(baseRequest({
    commercial_access: {
      ...baseRequest().commercial_access,
      requested_effects: ["compile_output"]
    }
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, "payment_boundary_blocked");
  assert.equal(result.reason_code, PAYMENT_BOUNDARY_REASON_CODES.EFFECT_NOT_PERMITTED);
  assert.equal(result.details.requested_effect, "compile_output");
});

test("S-V1-P-01 refuses automated mid-session upsell control", () => {
  const result = createV1PaymentBoundary(baseRequest({
    session_state: "in_progress",
    commercial_access: {
      ...baseRequest().commercial_access,
      automated_upsell: true,
      change_timing: "mid_session"
    }
  }));

  assert.equal(result.ok, false);
  assert.equal(result.reason_code, PAYMENT_BOUNDARY_REASON_CODES.MID_SESSION_AUTOMATION_NOT_PERMITTED);
});

test("S-V1-P-01 payment copy remains neutral", () => {
  const copy = JSON.parse(fs.readFileSync("copy/payment_boundary_copy.json", "utf8"));
  const text = JSON.stringify(copy).toLowerCase();

  for (const blocked of [
    "recommended",
    "recommendation",
    "readiness",
    "fatigue",
    "risk",
    "medical",
    "diagnosis",
    "rehab",
    "optimal"
  ]) {
    assert.equal(text.includes(blocked), false, `copy must not include ${blocked}`);
  }
});