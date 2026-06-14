// DEV NOTE: Human-maintained v1 permission test. This file proves S-V1-14
// behaviour without adding auth providers, persistence, UI, teams/orgs/gyms,
// social connections, messaging, assignment authority, or engine truth.

import test from "node:test";
import assert from "node:assert/strict";

import {
  canAthleteViewAthleteData,
  canCoachViewAssignedAthlete,
  coachAthleteRelationshipCopyIds,
  compileIgnoringCoachAthleteRelationship,
  createCoachAthleteRelationshipRecord,
  decideCoachAthleteRelationshipAccess,
  isAcceptedIndividualCoachAthleteRelationship,
  stableCoachAthleteRelationshipJson,
  validateCoachAthleteRelationshipInput
} from "../src/coachAthleteRelationshipAcceptance.mjs";

function validRelationship(overrides = {}) {
  return {
    relationship_id: "relationship_001",
    coach_user_id: "coach_001",
    athlete_user_id: "athlete_001",
    relationship_state: "accepted",
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: "2026-06-13T13:00:00.000Z",
    created_at_iso8601: "2026-06-13T12:00:00.000Z",
    updated_at_iso8601: "2026-06-13T13:00:00.000Z",
    revoked_at_iso8601: null,
    expires_at_iso8601: null,
    ...overrides
  };
}

function relationshipRecord(overrides = {}) {
  const result = createCoachAthleteRelationshipRecord(validRelationship(overrides));
  assert.equal(result.status, 201);
  return result.body.relationship;
}

function assertRelationshipRejected(input, error) {
  const result = createCoachAthleteRelationshipRecord(input);
  assert.equal(result.status, 400);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, error);
  assert.equal(result.body.copy_id, "COACH_ATHLETE_RELATIONSHIP_ACCESS_DENIED");
}

test("S-V1-14 creates accepted individual relationship as product permission state only", () => {
  const result = createCoachAthleteRelationshipRecord(validRelationship());

  assert.equal(result.status, 201);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.surface_id, "coach_athlete_relationship_acceptance");
  assert.equal(result.body.version, "1.0.0");
  assert.equal(result.body.relationship.relationship_id, "relationship_001");
  assert.equal(result.body.relationship.coach_user_id, "coach_001");
  assert.equal(result.body.relationship.athlete_user_id, "athlete_001");
  assert.equal(result.body.relationship.relationship_state, "accepted");
  assert.equal(result.body.relationship.relationship_scope, "individual_coach_athlete");
  assert.equal(result.body.relationship.product_permission_state_only, true);
  assert.equal(result.body.relationship.engine_visible, false);
  assert.deepEqual(result.body.relationship.copy_ids, [
    "COACH_ATHLETE_RELATIONSHIP_ACCEPTED",
    "COACH_ATHLETE_RELATIONSHIP_PRODUCT_PERMISSION_ONLY"
  ]);
});

test("S-V1-14 assigned coach can view assigned athlete only", () => {
  const relationship = relationshipRecord();

  const allowed = canCoachViewAssignedAthlete({
    coach_user_id: "coach_001",
    athlete_user_id: "athlete_001",
    relationships: [relationship]
  });

  assert.equal(allowed.allowed, true);
  assert.equal(allowed.reason, "coach_assigned_to_athlete");
  assert.equal(allowed.relationship_id, "relationship_001");
  assert.equal(allowed.product_permission_state_only, true);
  assert.equal(allowed.engine_visible, false);

  const routed = decideCoachAthleteRelationshipAccess({
    actor: {
      actor_type: "coach",
      user_id: "coach_001"
    },
    target_athlete_user_id: "athlete_001",
    relationships: [relationship]
  });

  assert.equal(routed.allowed, true);
  assert.equal(routed.reason, "coach_assigned_to_athlete");
});

