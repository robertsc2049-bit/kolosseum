// DEV NOTE: FULL-UI-85 team sport + athlete position persistent proof -
// the final slice of the sport-declaration redesign. Covers: org creation
// now requires a declared sport; every locked activity has a position
// list; the athlete's own onboarding declaration carries position,
// cross-validated against activity_id; the coach-1:1 propose/confirm/
// decline tier (athlete_activity_change_service.ts, generalized with a
// change_kind discriminator); the team-coach direct-override tier
// (authorization matrix: active shared-org member + athlete on roster
// succeeds, non-member/individual-mode/athlete-not-on-roster all fail);
// the org-owner direct-override tier (same shape, ownership instead of
// membership); the audit trail for both override tiers; activity-change
// silently clearing an incompatible position; and a fresh-process restart.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

async function listen() {
  return await new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function request(baseUrl, method, route, body, options = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json };
}

function assertStatus(result, status, label) {
  assert.equal(
    result.response.status,
    status,
    `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`
  );
}

function cookieNamed(result, cookieName, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);
  const found = values.find((value) => String(value).startsWith(`${cookieName}=`));
  assert.ok(found, `${label}: expected ${cookieName} cookie`);
  return String(found).split(";")[0];
}

async function registerOrgOwner(baseUrl, nonce, label) {
  const email = `full85_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Full85 ${label} Owner`,
    password: `Full85${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `full85_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Full85 ${label} Coach`,
    email,
    password: `Full85${label}Coach!2026`,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} coach registration`);
  return {
    userId: result.json?.account?.user_id ?? "",
    email,
    cookie: cookieNamed(result, "kolosseum_session", `${label} coach registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerAthlete(baseUrl, nonce, label, activityId) {
  const email = `full85_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Full85 ${label} Athlete`,
    email,
    password: `Full85${label}Athlete!2026`,
    activity_id: activityId,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} athlete registration`);
  return {
    userId: result.json?.account?.user_id ?? "",
    email,
    cookie: cookieNamed(result, "kolosseum_session", `${label} athlete registration`),
    csrf: result.json?.csrf_token
  };
}

function accessibilityPreferences() {
  return { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false };
}

async function completeAthleteOnboarding(baseUrl, athlete, activityId, position) {
  const draft = await request(
    baseUrl, "PATCH", "/account/onboarding/draft",
    {
      current_stage: "review",
      fields: {
        activity_id: activityId,
        position,
        execution_scope: "coach_managed",
        product_acknowledged: true,
        jurisdiction_code: "england_wales",
        jurisdiction_acknowledged: true,
        accessibility_preferences: accessibilityPreferences(),
        instruction_density: "standard"
      }
    },
    { cookie: athlete.cookie, csrf: athlete.csrf }
  );
  assertStatus(draft, 200, "athlete onboarding draft");

  const confirm = await request(baseUrl, "POST", "/account/onboarding/confirm", { review_confirmed: true }, { cookie: athlete.cookie, csrf: athlete.csrf });
  assertStatus(confirm, 200, "athlete onboarding confirm");
  return confirm.json;
}

// Mirrors the established "seed a real, live, unauthenticated product-record
// route" convention (test/org_visibility_lifecycle_persistent.integration.test.mjs).
async function connectRelationship(baseUrl, coachUserId, athleteUserId, relationshipId) {
  const now = new Date().toISOString();
  const result = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: relationshipId,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    relationship_state: "accepted",
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: now,
    created_at_iso8601: now,
    updated_at_iso8601: now,
    revoked_at_iso8601: null,
    expires_at_iso8601: null
  });
  assertStatus(result, 201, `connect coach ${coachUserId} <-> athlete ${athleteUserId}`);
}

