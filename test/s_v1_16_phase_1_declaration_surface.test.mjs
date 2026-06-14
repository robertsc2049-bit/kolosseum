// DEV NOTE: Human-maintained v1 declaration surface test. This file proves
// factual user-declared Phase 1 declaration behaviour without changing engine
// compile behaviour, adding persistence, adding UI, adding assessments, or
// creating assignment authority.

import test from "node:test";
import assert from "node:assert/strict";

import {
  assertPhase1DeclarationAcceptedBeforeCompile,
  compileIgnoringPhase1DeclarationSurface,
  createPhase1DeclarationRecord,
  phase1DeclarationCopyIds,
  phase1DeclarationCopyText,
  phase1DeclarationPins,
  phase1DeclarationSha256,
  validatePhase1DeclarationInput
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
    declaration_id: "declaration_001",
    declared_by_user_id: "user_001",
    subject_user_id: "user_001",
    declaration_source: "user_declared",
    declaration_scope: "phase1_compile_prerequisite",
    declaration_state: "accepted",
    declaration_payload: validPayload(),
    declared_at_iso8601: "2026-06-13T12:00:00.000Z",
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

function assertDeclarationRejected(input, error) {
  const result = createPhase1DeclarationRecord(input);
  assert.equal(result.status, 400);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, error);
  assert.equal(result.body.copy_id, "PHASE_1_DECLARATION_REJECTED");
  assert.equal(result.body.product_declaration_state_only, true);
  assert.equal(result.body.engine_visible, false);
}

test("S-V1-16 accepts valid factual user-declared Phase 1 declaration", () => {
  const result = createPhase1DeclarationRecord(validDeclaration());

  assert.equal(result.status, 201);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.surface_id, "phase_1_declaration_surface");
  assert.equal(result.body.version, "1.0.0");
  assert.equal(result.body.declaration.declaration_id, "declaration_001");
  assert.equal(result.body.declaration.declared_by_user_id, "user_001");
  assert.equal(result.body.declaration.subject_user_id, "user_001");
  assert.equal(result.body.declaration.declaration_source, "user_declared");
  assert.equal(result.body.declaration.declaration_scope, "phase1_compile_prerequisite");
  assert.equal(result.body.declaration.declaration_state, "accepted");
  assert.equal(result.body.declaration.user_declared_factual_state, true);
  assert.equal(result.body.declaration.product_declaration_state_only, true);
  assert.equal(result.body.declaration.engine_visible, false);
  assert.equal(result.body.declaration.immutable, true);
  assert.equal(result.body.declaration.superseded_at_iso8601, null);
  assert.equal(result.body.declaration.declaration_payload_sha256, phase1DeclarationSha256(result.body.declaration.declaration_payload));
  assert.deepEqual(result.body.declaration.copy_ids, phase1DeclarationCopyIds);
});

test("S-V1-16 accepts coach-managed declaration payload without creating coach authority", () => {
  const result = createPhase1DeclarationRecord(validDeclaration({
    declaration_id: "declaration_002",
    declared_by_user_id: "coach_001",
    subject_user_id: "athlete_001",
    declaration_payload: validPayload({
      actor_type: "coach",
      execution_scope: "coach_managed",
      activity_id: "rugby_union"
    })
  }));

  assert.equal(result.status, 201);
  assert.equal(result.body.declaration.declaration_payload.actor_type, "coach");
  assert.equal(result.body.declaration.declaration_payload.execution_scope, "coach_managed");
  assert.equal(result.body.declaration.declaration_payload.activity_id, "rugby_union");
  assert.equal(result.body.declaration.product_declaration_state_only, true);
  assert.equal(result.body.declaration.engine_visible, false);
});

test("S-V1-16 rejects missing required top-level fields", () => {
  for (const field of [
    "declaration_id",
    "declared_by_user_id",
    "subject_user_id",
    "declaration_source",
    "declaration_scope",
    "declaration_state",
    "declaration_payload",
    "declared_at_iso8601",
    "accepted_terms_version",
    "copy_acknowledgement_id"
  ]) {
    const input = validDeclaration();
    delete input[field];
    assertDeclarationRejected(input, `phase1_declaration_${field}_required`);
  }
});

