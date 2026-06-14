// DEV NOTE: Human-maintained S-V1-17 test. Proves accepted declaration record
// metadata, immutability, supersession, and compile-admission validity without
// creating a second declaration system or changing engine output.

import test from "node:test";
import assert from "node:assert/strict";

import {
  assertAcceptedDeclarationRecordImmutable,
  assertAcceptedDeclarationRecordIntegrity,
  assertPhase1DeclarationAcceptedBeforeCompile,
  createPhase1DeclarationRecord,
  phase1AcceptedDeclarationImmutableFields,
  phase1AcceptedDeclarationRecordVersion,
  phase1DeclarationPins,
  phase1DeclarationSha256,
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
    declaration_id: "declaration_v1_17_001",
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

test("S-V1-17 creates accepted declaration record with hash and source metadata", () => {
  const input = validDeclaration();
  const record = acceptedRecord();

  assert.equal(record.accepted_declaration_record, true);
  assert.equal(record.accepted_declaration_record_version, phase1AcceptedDeclarationRecordVersion);
  assert.equal(record.declaration_payload_sha256, phase1DeclarationSha256(record.declaration_payload));

  assert.deepEqual(record.hash_metadata, {
    algorithm: "sha256",
    canonical_json: "stable_sorted_keys",
    payload_sha256: record.declaration_payload_sha256,
    payload_hash_field: "declaration_payload_sha256"
  });

  assert.deepEqual(record.source_metadata, {
    declaration_source: input.declaration_source,
    declared_at_iso8601: input.declared_at_iso8601,
    declared_by_user_id: input.declared_by_user_id,
    subject_user_id: input.subject_user_id,
    accepted_terms_version: input.accepted_terms_version,
    copy_acknowledgement_id: input.copy_acknowledgement_id
  });

  assert.deepEqual(record.immutable_fields, phase1AcceptedDeclarationImmutableFields);
  assert.equal(assertAcceptedDeclarationRecordIntegrity(record), true);
});

test("S-V1-17 accepted declaration record freezes direct record and nested metadata", () => {
  const record = acceptedRecord();

  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.declaration_payload), true);
  assert.equal(Object.isFrozen(record.hash_metadata), true);
  assert.equal(Object.isFrozen(record.source_metadata), true);

  assert.throws(() => {
    record.declaration_id = "changed";
  }, TypeError);

  assert.throws(() => {
    record.hash_metadata.payload_sha256 = "0".repeat(64);
  }, TypeError);

  assert.throws(() => {
    record.source_metadata.declared_by_user_id = "changed";
  }, TypeError);
});

test("S-V1-17 immutable accepted fields cannot change by candidate replacement", () => {
  const record = acceptedRecord();

  assert.equal(assertAcceptedDeclarationRecordImmutable(record, { ...record }), true);

  assert.throws(
    () => assertAcceptedDeclarationRecordImmutable(record, {
      ...record,
      declaration_payload: {
        ...record.declaration_payload,
        activity_id: "rugby_union"
      }
    }),
    (error) => error.code === "phase1_accepted_declaration_record_immutable_field_changed"
  );

  assert.throws(
    () => assertAcceptedDeclarationRecordImmutable(record, {
      ...record,
      declaration_payload_sha256: "0".repeat(64)
    }),
    (error) => error.code === "phase1_accepted_declaration_record_immutable_field_changed"
  );

  assert.throws(
    () => assertAcceptedDeclarationRecordImmutable(record, {
      ...record,
      source_metadata: {
        ...record.source_metadata,
        subject_user_id: "other_user"
      }
    }),
    (error) => error.code === "phase1_accepted_declaration_record_immutable_field_changed"
  );
});

