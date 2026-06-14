// DEV NOTE: Human-maintained v1 permission guard test. This file proves
// reusable product/auth relationship guards fail closed without adding engine
// behaviour, registry content, broad RBAC, organisation/team/gym/federation roles,
// server rewiring, assignment authority, or UI.

import test from "node:test";
import assert from "node:assert/strict";

import {
  RelationshipPermissionGuardError,
  assertAthleteCanViewOwnData,
  assertCoachAthleteAccess,
  assertCoachCanViewAthlete,
  assertRelationshipPermissionInput,
  assertSurfaceCanUseRelationshipPermissionGuard,
  canCoachAthleteAccess,
  compileIgnoringRelationshipPermissionGuards,
  denyRelationshipPermission,
  relationshipPermissionAllowedSurfaceIds,
  relationshipPermissionCopyIds,
  relationshipPermissionFailureCode,
  relationshipPermissionFailureCopyId
} from "../src/relationshipPermissionGuards.mjs";

function acceptedRelationship(overrides = {}) {
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
    product_permission_state_only: true,
    engine_visible: false,
    ...overrides
  };
}

function acceptedLegacyLink(overrides = {}) {
  return {
    link_id: "link_001",
    coach_user_id: "coach_001",
    athlete_user_id: "athlete_001",
    status: "accepted",
    ...overrides
  };
}

function assertProductAuthDenied(fn, reason) {
  assert.throws(
    fn,
    (error) =>
      error instanceof RelationshipPermissionGuardError &&
      error.code === relationshipPermissionFailureCode &&
      error.reason === reason &&
      error.product_auth_failure === true &&
      error.engine_decision === false &&
      error.engine_visible === false &&
      error.copy_id === relationshipPermissionFailureCopyId
  );
}

test("S-V1-15 allows only declared reusable relationship permission surfaces", () => {
  assert.deepEqual(relationshipPermissionAllowedSurfaceIds, [
    "coach_notes",
    "session_artefacts",
    "live_session_status",
    "factual_history"
  ]);

  for (const surfaceId of relationshipPermissionAllowedSurfaceIds) {
    assert.equal(assertSurfaceCanUseRelationshipPermissionGuard(surfaceId), true);
  }

  assertProductAuthDenied(
    () => assertSurfaceCanUseRelationshipPermissionGuard("team_dashboard"),
    "relationship_permission_surface_not_allowed"
  );
});