test("S-V1-16 rejects missing required payload fields", () => {
  for (const field of [
    "actor_type",
    "execution_scope",
    "activity_id",
    "phase1_schema_version",
    "engine_compatibility",
    "enum_bundle_version",
    "consent_granted",
    "jurisdiction_acknowledged"
  ]) {
    const payload = validPayload();
    delete payload[field];

    assertDeclarationRejected(
      validDeclaration({ declaration_payload: payload }),
      `phase1_declaration_payload_${field}_required`
    );
  }
});

test("S-V1-16 rejects unknown top-level and payload fields", () => {
  assertDeclarationRejected(
    {
      ...validDeclaration(),
      unexpected_field: true
    },
    "phase1_declaration_unknown_field_refused"
  );

  assertDeclarationRejected(
    validDeclaration({
      declaration_payload: {
        ...validPayload(),
        unexpected_payload_field: true
      }
    }),
    "phase1_declaration_payload_unknown_field_refused"
  );
});

test("S-V1-16 rejects forbidden authority fields and treats non-scope fields as unknown input", () => {
  for (const forbidden of [
    { engine_input: {} },
    { compile_input: {} },
    { assignment_authority: true },
    { registry_authority: true },
    { team_role: "captain" },
    { organisation_role: "manager" },
    { organization_role: "manager" },
    { gym_role: "admin" },
    { federation_role: "admin" }
  ]) {
    assertDeclarationRejected(
      {
        ...validDeclaration(),
        ...forbidden
      },
      "phase1_declaration_forbidden_claim_or_authority_field_refused"
    );
  }

  for (const nonScopeField of [
    { diagnosis: "text" },
    { medical_assessment: true },
    { safety_clearance: true },
    { suitability_clearance: true },
    { readiness_score: 10 },
    { risk_score: 2 },
    { recommendation: "text" }
  ]) {
    assertDeclarationRejected(
      {
        ...validDeclaration(),
        ...nonScopeField
      },
      "phase1_declaration_unknown_field_refused"
    );
  }

  assertDeclarationRejected(
    validDeclaration({
      declaration_payload: {
        ...validPayload(),
        diagnosis: "text"
      }
    }),
    "phase1_declaration_payload_unknown_field_refused"
  );
});

test("S-V1-16 rejects false acknowledgements and version mismatches", () => {
  assertDeclarationRejected(
    validDeclaration({
      declaration_payload: validPayload({ consent_granted: false })
    }),
    "phase1_declaration_payload_consent_not_declared"
  );

  assertDeclarationRejected(
    validDeclaration({
      declaration_payload: validPayload({ jurisdiction_acknowledged: false })
    }),
    "phase1_declaration_payload_jurisdiction_not_declared"
  );

  assertDeclarationRejected(
    validDeclaration({
      declaration_payload: validPayload({ phase1_schema_version: "2.0.0" })
    }),
    "phase1_declaration_payload_phase1_schema_version_mismatch"
  );

  assertDeclarationRejected(
    validDeclaration({
      declaration_payload: validPayload({ engine_compatibility: "EB2-2.0.0" })
    }),
    "phase1_declaration_payload_engine_compatibility_mismatch"
  );

  assertDeclarationRejected(
    validDeclaration({
      declaration_payload: validPayload({ enum_bundle_version: "EB2-2.0.0" })
    }),
    "phase1_declaration_payload_enum_bundle_version_mismatch"
  );
});