test("S-V1-14 unassigned coach access is rejected", () => {
  const relationship = relationshipRecord();

  const wrongCoach = canCoachViewAssignedAthlete({
    coach_user_id: "coach_002",
    athlete_user_id: "athlete_001",
    relationships: [relationship]
  });

  assert.equal(wrongCoach.allowed, false);
  assert.equal(wrongCoach.reason, "coach_not_assigned_to_athlete");

  const wrongAthlete = canCoachViewAssignedAthlete({
    coach_user_id: "coach_001",
    athlete_user_id: "athlete_002",
    relationships: [relationship]
  });

  assert.equal(wrongAthlete.allowed, false);
  assert.equal(wrongAthlete.reason, "coach_not_assigned_to_athlete");
});

test("S-V1-14 non-accepted relationship states do not grant coach visibility", () => {
  const cases = [
    relationshipRecord({
      relationship_state: "invited",
      accepted_at_iso8601: null
    }),
    relationshipRecord({
      relationship_state: "rejected",
      accepted_at_iso8601: null
    }),
    relationshipRecord({
      relationship_state: "revoked",
      accepted_at_iso8601: null,
      revoked_at_iso8601: "2026-06-14T12:00:00.000Z"
    }),
    relationshipRecord({
      relationship_state: "expired",
      accepted_at_iso8601: null,
      expires_at_iso8601: "2026-06-14T12:00:00.000Z"
    })
  ];

  for (const relationship of cases) {
    assert.equal(isAcceptedIndividualCoachAthleteRelationship(relationship), false);

    const decision = canCoachViewAssignedAthlete({
      coach_user_id: "coach_001",
      athlete_user_id: "athlete_001",
      relationships: [relationship]
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "coach_not_assigned_to_athlete");
  }
});

test("S-V1-14 athlete can view own data only", () => {
  const own = canAthleteViewAthleteData({
    requester_athlete_user_id: "athlete_001",
    target_athlete_user_id: "athlete_001"
  });

  assert.equal(own.allowed, true);
  assert.equal(own.reason, "athlete_own_data");

  const other = canAthleteViewAthleteData({
    requester_athlete_user_id: "athlete_001",
    target_athlete_user_id: "athlete_002"
  });

  assert.equal(other.allowed, false);
  assert.equal(other.reason, "athlete_not_own_data");

  const routed = decideCoachAthleteRelationshipAccess({
    actor: {
      actor_type: "athlete",
      user_id: "athlete_001"
    },
    target_athlete_user_id: "athlete_002",
    relationships: [relationshipRecord()]
  });

  assert.equal(routed.allowed, false);
  assert.equal(routed.reason, "athlete_not_own_data");
});

test("S-V1-14 refuses forbidden relationship scopes", () => {
  for (const relationship_scope of [
    "team_relationship",
    "organisation_relationship",
    "organization_relationship",
    "gym_relationship",
    "unit_relationship",
    "federation_relationship",
    "enterprise_relationship",
    "friend_connection",
    "social_connection",
    "messaging_thread",
    "chat_thread",
    "marketplace_connection",
    "coach_discovery"
  ]) {
    assertRelationshipRejected(
      validRelationship({ relationship_scope }),
      "coach_athlete_relationship_scope_invalid"
    );
  }
});

test("S-V1-14 refuses unknown fields and engine/scope visible fields", () => {
  assertRelationshipRejected(
    {
      ...validRelationship(),
      team_id: "team_001"
    },
    "coach_athlete_relationship_engine_or_scope_field_refused"
  );

  assertRelationshipRejected(
    {
      ...validRelationship(),
      engine_input: {
        relationship_id: "relationship_001"
      }
    },
    "coach_athlete_relationship_engine_or_scope_field_refused"
  );

  assertRelationshipRejected(
    {
      ...validRelationship(),
      assignment_authority_granted: true
    },
    "coach_athlete_relationship_engine_or_scope_field_refused"
  );

  assertRelationshipRejected(
    {
      ...validRelationship(),
      unexpected_field: true
    },
    "coach_athlete_relationship_unknown_field_refused"
  );
});

test("S-V1-14 validates required relationship fields", () => {
  assertRelationshipRejected(validRelationship({ relationship_id: "" }), "coach_athlete_relationship_id_required");
  assertRelationshipRejected(validRelationship({ coach_user_id: "" }), "coach_athlete_relationship_coach_user_id_required");
  assertRelationshipRejected(validRelationship({ athlete_user_id: "" }), "coach_athlete_relationship_athlete_user_id_required");
  assertRelationshipRejected(validRelationship({ relationship_state: "pending" }), "coach_athlete_relationship_state_invalid");
  assertRelationshipRejected(validRelationship({ created_at_iso8601: "13/06/2026" }), "coach_athlete_relationship_created_at_invalid");
  assertRelationshipRejected(validRelationship({ updated_at_iso8601: "13/06/2026" }), "coach_athlete_relationship_updated_at_invalid");
});

test("S-V1-14 accepted revoked and expired states require explicit timestamps", () => {
  assertRelationshipRejected(
    validRelationship({
      relationship_state: "accepted",
      accepted_at_iso8601: null
    }),
    "coach_athlete_relationship_accepted_at_required"
  );

  assertRelationshipRejected(
    validRelationship({
      relationship_state: "revoked",
      accepted_at_iso8601: null,
      revoked_at_iso8601: null
    }),
    "coach_athlete_relationship_revoked_at_required"
  );

  assertRelationshipRejected(
    validRelationship({
      relationship_state: "expired",
      accepted_at_iso8601: null,
      expires_at_iso8601: null
    }),
    "coach_athlete_relationship_expires_at_required"
  );

  assertRelationshipRejected(
    validRelationship({
      relationship_state: "invited",
      accepted_at_iso8601: "2026-06-13T13:00:00.000Z"
    }),
    "coach_athlete_relationship_unaccepted_has_accepted_at"
  );
});

test("S-V1-14 validation is closed-world and deterministic", () => {
  const first = validateCoachAthleteRelationshipInput(validRelationship());
  const second = validateCoachAthleteRelationshipInput(validRelationship());

  assert.deepEqual(first, { ok: true });
  assert.equal(stableCoachAthleteRelationshipJson(first), stableCoachAthleteRelationshipJson(second));
});

test("S-V1-14 relationship changes do not mutate engine truth probe output", () => {
  const phaseLikeInput = {
    actor_type: "coach",
    execution_scope: "coach_managed",
    activity_id: "powerlifting",
    consent_granted: true,
    governing_authority_id: "coach_001",
    subject_id: "athlete_001"
  };

  const invited = relationshipRecord({
    relationship_state: "invited",
    accepted_at_iso8601: null
  });

  const accepted = relationshipRecord({
    relationship_state: "accepted",
    accepted_at_iso8601: "2026-06-13T13:00:00.000Z"
  });

  const before = compileIgnoringCoachAthleteRelationship(phaseLikeInput, [invited]);
  const after = compileIgnoringCoachAthleteRelationship(phaseLikeInput, [accepted]);

  assert.equal(after, before);
});

test("S-V1-14 access decisions do not mutate engine truth probe output", () => {
  const phaseLikeInput = {
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: "general_strength",
    consent_granted: true,
    subject_id: "athlete_001"
  };

  const denied = decideCoachAthleteRelationshipAccess({
    actor: {
      actor_type: "coach",
      user_id: "coach_999"
    },
    target_athlete_user_id: "athlete_001",
    relationships: [relationshipRecord()]
  });

  const allowed = decideCoachAthleteRelationshipAccess({
    actor: {
      actor_type: "coach",
      user_id: "coach_001"
    },
    target_athlete_user_id: "athlete_001",
    relationships: [relationshipRecord()]
  });

  const before = compileIgnoringCoachAthleteRelationship(phaseLikeInput, [denied]);
  const after = compileIgnoringCoachAthleteRelationship(phaseLikeInput, [allowed]);

  assert.equal(after, before);
});

test("S-V1-14 copy identifiers remain factual and non-advisory", () => {
  const joined = coachAthleteRelationshipCopyIds.join(" ").toLowerCase();

  for (const forbidden of [
    "recommend",
    "optimal",
    "optimise",
    "optimize",
    "readiness",
    "safe",
    "safety",
    "suitable",
    "suitability",
    "rank",
    "score",
    "medical",
    "therapy",
    "risk",
    "performance",
    "outcome",
    "social",
    "friend",
    "team"
  ]) {
    assert.equal(joined.includes(forbidden), false, `copy id leaked forbidden wording: ${forbidden}`);
  }
});
