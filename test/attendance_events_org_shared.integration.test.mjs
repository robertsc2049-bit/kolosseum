// DEV NOTE: Attendance events slice 3 - team-mode (shared-visibility)
// org-wide events. Proves the genuinely new authorization surface: any
// ACTIVE coach in a shared-mode org can create an org-wide event and
// invite athletes belonging to OTHER coaches in the same org, and sees
// FULL identity for every invited athlete regardless of which coach
// they belong to (per the user's explicit product decision - no
// aggregate-only fallback for this slice). Also proves: an athlete
// accepted only by a coach OUTSIDE the org can never be invited; a
// coach who isn't an active member of the org is rejected outright; an
// individual-mode ("gym") org is rejected outright (never shared-style
// org-wide events); and the athlete invited via another coach's
// org-wide event can see and RSVP to it normally.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

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

function cookieNamed(result, cookieName, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const found = values.find((value) => String(value).startsWith(`${cookieName}=`));
  assert.ok(found, `${label}: expected ${cookieName} cookie`);
  return String(found).split(";")[0];
}

function assertStatus(result, status, label) {
  assert.equal(
    result.response.status,
    status,
    `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`
  );
}

async function registerOrgOwner(baseUrl, nonce, label) {
  const email = `attendance_org_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Attendance Org ${label} Owner`,
    password: `AttendanceOrg${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `attendance_org_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Attendance Org ${label} Coach`,
    email,
    password: `AttendanceOrg${label}Coach!2026`,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, `${label} coach registration`);
  const cookie = cookieNamed(result, "kolosseum_session", `${label} coach registration`);
  const csrf = result.json?.csrf_token;

  assertStatus(await request(
    baseUrl, "PATCH", "/account/coach-onboarding/profile",
    { display_name: `Attendance Org ${label} Coach`, email },
    { cookie, csrf }
  ), 200, `${label} coach onboarding profile`);
  assertStatus(await request(
    baseUrl, "POST", "/account/coach-onboarding/terms",
    { accepted: true, terms_version: "terms_v1" },
    { cookie, csrf }
  ), 200, `${label} coach onboarding terms`);
  assertStatus(await request(
    baseUrl, "POST", "/account/coach-onboarding/complete",
    { completion_confirmed: true },
    { cookie, csrf }
  ), 200, `${label} coach onboarding complete`);

  return { userId: result.json?.account?.user_id ?? "", email, cookie, csrf };
}

async function registerAthlete(baseUrl, nonce, label) {
  const email = `attendance_org_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Attendance Org ${label} Athlete`,
    email,
    password: `AttendanceOrg${label}Athlete!2026`,
    activity_id: "powerlifting",
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

async function seedRelationship(baseUrl, { relationshipId, coachUserId, athleteUserId, state }) {
  const now = new Date().toISOString();
  const result = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: relationshipId,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    relationship_state: state,
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: state === "accepted" ? now : null,
    created_at_iso8601: now,
    updated_at_iso8601: now,
    revoked_at_iso8601: null,
    expires_at_iso8601: null
  });
  assertStatus(result, 201, `seed ${state} relationship ${relationshipId}`);
}

async function acceptOrgInvite(baseUrl, coach, membershipId, requestId) {
  const result = await request(
    baseUrl, "POST", `/coach-workspace/org-memberships/${encodeURIComponent(membershipId)}/accept`,
    { request_id: requestId }, { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(result, 200, `${coach.email} accepts org membership`);
  return result;
}

test(
  "Attendance events org-wide (shared mode): cross-coach full-identity invite, non-member/individual-mode rejection, outside-org athlete rejection, invited athlete RSVP",
  async (testContext) => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    const orgOwnerUserIds = [];
    const coachUserIds = [];
    const athleteUserIds = [];

    const cleanup = async () => {
      const allUserIds = [...coachUserIds, ...athleteUserIds].filter(Boolean);
      if (allUserIds.length > 0) {
        await pool.query(
          `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
          [allUserIds]
        ).catch(() => {});
      }
      for (const userId of allUserIds) {
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      for (const ownerUserId of orgOwnerUserIds) {
        await pool.query(
          "DELETE FROM product_org_audit_records WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)",
          [ownerUserId]
        ).catch(() => {});
        await pool.query(
          "DELETE FROM product_org_coach_memberships WHERE org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)",
          [ownerUserId]
        ).catch(() => {});
        await pool.query("DELETE FROM product_organisations WHERE owner_user_id = $1", [ownerUserId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_sessions WHERE user_id = $1", [ownerUserId]).catch(() => {});
        await pool.query("DELETE FROM product_org_owner_accounts WHERE user_id = $1", [ownerUserId]).catch(() => {});
      }
    };

    testContext.after(async () => {
      await closeServer(server);
      await cleanup();
    });

    server = await listen();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const owner = await registerOrgOwner(baseUrl, nonce, "a");
    orgOwnerUserIds.push(owner.userId);

    const coachA = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coachA.userId);
    const coachB = await registerCoach(baseUrl, nonce, "b");
    coachUserIds.push(coachB.userId);
    const outsiderCoach = await registerCoach(baseUrl, nonce, "outsider");
    coachUserIds.push(outsiderCoach.userId);

    const athlete1 = await registerAthlete(baseUrl, nonce, "1"); // coachA's own
    athleteUserIds.push(athlete1.userId);
    const athlete2 = await registerAthlete(baseUrl, nonce, "2"); // coachB's - a DIFFERENT coach in the SAME org
    athleteUserIds.push(athlete2.userId);
    const outsiderAthlete = await registerAthlete(baseUrl, nonce, "outsider"); // accepted by a coach OUTSIDE the org
    athleteUserIds.push(outsiderAthlete.userId);

    // ============================================================
    // Shared-mode ("team") org, coachA and coachB both ACTIVE members.
    // ============================================================
    const teamOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Attendance Org Shared Team", visibility_mode: "shared"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(teamOrg, 201, "create shared-mode org");
    const teamOrgId = teamOrg.json?.organisation?.org_id;

    const inviteA = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(teamOrgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `attendance_org_invite_${nonce}_a` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteA, 201, "invite coachA to team org");
    await acceptOrgInvite(baseUrl, coachA, inviteA.json?.membership?.membership_id, `attendance_org_accept_${nonce}_a`);

    const inviteB = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(teamOrgId)}/roster/invite`,
      { coach_email: coachB.email, request_id: `attendance_org_invite_${nonce}_b` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteB, 201, "invite coachB to team org");
    await acceptOrgInvite(baseUrl, coachB, inviteB.json?.membership?.membership_id, `attendance_org_accept_${nonce}_b`);

    await seedRelationship(baseUrl, {
      relationshipId: `attendance_org_rel_${nonce}_1`, coachUserId: coachA.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `attendance_org_rel_${nonce}_2`, coachUserId: coachB.userId, athleteUserId: athlete2.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `attendance_org_rel_${nonce}_outsider`, coachUserId: outsiderCoach.userId, athleteUserId: outsiderAthlete.userId, state: "accepted"
    });

    // ============================================================
    // Individual-mode ("gym") org, coachA also an ACTIVE member - used
    // to prove an individual-mode org rejects org-wide event creation
    // outright.
    // ============================================================
    const gymOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Attendance Org Individual Gym", visibility_mode: "individual"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(gymOrg, 201, "create individual-mode org");
    const gymOrgId = gymOrg.json?.organisation?.org_id;

    const gymInviteA = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(gymOrgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `attendance_org_invite_${nonce}_gym_a` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(gymInviteA, 201, "invite coachA to gym org");
    await acceptOrgInvite(baseUrl, coachA, gymInviteA.json?.membership?.membership_id, `attendance_org_accept_${nonce}_gym_a`);

    // ============================================================
    // A coach who is NOT an active member of the shared-mode org is
    // rejected outright.
    // ============================================================
    const nonMemberCreate = await request(baseUrl, "POST", "/attendance-events", {
      title: "Team practice", location: "Main gym", activity_label: "Powerlifting",
      occurrence_date: "2026-09-07", start_time: "09:00", end_time: "10:00",
      owner_scope: "org", owner_org_id: teamOrgId
    }, { cookie: outsiderCoach.cookie, csrf: outsiderCoach.csrf });
    assertStatus(nonMemberCreate, 403, "a non-member coach cannot create an org-wide event");
    assert.equal(nonMemberCreate.json?.error, "attendance_event_org_membership_required");

    // ============================================================
    // An individual-mode ("gym") org rejects org-wide event creation
    // outright, even for an active member.
    // ============================================================
    const gymModeCreate = await request(baseUrl, "POST", "/attendance-events", {
      title: "Gym class", location: "Main gym", activity_label: "Powerlifting",
      occurrence_date: "2026-09-07", start_time: "09:00", end_time: "10:00",
      owner_scope: "org", owner_org_id: gymOrgId
    }, { cookie: coachA.cookie, csrf: coachA.csrf });
    assertStatus(gymModeCreate, 403, "an individual-mode org rejects org-wide event creation");
    assert.equal(gymModeCreate.json?.error, "attendance_event_org_not_shared_visibility");

    // ============================================================
    // An athlete accepted only by a coach OUTSIDE the org can never be
    // invited to an org-wide event.
    // ============================================================
    const outsiderInviteRejected = await request(baseUrl, "POST", "/attendance-events", {
      title: "Team practice", location: "Main gym", activity_label: "Powerlifting",
      occurrence_date: "2026-09-07", start_time: "09:00", end_time: "10:00",
      owner_scope: "org", owner_org_id: teamOrgId,
      athlete_user_ids: [outsiderAthlete.userId]
    }, { cookie: coachA.cookie, csrf: coachA.csrf });
    assertStatus(outsiderInviteRejected, 403, "an athlete outside the org cannot be invited to an org-wide event");
    assert.equal(outsiderInviteRejected.json?.error, "attendance_event_org_invite_athlete_not_accepted");

    const eventsBeforeReal = await request(baseUrl, "GET", "/attendance-events", undefined, { cookie: coachA.cookie });
    assertStatus(eventsBeforeReal, 200, "coachA reads own events before creating the real org-wide event");
    assert.equal(eventsBeforeReal.json?.events?.length, 0, "none of the rejected creates left an orphaned event behind");

    // ============================================================
    // The org-roster picker: coachA sees BOTH athlete1 (own) and
    // athlete2 (coachB's) with full identity, never the outsider
    // athlete.
    // ============================================================
    const orgRoster = await request(baseUrl, "GET", `/attendance-events/org-roster/${encodeURIComponent(teamOrgId)}`, undefined, { cookie: coachA.cookie });
    assertStatus(orgRoster, 200, "coachA reads the team org's accepted-athlete roster");
    const orgRosterIds = (orgRoster.json?.athletes ?? []).map((athlete) => athlete.athlete_user_id);
    assert.ok(orgRosterIds.includes(athlete1.userId), "org roster includes coachA's own athlete");
    assert.ok(orgRosterIds.includes(athlete2.userId), "org roster includes coachB's athlete too");
    assert.ok(!orgRosterIds.includes(outsiderAthlete.userId), "org roster never includes an athlete outside the org");

    // ============================================================
    // coachA creates a REAL org-wide event, inviting athlete1 (own) AND
    // athlete2 (coachB's) - the genuinely new cross-coach capability.
    // ============================================================
    const created = await request(baseUrl, "POST", "/attendance-events", {
      title: "Team practice", description: "Whole-team session", location: "Main gym", activity_label: "Powerlifting",
      occurrence_date: "2026-09-07", start_time: "09:00", end_time: "10:00",
      owner_scope: "org", owner_org_id: teamOrgId,
      athlete_user_ids: [athlete1.userId, athlete2.userId]
    }, { cookie: coachA.cookie, csrf: coachA.csrf });
    assertStatus(created, 201, "coachA creates a real org-wide event");
    const eventId = created.json?.event?.event_id;
    const occurrenceId = created.json?.occurrences?.[0]?.occurrence_id;
    assert.equal(created.json?.event?.owner_scope, "org");
    assert.equal(created.json?.event?.owner_org_id, teamOrgId);
    assert.equal(created.json?.invites?.length, 2, "both athletes were invited");

    // ============================================================
    // coachA's detail view shows FULL identity for BOTH athletes,
    // including athlete2 who belongs to coachB, not coachA.
    // ============================================================
    const detail = await request(baseUrl, "GET", `/attendance-events/${encodeURIComponent(eventId)}`, undefined, { cookie: coachA.cookie });
    assertStatus(detail, 200, "coachA reads the org-wide event's detail");
    const roster = detail.json?.roster ?? [];
    assert.equal(roster.length, 2);
    const athlete2Entry = roster.find((entry) => entry.athlete_user_id === athlete2.userId);
    assert.ok(athlete2Entry, "athlete2 (coachB's athlete) appears on coachA's roster view");
    assert.equal(athlete2Entry.display_name, "Attendance Org 2 Athlete", "full real identity, not an aggregate");

    // ============================================================
    // athlete2 (invited via another coach's org-wide event) sees it in
    // their own "mine" list and can RSVP normally.
    // ============================================================
    const mine = await request(baseUrl, "GET", "/attendance-events/mine", undefined, { cookie: athlete2.cookie });
    assertStatus(mine, 200, "athlete2 reads own invited occurrences");
    assert.equal(mine.json?.occurrences?.length, 1);
    assert.equal(mine.json?.occurrences?.[0]?.title, "Team practice");

    const rsvp = await request(
      baseUrl, "POST", `/attendance-events/occurrences/${encodeURIComponent(occurrenceId)}/rsvp`,
      { rsvp_state: "attending" }, { cookie: athlete2.cookie, csrf: athlete2.csrf }
    );
    assertStatus(rsvp, 201, "athlete2 submits an RSVP to the org-wide event");

    const detailAfterRsvp = await request(baseUrl, "GET", `/attendance-events/${encodeURIComponent(eventId)}`, undefined, { cookie: coachA.cookie });
    assertStatus(detailAfterRsvp, 200, "coachA re-reads the event detail after athlete2's RSVP");
    const athlete2AfterRsvp = (detailAfterRsvp.json?.roster ?? []).find((entry) => entry.athlete_user_id === athlete2.userId);
    assert.equal(athlete2AfterRsvp?.rsvp_by_occurrence?.[occurrenceId], "attending");
  }
);