test("S-V1-16 validates active allowed value sets", () => {
  assertDeclarationRejected(
    validDeclaration({ declaration_source: "coach_entered" }),
    "phase1_declaration_source_invalid"
  );

  assertDeclarationRejected(
    validDeclaration({ declaration_scope: "readiness_review" }),
    "phase1_declaration_scope_invalid"
  );

  assertDeclarationRejected(
    validDeclaration({ declaration_state: "pending" }),
    "phase1_declaration_state_invalid"
  );

  assertDeclarationRejected(
    validDeclaration({ declared_at_iso8601: "13/06/2026" }),
    "phase1_declaration_declared_at_invalid"
  );

  assertDeclarationRejected(
    validDeclaration({ copy_acknowledgement_id: "ACKNOWLEDGED_CLEARANCE" }),
    "phase1_declaration_copy_acknowledgement_invalid"
  );

  assertDeclarationRejected(
    validDeclaration({
      declaration_payload: validPayload({ actor_type: "athlete" })
    }),
    "phase1_declaration_payload_actor_type_invalid"
  );

  assertDeclarationRejected(
    validDeclaration({
      declaration_payload: validPayload({ execution_scope: "team_managed" })
    }),
    "phase1_declaration_payload_execution_scope_invalid"
  );

  assertDeclarationRejected(
    validDeclaration({
      declaration_payload: validPayload({ activity_id: "bodybuilding" })
    }),
    "phase1_declaration_payload_activity_id_invalid"
  );
});

test("S-V1-16 product precondition guard accepts current immutable declaration before compile admission", () => {
  const record = acceptedRecord();

  assert.equal(assertPhase1DeclarationAcceptedBeforeCompile(record), true);
});

test("S-V1-16 product precondition guard rejects missing unaccepted superseded mutable or hash mismatch declaration", () => {
  assert.throws(
    () => assertPhase1DeclarationAcceptedBeforeCompile(null),
    (error) => error.code === "phase1_declaration_required_before_compile" &&
      error.product_declaration_state_only === true &&
      error.engine_visible === false
  );

  assert.throws(
    () => assertPhase1DeclarationAcceptedBeforeCompile({
      ...acceptedRecord(),
      declaration_state: "rejected"
    }),
    (error) => error.code === "phase1_declaration_not_accepted"
  );

  assert.throws(
    () => assertPhase1DeclarationAcceptedBeforeCompile({
      ...acceptedRecord(),
      superseded_at_iso8601: "2026-06-14T12:00:00.000Z"
    }),
    (error) => error.code === "phase1_declaration_superseded"
  );

  assert.throws(
    () => assertPhase1DeclarationAcceptedBeforeCompile({
      ...acceptedRecord(),
      immutable: false
    }),
    (error) => error.code === "phase1_declaration_not_immutable"
  );

  assert.throws(
    () => assertPhase1DeclarationAcceptedBeforeCompile({
      ...acceptedRecord(),
      declaration_payload_sha256: "0".repeat(64)
    }),
    (error) => error.code === "phase1_declaration_hash_mismatch"
  );
});

test("S-V1-16 declaration state does not mutate engine truth probe output", () => {
  const phaseLikeInput = {
    actor_type: "individual_user",
    execution_scope: "individual",
    activity_id: "powerlifting",
    consent_granted: true,
    jurisdiction_acknowledged: true
  };

  const accepted = acceptedRecord();
  const rejected = createPhase1DeclarationRecord({
    ...validDeclaration(),
    declaration_payload: validPayload({ consent_granted: false })
  }).body;

  const before = compileIgnoringPhase1DeclarationSurface(phaseLikeInput, [accepted]);
  const after = compileIgnoringPhase1DeclarationSurface(phaseLikeInput, [rejected]);

  assert.equal(after, before);
});

test("S-V1-16 declaration copy remains factual and claim-safe", () => {
  const joinedIds = phase1DeclarationCopyIds.join(" ").toLowerCase();
  const joinedText = Object.values(phase1DeclarationCopyText).join(" ").toLowerCase();
  const joined = `${joinedIds} ${joinedText}`;

  for (const forbidden of [
    "medical",
    "diagnosis",
    "assessment",
    "clearance",
    "safe",
    "safety",
    "suitable",
    "suitability",
    "readiness",
    "risk",
    "return to play",
    "fit for duty",
    "recommend",
    "recommended",
    "optimal",
    "score",
    "approved",
    "advice"
  ]) {
    assert.equal(joined.includes(forbidden), false, `copy leaked forbidden wording: ${forbidden}`);
  }
});

test("S-V1-16 validation is closed-world and deterministic", () => {
  const first = validatePhase1DeclarationInput(validDeclaration());
  const second = validatePhase1DeclarationInput(validDeclaration());

  assert.deepEqual(first, second);
});