test("S-V1-15 assertCoachCanViewAthlete allows assigned accepted individual relationship", () => {
  const result = assertCoachCanViewAthlete({
    coach_user_id: "coach_001",
    athlete_user_id: "athlete_001",
    surface_id: "coach_notes",
    relationships: [acceptedRelationship()]
  });

  assert.equal(result, true);

  const decision = canCoachAthleteAccess({
    actor: {
      actor_type: "coach",
      user_id: "coach_001"
    },
    target_athlete_user_id: "athlete_001",
    surface_id: "coach_notes",
    relationships: [acceptedRelationship()]
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, "coach_assigned_to_athlete");
  assert.equal(decision.product_permission_state_only, true);
  assert.equal(decision.engine_decision, false);
  assert.equal(decision.engine_visible, false);
});

test("S-V1-15 assertCoachCanViewAthlete allows existing accepted link shape for reusable read surfaces", () => {
  for (const surface_id of ["coach_notes", "session_artefacts", "live_session_status"]) {
    assert.equal(assertCoachCanViewAthlete({
      coach_user_id: "coach_001",
      athlete_user_id: "athlete_001",
      surface_id,
      relationships: [acceptedLegacyLink()]
    }), true);
  }
});

test("S-V1-15 factual history honours scoped history permission when scope exists", () => {
  assert.equal(assertCoachCanViewAthlete({
    coach_user_id: "coach_001",
    athlete_user_id: "athlete_001",
    surface_id: "factual_history",
    relationships: [
      acceptedLegacyLink({
        scope: {
          history_counts: true
        }
      })
    ]
  }), true);

  assertProductAuthDenied(
    () => assertCoachCanViewAthlete({
      coach_user_id: "coach_001",
      athlete_user_id: "athlete_001",
      surface_id: "factual_history",
      relationships: [
        acceptedLegacyLink({
          scope: {
            history_counts: false
          }
        })
      ]
    }),
    "coach_not_assigned_to_athlete"
  );
});

test("S-V1-15 assertCoachCanViewAthlete fails closed for unassigned coach", () => {
  assertProductAuthDenied(
    () => assertCoachCanViewAthlete({
      coach_user_id: "coach_002",
      athlete_user_id: "athlete_001",
      surface_id: "coach_notes",
      relationships: [acceptedRelationship()]
    }),
    "coach_not_assigned_to_athlete"
  );
});

test("S-V1-15 assertCoachCanViewAthlete fails closed for non-accepted relationship states", () => {
  for (const relationship_state of ["invited", "rejected", "revoked", "expired"]) {
    assertProductAuthDenied(
      () => assertCoachCanViewAthlete({
        coach_user_id: "coach_001",
        athlete_user_id: "athlete_001",
        surface_id: "session_artefacts",
        relationships: [
          acceptedRelationship({
            relationship_state,
            accepted_at_iso8601: relationship_state === "accepted" ? "2026-06-13T13:00:00.000Z" : null,
            revoked_at_iso8601: relationship_state === "revoked" ? "2026-06-14T13:00:00.000Z" : null,
            expires_at_iso8601: relationship_state === "expired" ? "2026-06-14T13:00:00.000Z" : null
          })
        ]
      }),
      "coach_not_assigned_to_athlete"
    );
  }
});

test("S-V1-15 assertCoachCanViewAthlete fails closed for non-individual relationship scope", () => {
  for (const relationship_scope of [
    "team_relationship",
    "organisation_relationship",
    "organization_relationship",
    "gym_relationship",
    "federation_relationship",
    "enterprise_relationship",
    "social_connection",
    "marketplace_connection"
  ]) {
    assertProductAuthDenied(
      () => assertCoachCanViewAthlete({
        coach_user_id: "coach_001",
        athlete_user_id: "athlete_001",
        surface_id: "live_session_status",
        relationships: [
          acceptedRelationship({ relationship_scope })
        ]
      }),
      "coach_not_assigned_to_athlete"
    );
  }
});

test("S-V1-15 assertAthleteCanViewOwnData allows own data and rejects another athlete", () => {
  assert.equal(assertAthleteCanViewOwnData({
    requester_athlete_user_id: "athlete_001",
    target_athlete_user_id: "athlete_001",
    surface_id: "factual_history"
  }), true);

  assertProductAuthDenied(
    () => assertAthleteCanViewOwnData({
      requester_athlete_user_id: "athlete_001",
      target_athlete_user_id: "athlete_002",
      surface_id: "factual_history"
    }),
    "athlete_not_own_data"
  );
});

test("S-V1-15 assertCoachAthleteAccess routes coach and athlete actors correctly", () => {
  assert.equal(assertCoachAthleteAccess({
    actor: {
      actor_type: "coach",
      user_id: "coach_001"
    },
    target_athlete_user_id: "athlete_001",
    surface_id: "session_artefacts",
    relationships: [acceptedRelationship()]
  }), true);

  assert.equal(assertCoachAthleteAccess({
    actor: {
      actor_type: "athlete",
      user_id: "athlete_001"
    },
    target_athlete_user_id: "athlete_001",
    surface_id: "session_artefacts",
    relationships: []
  }), true);

  assertProductAuthDenied(
    () => assertCoachAthleteAccess({
      actor: {
        actor_type: "athlete",
        user_id: "athlete_001"
      },
      target_athlete_user_id: "athlete_002",
      surface_id: "session_artefacts",
      relationships: [acceptedRelationship()]
    }),
    "athlete_not_own_data"
  );
});

test("S-V1-15 permission input refuses forbidden engine and broad RBAC fields", () => {
  for (const forbidden of [
    { engine_input: { relationship_id: "relationship_001" } },
    { compile_input: { relationship_id: "relationship_001" } },
    { assignment_authority_granted: true },
    { broad_rbac: true },
    { organisation_role: "manager" },
    { organization_role: "manager" },
    { team_role: "captain" },
    { gym_role: "admin" },
    { federation_role: "admin" },
    { social_connection_id: "social_001" },
    { message_thread_id: "message_001" },
    { chat_thread_id: "chat_001" },
    { marketplace_connection_id: "market_001" },
    { coach_discovery_id: "directory_001" }
  ]) {
    assertProductAuthDenied(
      () => assertRelationshipPermissionInput({
        actor: {
          actor_type: "coach",
          user_id: "coach_001"
        },
        target_athlete_user_id: "athlete_001",
        surface_id: "coach_notes",
        relationships: [acceptedRelationship()],
        ...forbidden
      }),
      "relationship_permission_forbidden_field_refused"
    );
  }
});

test("S-V1-15 permission failure is product auth failure not engine decision", () => {
  try {
    denyRelationshipPermission("manual_test_denial", {
      probe: true
    });
  } catch (error) {
    assert.equal(error instanceof RelationshipPermissionGuardError, true);
    assert.equal(error.code, relationshipPermissionFailureCode);
    assert.equal(error.reason, "manual_test_denial");
    assert.equal(error.product_auth_failure, true);
    assert.equal(error.product_permission_state_only, true);
    assert.equal(error.engine_decision, false);
    assert.equal(error.engine_visible, false);
    assert.equal(error.copy_id, relationshipPermissionFailureCopyId);
    return;
  }

  assert.fail("denyRelationshipPermission should throw");
});

test("S-V1-15 non-throwing decision still denies invalid input as product auth failure", () => {
  const decision = canCoachAthleteAccess({
    actor: {
      actor_type: "coach",
      user_id: "coach_001"
    },
    target_athlete_user_id: "athlete_001",
    surface_id: "unknown_surface",
    relationships: [acceptedRelationship()]
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "relationship_permission_surface_not_allowed");
  assert.equal(decision.product_auth_failure, true);
  assert.equal(decision.engine_decision, false);
  assert.equal(decision.engine_visible, false);
});

test("S-V1-15 permission guard state does not mutate engine truth probe output", () => {
  const phaseLikeInput = {
    actor_type: "coach",
    execution_scope: "coach_managed",
    activity_id: "powerlifting",
    consent_granted: true,
    governing_authority_id: "coach_001",
    subject_id: "athlete_001"
  };

  const allowed = canCoachAthleteAccess({
    actor: {
      actor_type: "coach",
      user_id: "coach_001"
    },
    target_athlete_user_id: "athlete_001",
    surface_id: "coach_notes",
    relationships: [acceptedRelationship()]
  });

  const denied = canCoachAthleteAccess({
    actor: {
      actor_type: "coach",
      user_id: "coach_002"
    },
    target_athlete_user_id: "athlete_001",
    surface_id: "coach_notes",
    relationships: [acceptedRelationship()]
  });

  const before = compileIgnoringRelationshipPermissionGuards(phaseLikeInput, [allowed]);
  const after = compileIgnoringRelationshipPermissionGuards(phaseLikeInput, [denied]);

  assert.equal(after, before);
});

test("S-V1-15 copy identifiers remain factual and non-advisory", () => {
  const joined = relationshipPermissionCopyIds.join(" ").toLowerCase();

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
    "team",
    "organisation",
    "organization",
    "gym",
    "federation",
    "rbac"
  ]) {
    assert.equal(joined.includes(forbidden), false, `copy id leaked forbidden wording: ${forbidden}`);
  }
});
