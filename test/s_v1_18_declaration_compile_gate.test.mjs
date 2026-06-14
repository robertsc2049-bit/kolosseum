// DEV NOTE: Human-maintained S-V1-18 test. Proves compile admission is bound to
// current valid accepted declaration records while product-only state remains
// outside engine-facing compile truth.

import test from "node:test";
import assert from "node:assert/strict";

import {
  assertPhase1DeclarationCompileGate,
  createPhase1DeclarationRecord,
  stablePhase1DeclarationJson,
  phase1DeclarationPins,
  supersedeAcceptedDeclarationRecord
} from "../src/phase1DeclarationSurface.mjs";

function validPayload(overrides = {}) {
  return {
    actor_type: "individual_user",
    execution_scope: "individual",
    activity_id: "powerlifting",
    phase1_schema_version: phase1DeclarationPins.phase1_schema_version,
    engine_compatibility: phase1DeclarationPins.engine_compatibility,
    enum_bundle_version: phase1DeclarationPins.enum_bundle_version,
    consent_granted: true,
    jurisdiction_acknowledged: true,
    ...overrides
  };
}

function validDeclaration(overrides = {}) {
  return {
    declaration_id: "declaration_v1_18_001",
    declared_by_user_id: "user_001",
    subject_user_id: "user_001",
    declaration_source: "user_declared",
    declaration_scope: "phase1_compile_prerequisite",
    declaration_state: "accepted",
    declaration_payload: validPayload(),
    declared_at_iso8601: "2026-06-14T12:00:00.000Z",
    accepted_terms_version: "terms_v1",
    copy_acknowledgement_id: "PHASE_1_DECLARATION_USER_DECLARED_FACTUAL",
    ...overrides
  };
}

function acceptedRecord(overrides = {}) {
  const result = createPhase1DeclarationRecord(validDeclaration(overrides));
  assert.equal(result.status, 201);
  return result.body.declaration;
}

function phaseLikeInput(overrides = {}) {
  return {
    actor_type: "individual_user",
    execution_scope: "individual",
    activity_id: "powerlifting",
    consent_granted: true,
    jurisdiction_acknowledged: true,
    ...overrides
  };
}

test("S-V1-18 compile gate refuses missing declaration", () => {
  assert.throws(
    () => assertPhase1DeclarationCompileGate({
      phase_like_input: phaseLikeInput(),
      declaration_record: null
    }),
    (error) => error.code === "phase1_declaration_required_before_compile"
  );
});

test("S-V1-18 compile gate refuses unaccepted declaration", () => {
  const record = {
    ...acceptedRecord(),
    declaration_state: "pending"
  };

  assert.throws(
    () => assertPhase1DeclarationCompileGate({
      phase_like_input: phaseLikeInput(),
      declaration_record: record
    }),
    (error) => error.code === "phase1_declaration_not_accepted"
  );
});

test("S-V1-18 compile gate refuses superseded declaration", () => {
  const record = acceptedRecord();
  const superseded = supersedeAcceptedDeclarationRecord(record, "2026-06-15T12:00:00.000Z");

  assert.throws(
    () => assertPhase1DeclarationCompileGate({
      phase_like_input: phaseLikeInput(),
      declaration_record: superseded
    }),
    (error) => error.code === "phase1_declaration_superseded"
  );
});

test("S-V1-18 compile gate refuses hash mismatch", () => {
  const record = {
    ...acceptedRecord(),
    declaration_payload_sha256: "0".repeat(64)
  };

  assert.throws(
    () => assertPhase1DeclarationCompileGate({
      phase_like_input: phaseLikeInput(),
      declaration_record: record
    }),
    (error) => error.code === "phase1_declaration_hash_mismatch"
  );
});

test("S-V1-18 compile gate refuses invalid accepted declaration metadata", () => {
  const record = {
    ...acceptedRecord(),
    hash_metadata: {
      algorithm: "sha256",
      canonical_json: "stable_sorted_keys",
      payload_sha256: "0".repeat(64),
      payload_hash_field: "declaration_payload_sha256"
    }
  };

  assert.throws(
    () => assertPhase1DeclarationCompileGate({
      phase_like_input: phaseLikeInput(),
      declaration_record: record
    }),
    (error) => error.code === "phase1_accepted_declaration_record_hash_metadata_invalid"
  );
});

test("S-V1-18 compile gate allows current valid declaration", () => {
  const record = acceptedRecord();

  const result = assertPhase1DeclarationCompileGate({
    phase_like_input: phaseLikeInput(),
    declaration_record: record
  });

  assert.equal(result.ok, true);
  assert.equal(result.surface_id, "phase_1_declaration_compile_gate");
  assert.equal(result.compile_admission, "declaration_current_valid");
  assert.equal(result.declaration_payload_sha256, record.declaration_payload_sha256);
  assert.equal(result.product_declaration_state_only, true);
  assert.equal(result.engine_visible, false);
  assert.equal(result.compile_probe_output, stablePhase1DeclarationJson(phaseLikeInput()));
});

test("S-V1-18 product state cannot mutate declaration truth or compile probe output", () => {
  const record = acceptedRecord();
  const externalStateA = {
    coach_notes: "private coach note",
    billing_state: "paid",
    payment_state: "paid",
    presentation_state: "compact",
    ui_state: "expanded"
  };
  const externalStateB = {
    coach_notes: "changed note",
    billing_state: "unpaid",
    payment_state: "failed",
    presentation_state: "detailed",
    ui_state: "collapsed"
  };

  const first = assertPhase1DeclarationCompileGate({
    phase_like_input: phaseLikeInput(),
    declaration_record: record,
    external_product_state: externalStateA
  });

  const second = assertPhase1DeclarationCompileGate({
    phase_like_input: phaseLikeInput(),
    declaration_record: record,
    external_product_state: externalStateB
  });

  assert.equal(first.declaration_payload_sha256, second.declaration_payload_sha256);
  assert.equal(first.compile_probe_output, second.compile_probe_output);
  assert.deepEqual(record.source_metadata, acceptedRecord().source_metadata);
});
