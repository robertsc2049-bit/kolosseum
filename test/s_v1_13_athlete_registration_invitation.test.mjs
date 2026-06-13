// DEV NOTE: Human-maintained v1 account test. This file proves S-V1-13
// behaviour without adding auth providers, persistence, UI, social/team/org
// invites, relationship authority, or engine truth.

import test from "node:test";
import assert from "node:assert/strict";

import {
  athleteRegistrationInvitationCopyIds,
  compileIgnoringAthleteRegistrationInvitation,
  createAthleteInvitationRecord,
  createAthleteRegistrationRecord,
  stableAthleteInvitationJson,
  validateAthleteInvitationInput,
  validateAthleteRegistrationInput
} from "../src/athleteRegistrationInvitation.mjs";

function validRegistration(overrides = {}) {
  return {
    athlete_user_id: "athlete_001",
    email: "Athlete.One@Example.com",
    display_name: "Athlete One",
    account_role: "athlete",
    account_state: "active",
    accepted_terms_version: "terms_v1",
    created_at_iso8601: "2026-06-13T12:00:00.000Z",
    ...overrides
  };
}

function validInvitation(overrides = {}) {
  return {
    invite_id: "invite_001",
    invited_by_coach_user_id: "coach_001",
    athlete_email: "Athlete.One@Example.com",
    athlete_display_name: "Athlete One",
    invitation_target_role: "athlete",
    invitation_scope: "athlete_account_access",
    invitation_state: "invited",
    invited_at_iso8601: "2026-06-13T12:00:00.000Z",
    expires_at_iso8601: "2026-06-20T12:00:00.000Z",
    accepted_at_iso8601: null,
    accepted_by_athlete_user_id: null,
    ...overrides
  };
}

function assertRegistrationRejected(input, error) {
  const result = createAthleteRegistrationRecord(input);
  assert.equal(result.status, 400);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, error);
  assert.equal(result.body.copy_id, "ATHLETE_REGISTRATION_REJECTED");
}

function assertInvitationRejected(input, error) {
  const result = createAthleteInvitationRecord(input);
  assert.equal(result.status, 400);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, error);
  assert.equal(result.body.copy_id, "ATHLETE_INVITATION_REJECTED");
}

test("S-V1-13 provisions athlete identity as product auth state only", () => {
  const result = createAthleteRegistrationRecord(validRegistration());

  assert.equal(result.status, 201);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.surface_id, "athlete_registration_invitation");
  assert.equal(result.body.version, "1.0.0");
  assert.equal(result.body.athlete.athlete_user_id, "athlete_001");
  assert.equal(result.body.athlete.email, "athlete.one@example.com");
  assert.equal(result.body.athlete.display_name, "Athlete One");
  assert.equal(result.body.athlete.account_role, "athlete");
  assert.equal(result.body.athlete.account_state, "active");
  assert.equal(result.body.athlete.product_auth_state_only, true);
  assert.equal(result.body.athlete.engine_visible, false);
  assert.deepEqual(result.body.athlete.copy_ids, [
    "ATHLETE_REGISTRATION_CREATED"
  ]);
});

test("S-V1-13 creates athlete invitation as product auth state only", () => {
  const result = createAthleteInvitationRecord(validInvitation());

  assert.equal(result.status, 201);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.invitation.invite_id, "invite_001");
  assert.equal(result.body.invitation.invited_by_coach_user_id, "coach_001");
  assert.equal(result.body.invitation.athlete_email, "athlete.one@example.com");
  assert.equal(result.body.invitation.invitation_target_role, "athlete");
  assert.equal(result.body.invitation.invitation_scope, "athlete_account_access");
  assert.equal(result.body.invitation.invitation_state, "invited");
  assert.equal(result.body.invitation.product_auth_state_only, true);
  assert.equal(result.body.invitation.engine_visible, false);
  assert.equal(result.body.invitation.relationship_created, false);
  assert.deepEqual(result.body.invitation.copy_ids, [
    "ATHLETE_INVITATION_CREATED",
    "ATHLETE_INVITATION_PRODUCT_AUTH_ONLY"
  ]);
});