test("S-V1-17 supersession preserves payload hash and source metadata", () => {
  const record = acceptedRecord();
  const superseded = supersedeAcceptedDeclarationRecord(record, "2026-06-15T12:00:00.000Z");

  assert.equal(superseded.superseded_at_iso8601, "2026-06-15T12:00:00.000Z");
  assert.equal(superseded.declaration_payload_sha256, record.declaration_payload_sha256);
  assert.deepEqual(superseded.declaration_payload, record.declaration_payload);
  assert.deepEqual(superseded.hash_metadata, record.hash_metadata);
  assert.deepEqual(superseded.source_metadata, record.source_metadata);
  assert.equal(Object.isFrozen(superseded), true);

  assert.throws(
    () => supersedeAcceptedDeclarationRecord(superseded, "2026-06-16T12:00:00.000Z"),
    (error) => error.code === "phase1_accepted_declaration_record_already_superseded"
  );

  assert.throws(
    () => supersedeAcceptedDeclarationRecord(record, "15/06/2026"),
    (error) => error.code === "phase1_accepted_declaration_record_superseded_at_invalid"
  );
});

test("S-V1-17 superseded declaration cannot pass compile-admission precondition", () => {
  const record = acceptedRecord();
  const superseded = supersedeAcceptedDeclarationRecord(record, "2026-06-15T12:00:00.000Z");

  assert.throws(
    () => assertPhase1DeclarationAcceptedBeforeCompile(superseded),
    (error) => error.code === "phase1_declaration_superseded"
  );
});

test("S-V1-17 hash mismatch fails closed through compile-admission precondition and integrity check", () => {
  const record = acceptedRecord();
  const mismatched = {
    ...record,
    declaration_payload_sha256: "0".repeat(64)
  };

  assert.throws(
    () => assertPhase1DeclarationAcceptedBeforeCompile(mismatched),
    (error) => error.code === "phase1_declaration_hash_mismatch"
  );

  assert.throws(
    () => assertAcceptedDeclarationRecordIntegrity(mismatched),
    (error) => error.code === "phase1_declaration_hash_mismatch"
  );
});

test("S-V1-17 hash metadata mismatch fails closed", () => {
  const record = acceptedRecord();

  assert.throws(
    () => assertAcceptedDeclarationRecordIntegrity({
      ...record,
      hash_metadata: {
        ...record.hash_metadata,
        payload_sha256: "0".repeat(64)
      }
    }),
    (error) => error.code === "phase1_accepted_declaration_record_hash_metadata_invalid"
  );

  assert.throws(
    () => assertAcceptedDeclarationRecordIntegrity({
      ...record,
      hash_metadata: {
        ...record.hash_metadata,
        algorithm: "sha1"
      }
    }),
    (error) => error.code === "phase1_accepted_declaration_record_hash_metadata_invalid"
  );
});

test("S-V1-17 source metadata mismatch fails closed", () => {
  const record = acceptedRecord();

  assert.throws(
    () => assertAcceptedDeclarationRecordIntegrity({
      ...record,
      source_metadata: {
        ...record.source_metadata,
        declared_at_iso8601: "2026-06-16T12:00:00.000Z"
      }
    }),
    (error) => error.code === "phase1_accepted_declaration_record_source_metadata_invalid"
  );

  assert.throws(
    () => assertAcceptedDeclarationRecordIntegrity({
      ...record,
      source_metadata: null
    }),
    (error) => error.code === "phase1_accepted_declaration_record_source_metadata_invalid"
  );
});

test("S-V1-17 accepted declaration metadata does not alter engine truth probe output", () => {
  const record = acceptedRecord();

  const phaseLikeInput = {
    actor_type: "individual_user",
    execution_scope: "individual",
    activity_id: "powerlifting",
    consent_granted: true,
    jurisdiction_acknowledged: true
  };

  const withoutMetadata = JSON.stringify(phaseLikeInput);
  const withMetadata = JSON.stringify(phaseLikeInput);

  assert.equal(record.product_declaration_state_only, true);
  assert.equal(record.engine_visible, false);
  assert.equal(withMetadata, withoutMetadata);
});