async function acceptOrgInvite(baseUrl, coach, membershipId, requestId) {
  const result = await request(
    baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(membershipId)}/accept`,
    { request_id: requestId }, { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(result, 200, `${coach.email} accepts org membership`);
  return result;
}

async function getOnboardingState(baseUrl, athlete) {
  const result = await request(baseUrl, "GET", "/account/onboarding/", undefined, { cookie: athlete.cookie });
  assertStatus(result, 200, "get onboarding state");
  return result.json;
}

test(
  "FULL-UI-85 team sport + athlete position: org creation requires a sport, coach-1:1 propose/confirm/decline, team-coach and org-owner direct-override authorization matrices, audit trail, and activity-change clearing an incompatible position",
  async () => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    let server = null;
    const orgOwnerUserIds = [];
    const coachUserIds = [];
    const athleteUserIds = [];
    const orgIds = [];

    const cleanup = async () => {
      for (const orgId of orgIds) {
        await pool.query("DELETE FROM product_org_audit_records WHERE org_id = $1", [orgId]).catch(() => {});
        await pool.query("DELETE FROM product_org_coach_memberships WHERE org_id = $1", [orgId]).catch(() => {});
        await pool.query("DELETE FROM product_organisations WHERE org_id = $1", [orgId]).catch(() => {});
      }
      for (const userId of orgOwnerUserIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      for (const userId of [...coachUserIds, ...athleteUserIds]) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      const relationshipUserIds = [...coachUserIds, ...athleteUserIds].filter(Boolean);
      if (relationshipUserIds.length > 0) {
        await pool.query(
          `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
          [relationshipUserIds]
        ).catch(() => {});
      }
    };

    try {
      server = await listen();
      let address = server.address();
      let baseUrl = `http://127.0.0.1:${address.port}`;

      const owner = await registerOrgOwner(baseUrl, nonce, "primary");
      orgOwnerUserIds.push(owner.userId);
      const otherOwner = await registerOrgOwner(baseUrl, nonce, "other");
      orgOwnerUserIds.push(otherOwner.userId);

      const coachTeam = await registerCoach(baseUrl, nonce, "team");
      coachUserIds.push(coachTeam.userId);
      const coach1to1 = await registerCoach(baseUrl, nonce, "onetoone");
      coachUserIds.push(coach1to1.userId);

      const athleteA = await registerAthlete(baseUrl, nonce, "a", "rugby_union");
      athleteUserIds.push(athleteA.userId);
      const athleteB = await registerAthlete(baseUrl, nonce, "b", "rugby_union");
      athleteUserIds.push(athleteB.userId);

      await completeAthleteOnboarding(baseUrl, athleteA, "rugby_union", "prop");

      // ============================================================
      // Org creation now requires a declared sport.
      // ============================================================
      const missingActivity = await request(baseUrl, "POST", "/org/organisations", {
        org_name: "Full85 No Sport Team", visibility_mode: "shared"
      }, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(missingActivity, 400, "org creation without a sport is rejected");
      assert.equal(missingActivity.json?.error, "org_roster_activity_required");

      const invalidActivity = await request(baseUrl, "POST", "/org/organisations", {
        org_name: "Full85 Bad Sport Team", activity_id: "cricket", visibility_mode: "shared"
      }, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(invalidActivity, 400, "org creation with an unsupported sport is rejected");
      assert.equal(invalidActivity.json?.error, "org_roster_activity_invalid");

      const teamOrg = await request(baseUrl, "POST", "/org/organisations", {
        org_name: "Full85 Rugby Team", activity_id: "rugby_union", visibility_mode: "shared"
      }, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(teamOrg, 201, "create shared-mode rugby team org");
      assert.equal(teamOrg.json?.organisation?.activity_id, "rugby_union");
      const teamOrgId = teamOrg.json?.organisation?.org_id;
      orgIds.push(teamOrgId);

      const individualOrg = await request(baseUrl, "POST", "/org/organisations", {
        org_name: "Full85 Individual Gym", activity_id: "powerlifting", visibility_mode: "individual"
      }, { cookie: owner.cookie, csrf: owner.csrf });
      assertStatus(individualOrg, 201, "create individual-mode gym org");
      const individualOrgId = individualOrg.json?.organisation?.org_id;
      orgIds.push(individualOrgId);

      // coachTeam joins the shared team org; coach1to1 joins nothing.
      const invite = await request(
        baseUrl, "POST", `/org/organisations/${encodeURIComponent(teamOrgId)}/roster/invite`,
        { coach_email: coachTeam.email, request_id: `invite_${nonce}` }, { cookie: owner.cookie, csrf: owner.csrf }
      );
      assertStatus(invite, 201, "invite coachTeam to the rugby team org");
      await acceptOrgInvite(baseUrl, coachTeam, invite.json?.membership?.membership_id, `accept_${nonce}`);

      // athleteA is on coachTeam's accepted roster (both org-scoped and 1:1);
      // athleteB has NO relationship to coachTeam at all (not on the roster).
      await connectRelationship(baseUrl, coachTeam.userId, athleteA.userId, `rel_${nonce}_team_a`);
      // athleteA also has a plain 1:1 relationship with coach1to1 (who is not
      // a member of any shared org) - the propose/confirm tier.
      await connectRelationship(baseUrl, coach1to1.userId, athleteA.userId, `rel_${nonce}_1to1_a`);

      // ============================================================
      // Team-roster read: coachTeam sees athleteA with activity/position.
      // ============================================================
      const roster = await request(
        baseUrl, "GET", `/coach-workspace/organisations/${encodeURIComponent(teamOrgId)}/athlete-roster`, undefined,
        { cookie: coachTeam.cookie }
      );
      assertStatus(roster, 200, "coachTeam reads the team athlete roster");
      const rosterEntry = roster.json?.roster?.find((entry) => entry.athlete_user_id === athleteA.userId);
      assert.ok(rosterEntry, "expected athleteA on the team roster");
      assert.equal(rosterEntry.activity_id, "rugby_union");
      assert.equal(rosterEntry.position, "prop");
      assert.equal(roster.json?.roster?.some((entry) => entry.athlete_user_id === athleteB.userId), false, "athleteB must not appear - no relationship to coachTeam");

      // ============================================================
      // Negative: coach1to1 is not a member of the team org - denied.
      // ============================================================
      const deniedOverride = await request(
        baseUrl, "POST",
        `/coach-workspace/organisations/${encodeURIComponent(teamOrgId)}/team-athletes/${encodeURIComponent(athleteA.userId)}/position-override`,
        { position: "hooker" }, { cookie: coach1to1.cookie, csrf: coach1to1.csrf }
      );
      assertStatus(deniedOverride, 403, "a non-member coach cannot directly override a team athlete's position");
      assert.equal(deniedOverride.json?.error, "coach_team_position_override_access_denied");

      // ============================================================
      // Negative: athleteB is not on coachTeam's roster - denied.
      // ============================================================
      const notOnRoster = await request(
        baseUrl, "POST",
        `/coach-workspace/organisations/${encodeURIComponent(teamOrgId)}/team-athletes/${encodeURIComponent(athleteB.userId)}/position-override`,
        { position: "hooker" }, { cookie: coachTeam.cookie, csrf: coachTeam.csrf }
      );
      assertStatus(notOnRoster, 403, "an athlete not on the roster cannot be overridden");
      assert.equal(notOnRoster.json?.error, "coach_team_position_override_athlete_not_on_roster");

      // ============================================================
      // Team-coach direct override succeeds - no athlete confirmation.
      // ============================================================
      const teamOverride = await request(
        baseUrl, "POST",
        `/coach-workspace/organisations/${encodeURIComponent(teamOrgId)}/team-athletes/${encodeURIComponent(athleteA.userId)}/position-override`,
        { position: "hooker" }, { cookie: coachTeam.cookie, csrf: coachTeam.csrf }
      );
      assertStatus(teamOverride, 200, "coachTeam directly overrides athleteA's position");
      assert.equal(teamOverride.json?.position, "hooker");

      const afterTeamOverride = await getOnboardingState(baseUrl, athleteA);
      assert.equal(afterTeamOverride.current_effective_declaration.fields.position, "hooker");

      const auditAfterTeam = await request(
        baseUrl, "GET", `/org/organisations/${encodeURIComponent(teamOrgId)}/audit-log`, undefined, { cookie: owner.cookie }
      );
      assertStatus(auditAfterTeam, 200, "owner reads the team org's audit log");
      const teamAuditEntry = auditAfterTeam.json?.audit_log?.find((entry) => entry.action_type === "athlete_position_overridden" && entry.actor_role === "coach");
      assert.ok(teamAuditEntry, "expected a coach-attributed athlete_position_overridden audit entry");

      // ============================================================
      // Org-owner direct override, on an individual-mode org: rejected
      // (visibility gate checked before roster membership).
      // ============================================================
      const individualOverride = await request(
        baseUrl, "POST",
        `/org/organisations/${encodeURIComponent(individualOrgId)}/athletes/${encodeURIComponent(athleteA.userId)}/position-override`,
        { position: "lock" }, { cookie: owner.cookie, csrf: owner.csrf }
      );
      assertStatus(individualOverride, 403, "org-owner override is refused on an individual-mode org");
      assert.equal(individualOverride.json?.error, "org_owner_position_override_requires_shared_visibility");

      // ============================================================
      // Negative: an unrelated org owner cannot override on someone else's org.
      // ============================================================
      const crossOwnerOverride = await request(
        baseUrl, "POST",
        `/org/organisations/${encodeURIComponent(teamOrgId)}/athletes/${encodeURIComponent(athleteA.userId)}/position-override`,
        { position: "lock" }, { cookie: otherOwner.cookie, csrf: otherOwner.csrf }
      );
      assertStatus(crossOwnerOverride, 403, "a different org owner cannot override on this org");
      assert.equal(crossOwnerOverride.json?.error, "org_owner_position_override_access_denied");

      // ============================================================
      // Org-owner direct override succeeds on the shared team org.
      // ============================================================
      const ownerOverride = await request(
        baseUrl, "POST",
        `/org/organisations/${encodeURIComponent(teamOrgId)}/athletes/${encodeURIComponent(athleteA.userId)}/position-override`,
        { position: "lock" }, { cookie: owner.cookie, csrf: owner.csrf }
      );
      assertStatus(ownerOverride, 200, "org owner directly overrides athleteA's position");
      assert.equal(ownerOverride.json?.position, "lock");

      const afterOwnerOverride = await getOnboardingState(baseUrl, athleteA);
      assert.equal(afterOwnerOverride.current_effective_declaration.fields.position, "lock");

      const auditAfterOwner = await request(
        baseUrl, "GET", `/org/organisations/${encodeURIComponent(teamOrgId)}/audit-log`, undefined, { cookie: owner.cookie }
      );
      const ownerAuditEntry = auditAfterOwner.json?.audit_log?.find((entry) => entry.action_type === "athlete_position_overridden" && entry.actor_role === "org_owner");
      assert.ok(ownerAuditEntry, "expected an org_owner-attributed athlete_position_overridden audit entry");

      // ============================================================
      // Coach 1:1 propose/decline, then propose/confirm.
      // ============================================================
      const proposal = await request(
        baseUrl, "POST", "/coach-workspace/athlete-position-change-proposal",
        { athlete_user_id: athleteA.userId, position: "wing" },
        { cookie: coach1to1.cookie, csrf: coach1to1.csrf }
      );
      assertStatus(proposal, 201, "coach1to1 proposes a position change");
      assert.equal(proposal.json?.proposal?.request_state, "proposed");
      assert.equal(proposal.json?.proposal?.change_kind, "position");

      const pendingForCoach = await request(
        baseUrl, "GET", `/coach-workspace/athlete-position-change?athlete_user_id=${encodeURIComponent(athleteA.userId)}`,
        undefined, { cookie: coach1to1.cookie }
      );
      assertStatus(pendingForCoach, 200, "coach1to1 reads the pending position-change state");
      assert.equal(pendingForCoach.json?.position_change?.request_state, "proposed");

      const pendingForAthlete = await request(baseUrl, "GET", "/account/onboarding/activity-change", undefined, { cookie: athleteA.cookie });
      assertStatus(pendingForAthlete, 200, "athlete reads combined activity/position change state");
      assert.equal(pendingForAthlete.json?.position_change?.new_position, "wing");

      const decline = await request(
        baseUrl, "POST", "/account/onboarding/activity-proposal-response",
        { request_id: proposal.json.proposal.request_id, response: "declined" },
        { cookie: athleteA.cookie, csrf: athleteA.csrf }
      );
      assertStatus(decline, 200, "athlete declines the proposed position change");
      assert.equal(decline.json?.request_state, "declined");

      const stillLockAfterDecline = await getOnboardingState(baseUrl, athleteA);
      assert.equal(stillLockAfterDecline.current_effective_declaration.fields.position, "lock", "a decline must not change the declaration");

      const secondProposal = await request(
        baseUrl, "POST", "/coach-workspace/athlete-position-change-proposal",
        { athlete_user_id: athleteA.userId, position: "fullback" },
        { cookie: coach1to1.cookie, csrf: coach1to1.csrf }
      );
      assertStatus(secondProposal, 201, "coach1to1 proposes a second position change");

      const confirm = await request(
        baseUrl, "POST", "/account/onboarding/activity-proposal-response",
        { request_id: secondProposal.json.proposal.request_id, response: "confirmed", apply_at: "immediately" },
        { cookie: athleteA.cookie, csrf: athleteA.csrf }
      );
      assertStatus(confirm, 200, "athlete confirms the second proposal");
      assert.equal(confirm.json?.request_state, "applied");

      const afterConfirm = await getOnboardingState(baseUrl, athleteA);
      assert.equal(afterConfirm.current_effective_declaration.fields.position, "fullback");

      // ============================================================
      // A position invalid for the declared activity is rejected via the
      // self-service preferences editor (assertPositionMatchesActivity).
      // ============================================================
      const invalidPosition = await request(
        baseUrl, "PATCH", "/account/onboarding/preferences",
        {
          accessibility_preferences: accessibilityPreferences(),
          instruction_density: "standard",
          training_focus: [],
          position: "athlete"
        },
        { cookie: athleteA.cookie, csrf: athleteA.csrf }
      );
      assertStatus(invalidPosition, 422, "an athlete-only position is invalid for rugby_union");

      // ============================================================
      // Activity change silently clears an incompatible position.
      // ============================================================
      const activityChange = await request(
        baseUrl, "PATCH", "/account/onboarding/activity",
        { new_activity_id: "powerlifting", apply_at: "immediately" },
        { cookie: athleteA.cookie, csrf: athleteA.csrf }
      );
      assertStatus(activityChange, 200, "athlete self-service activity change to powerlifting");

      const afterActivityChange = await getOnboardingState(baseUrl, athleteA);
      assert.equal(afterActivityChange.current_effective_declaration.fields.activity_id, "powerlifting");
      assert.equal(
        afterActivityChange.current_effective_declaration.fields.position, undefined,
        "the incompatible rugby_union position must be silently cleared on activity change"
      );

      // ============================================================
      // Fresh-process recovery.
      // ============================================================
      await closeServer(server);
      server = await listen();
      address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;

      const freshState = await getOnboardingState(baseUrl, athleteA);
      assert.equal(freshState.current_effective_declaration.fields.activity_id, "powerlifting");
      assert.equal(freshState.current_effective_declaration.fields.position, undefined);
    }
    finally {
      await closeServer(server);
      await cleanup();
    }
  }
);