test("S-V1-13 accepts athlete invitation without creating relationship authority", () => {
  const result = createAthleteInvitationRecord(validInvitation({
    invitation_state: "accepted",
    accepted_at_iso8601: "2026-06-13T13:00:00.000Z",
    accepted_by_athlete_user_id: "athlete_001"
  }));

  assert.equal(result.status, 201);
  assert.equal(result.body.invitation.invitation_state, "accepted");
  assert.equal(result.body.invitation.accepted_by_athlete_user_id, "athlete_001");
  assert.equal(result.body.invitation.engine_visible, false);
  assert.equal(result.body.invitation.relationship_created, false);
  assert.deepEqual(result.body.invitation.copy_ids, [
    "ATHLETE_INVITATION_ACCEPTED",
    "ATHLETE_INVITATION_PRODUCT_AUTH_ONLY"
  ]);
});

test("S-V1-13 supports rejected and expired invitation states without relationship creation", () => {
  for (const invitation_state of ["rejected", "expired"]) {
    const result = createAthleteInvitationRecord(validInvitation({ invitation_state }));
    assert.equal(result.status, 201);
    assert.equal(result.body.invitation.invitation_state, invitation_state);
    assert.equal(result.body.invitation.engine_visible, false);
    assert.equal(result.body.invitation.relationship_created, false);
  }
});

test("S-V1-13 refuses non-athlete registration roles", () => {
  for (const role of [
    "coach",
    "team_admin",
    "gym_admin",
    "federation_admin",
    "enterprise_admin",
    "marketplace_seller"
  ]) {
    assertRegistrationRejected(validRegistration({ account_role: role }), "athlete_registration_role_not_athlete");
  }
});

test("S-V1-13 refuses non-athlete invitation targets and non-account scopes", () => {
  for (const invitation_target_role of [
    "coach",
    "team_admin",
    "organisation_admin",
    "gym_admin",
    "federation_admin",
    "marketplace_buyer"
  ]) {
    assertInvitationRejected(
      validInvitation({ invitation_target_role }),
      "athlete_invitation_target_not_athlete"
    );
  }

  for (const invitation_scope of [
    "friend_request",
    "social_follow",
    "team_invite",
    "organisation_invite",
    "organization_invite",
    "gym_invite",
    "federation_invite",
    "marketplace_access",
    "coach_discovery"
  ]) {
    assertInvitationRejected(
      validInvitation({ invitation_scope }),
      "athlete_invitation_scope_invalid"
    );
  }
});

test("S-V1-13 refuses unknown fields and relationship-created fields", () => {
  assertRegistrationRejected(
    {
      ...validRegistration(),
      team_id: "team_001"
    },
    "athlete_registration_unknown_field_refused"
  );

  assertInvitationRejected(
    {
      ...validInvitation(),
      social_graph_id: "social_001"
    },
    "athlete_invitation_unknown_field_refused"
  );

  assertInvitationRejected(
    {
      ...validInvitation(),
      relationship_created: true
    },
    "athlete_invitation_engine_or_relationship_field_refused"
  );

  assertInvitationRejected(
    {
      ...validInvitation(),
      coach_visibility_granted: true
    },
    "athlete_invitation_engine_or_relationship_field_refused"
  );
});

test("S-V1-13 refuses engine-visible registration and invitation fields", () => {
  assertRegistrationRejected(
    {
      ...validRegistration(),
      engine_input: {
        athlete_user_id: "athlete_001"
      }
    },
    "athlete_registration_engine_or_relationship_field_refused"
  );

  assertInvitationRejected(
    {
      ...validInvitation(),
      compile_input: {
        invite_id: "invite_001"
      }
    },
    "athlete_invitation_engine_or_relationship_field_refused"
  );

  assertInvitationRejected(
    {
      ...validInvitation(),
      can_alter_engine_truth: true
    },
    "athlete_invitation_engine_or_relationship_field_refused"
  );
});

test("S-V1-13 validates required athlete registration and invitation fields", () => {
  assertRegistrationRejected(validRegistration({ athlete_user_id: "" }), "athlete_registration_athlete_user_id_required");
  assertRegistrationRejected(validRegistration({ email: "not-an-email" }), "athlete_registration_email_invalid");
  assertRegistrationRejected(validRegistration({ display_name: "" }), "athlete_registration_display_name_required");
  assertRegistrationRejected(validRegistration({ account_state: "disabled" }), "athlete_registration_account_state_invalid");
  assertRegistrationRejected(validRegistration({ accepted_terms_version: "" }), "athlete_registration_terms_version_required");
  assertRegistrationRejected(validRegistration({ created_at_iso8601: "13/06/2026" }), "athlete_registration_created_at_invalid");

  assertInvitationRejected(validInvitation({ invite_id: "" }), "athlete_invitation_invite_id_required");
  assertInvitationRejected(validInvitation({ invited_by_coach_user_id: "" }), "athlete_invitation_coach_user_id_required");
  assertInvitationRejected(validInvitation({ athlete_email: "not-an-email" }), "athlete_invitation_email_invalid");
  assertInvitationRejected(validInvitation({ athlete_display_name: "" }), "athlete_invitation_display_name_required");
  assertInvitationRejected(validInvitation({ invitation_state: "pending" }), "athlete_invitation_state_invalid");
  assertInvitationRejected(validInvitation({ invited_at_iso8601: "13/06/2026" }), "athlete_invitation_invited_at_invalid");
  assertInvitationRejected(validInvitation({ expires_at_iso8601: "20/06/2026" }), "athlete_invitation_expires_at_invalid");
});

test("S-V1-13 requires accepted invitations to name explicit athlete acceptance details", () => {
  assertInvitationRejected(
    validInvitation({
      invitation_state: "accepted",
      accepted_at_iso8601: null,
      accepted_by_athlete_user_id: "athlete_001"
    }),
    "athlete_invitation_accepted_at_required"
  );

  assertInvitationRejected(
    validInvitation({
      invitation_state: "accepted",
      accepted_at_iso8601: "2026-06-13T13:00:00.000Z",
      accepted_by_athlete_user_id: ""
    }),
    "athlete_invitation_accepted_by_required"
  );

  assertInvitationRejected(
    validInvitation({
      invitation_state: "invited",
      accepted_at_iso8601: "2026-06-13T13:00:00.000Z"
    }),
    "athlete_invitation_unaccepted_has_accepted_at"
  );
});

test("S-V1-13 validation is closed-world and deterministic", () => {
  const firstRegistration = validateAthleteRegistrationInput(validRegistration());
  const secondRegistration = validateAthleteRegistrationInput(validRegistration());
  const firstInvite = validateAthleteInvitationInput(validInvitation());
  const secondInvite = validateAthleteInvitationInput(validInvitation());

  assert.deepEqual(firstRegistration, { ok: true });
  assert.deepEqual(firstInvite, { ok: true });
  assert.equal(stableAthleteInvitationJson(firstRegistration), stableAthleteInvitationJson(secondRegistration));
  assert.equal(stableAthleteInvitationJson(firstInvite), stableAthleteInvitationJson(secondInvite));
});

test("S-V1-13 athlete identity changes do not affect engine truth probe output", () => {
  const phaseLikeInput = {
    actor_type: "coach",
    execution_scope: "coach_managed",
    activity_id: "powerlifting",
    consent_granted: true,
    governing_authority_id: "coach_001",
    subject_id: "athlete_001"
  };

  const firstAthlete = createAthleteRegistrationRecord(validRegistration({
    athlete_user_id: "athlete_001",
    email: "athlete.one@example.com",
    display_name: "Athlete One"
  }));

  const secondAthlete = createAthleteRegistrationRecord(validRegistration({
    athlete_user_id: "athlete_002",
    email: "athlete.two@example.com",
    display_name: "Athlete Two"
  }));

  const before = compileIgnoringAthleteRegistrationInvitation(phaseLikeInput, [firstAthlete.body.athlete]);
  const after = compileIgnoringAthleteRegistrationInvitation(phaseLikeInput, [secondAthlete.body.athlete]);

  assert.equal(after, before);
});

test("S-V1-13 invitation state changes do not affect engine truth probe output", () => {
  const phaseLikeInput = {
    actor_type: "coach",
    execution_scope: "coach_managed",
    activity_id: "general_strength",
    consent_granted: true,
    governing_authority_id: "coach_001",
    subject_id: "athlete_001"
  };

  const invited = createAthleteInvitationRecord(validInvitation({ invitation_state: "invited" }));
  const accepted = createAthleteInvitationRecord(validInvitation({
    invitation_state: "accepted",
    accepted_at_iso8601: "2026-06-13T13:00:00.000Z",
    accepted_by_athlete_user_id: "athlete_001"
  }));

  const invitedCompile = compileIgnoringAthleteRegistrationInvitation(phaseLikeInput, [invited.body.invitation]);
  const acceptedCompile = compileIgnoringAthleteRegistrationInvitation(phaseLikeInput, [accepted.body.invitation]);

  assert.equal(acceptedCompile, invitedCompile);
});

test("S-V1-13 invite copy identifiers remain factual and non-advisory", () => {
  const joined = athleteRegistrationInvitationCopyIds.join(" ").toLowerCase();

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
    "outcome"
  ]) {
    assert.equal(joined.includes(forbidden), false, `copy id leaked forbidden wording: ${forbidden}`);
  }
});
