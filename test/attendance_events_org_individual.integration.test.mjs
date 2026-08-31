// DEV NOTE: Attendance events slice 4 - gym-mode (individual-visibility)
// org-wide events, org-owner-only. Proves the fourth, narrowly-scoped
// exception to org_visibility_service.ts's identity-hiding invariant:
// the owner creates a gym-wide event with NO athlete picker at all
// (every currently-accepted athlete across the org's active coaches is
// auto-invited server-side), and real athlete identity is revealed ONLY
// via the detail/roster view for THIS event, never anywhere else. Also
// proves: an athlete accepted only by a coach OUTSIDE the org is never
// auto-invited; a regular coach (no org-owner session) is rejected
// outright; a different org owner cannot reach this org's event; a
// shared-mode org rejects gym-wide event creation outright; the
// auto-invited athlete can see and RSVP to the event normally; and
// cancel/skip reuse the same underlying management functions correctly
// for an owner identity (sibling occurrence untouched by a skip).

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
  const email = `attendance_gym_${label}_owner_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/org/register", {
    email,
    display_name: `Attendance Gym ${label} Owner`,
    password: `AttendanceGym${label}Owner!2026`
  });
  assertStatus(result, 201, `${label} org owner registration`);
  return {
    userId: result.json?.org_owner?.user_id ?? "",
    cookie: cookieNamed(result, "kolosseum_org_owner_session", `${label} org owner registration`),
    csrf: result.json?.csrf_token
  };
}

async function registerCoach(baseUrl, nonce, label) {
  const email = `attendance_gym_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Attendance Gym ${label} Coach`,
    email,
    password: `AttendanceGym${label}Coach!2026`,
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
    { display_name: `Attendance Gym ${label} Coach`, email },
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
  const email = `attendance_gym_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Attendance Gym ${label} Athlete`,
    email,
    password: `AttendanceGym${label}Athlete!2026`,
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
  "Attendance events gym-wide (individual mode, org-owner-only): auto-invite the whole roster, full identity only for the owner's own created event, non-owner/wrong-owner/shared-mode rejection, auto-invited athlete RSVP, cancel/skip reuse",
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
          `DELETE FROM beta_product_records WHERE subject_user_id = $1 OR actor_user_id = $1`,
          [ownerUserId]
        ).catch(() => {});
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
    const otherOwner = await registerOrgOwner(baseUrl, nonce, "b");
    orgOwnerUserIds.push(otherOwner.userId);

    const coachA = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coachA.userId);
    const coachB = await registerCoach(baseUrl, nonce, "b");
    coachUserIds.push(coachB.userId);
    const outsiderCoach = await registerCoach(baseUrl, nonce, "outsider");
    coachUserIds.push(outsiderCoach.userId);

    const athlete1 = await registerAthlete(baseUrl, nonce, "1"); // coachA's own
    athleteUserIds.push(athlete1.userId);
    const athlete2 = await registerAthlete(baseUrl, nonce, "2"); // coachB's
    athleteUserIds.push(athlete2.userId);
    const outsiderAthlete = await registerAthlete(baseUrl, nonce, "outsider"); // outside the org
    athleteUserIds.push(outsiderAthlete.userId);

    // ============================================================
    // Individual-mode ("gym") org, coachA and coachB both ACTIVE members.
    // ============================================================
    const gymOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Attendance Gym Individual", visibility_mode: "individual"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(gymOrg, 201, "create individual-mode org");
    const gymOrgId = gymOrg.json?.organisation?.org_id;

    const inviteA = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(gymOrgId)}/roster/invite`,
      { coach_email: coachA.email, request_id: `attendance_gym_invite_${nonce}_a` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteA, 201, "invite coachA to gym org");
    await acceptOrgInvite(baseUrl, coachA, inviteA.json?.membership?.membership_id, `attendance_gym_accept_${nonce}_a`);

    const inviteB = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(gymOrgId)}/roster/invite`,
      { coach_email: coachB.email, request_id: `attendance_gym_invite_${nonce}_b` }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(inviteB, 201, "invite coachB to gym org");
    await acceptOrgInvite(baseUrl, coachB, inviteB.json?.membership?.membership_id, `attendance_gym_accept_${nonce}_b`);

    await seedRelationship(baseUrl, {
      relationshipId: `attendance_gym_rel_${nonce}_1`, coachUserId: coachA.userId, athleteUserId: athlete1.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `attendance_gym_rel_${nonce}_2`, coachUserId: coachB.userId, athleteUserId: athlete2.userId, state: "accepted"
    });
    await seedRelationship(baseUrl, {
      relationshipId: `attendance_gym_rel_${nonce}_outsider`, coachUserId: outsiderCoach.userId, athleteUserId: outsiderAthlete.userId, state: "accepted"
    });

    // ============================================================
    // Shared-mode ("team") org owned by the SAME owner - used to prove
    // a shared-mode org rejects gym-wide creation outright.
    // ============================================================
    const teamOrg = await request(baseUrl, "POST", "/org/organisations", {
      org_name: "Attendance Gym Shared Team", visibility_mode: "shared"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(teamOrg, 201, "create shared-mode org");
    const teamOrgId = teamOrg.json?.organisation?.org_id;

    // ============================================================
    // A regular coach (no org-owner session at all) is rejected outright.
    // ============================================================
    const coachAttempt = await request(baseUrl, "POST", `/org/organisations/${encodeURIComponent(gymOrgId)}/attendance-events`, {
      title: "Tuesday CrossFit", location: "Main gym", activity_label: "CrossFit",
      occurrence_date: "2026-09-08", start_time: "18:00", end_time: "19:00"
    }, { cookie: coachA.cookie, csrf: coachA.csrf });
    assertStatus(coachAttempt, 401, "a coach session cannot create a gym-wide event via the owner route");

    // ============================================================
    // A different org owner cannot reach this org at all.
    // ============================================================
    const otherOwnerAttempt = await request(baseUrl, "POST", `/org/organisations/${encodeURIComponent(gymOrgId)}/attendance-events`, {
      title: "Tuesday CrossFit", location: "Main gym", activity_label: "CrossFit",
      occurrence_date: "2026-09-08", start_time: "18:00", end_time: "19:00"
    }, { cookie: otherOwner.cookie, csrf: otherOwner.csrf });
    assertStatus(otherOwnerAttempt, 403, "a different org owner cannot create an event for this org");
    assert.equal(otherOwnerAttempt.json?.error, "attendance_event_org_access_denied");

    // ============================================================
    // A shared-mode org (even owned by the real owner) rejects gym-wide
    // event creation outright.
    // ============================================================
    const sharedModeAttempt = await request(baseUrl, "POST", `/org/organisations/${encodeURIComponent(teamOrgId)}/attendance-events`, {
      title: "Tuesday CrossFit", location: "Main gym", activity_label: "CrossFit",
      occurrence_date: "2026-09-08", start_time: "18:00", end_time: "19:00"
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(sharedModeAttempt, 403, "a shared-mode org rejects gym-wide event creation");
    assert.equal(sharedModeAttempt.json?.error, "attendance_event_org_not_individual_visibility");

    // ============================================================
    // The real owner creates a REAL gym-wide event with NO athlete
    // picker - every accepted athlete across the org's active coaches
    // is auto-invited, and the outsider athlete is never swept in.
    // ============================================================
    const created = await request(baseUrl, "POST", `/org/organisations/${encodeURIComponent(gymOrgId)}/attendance-events`, {
      title: "Tuesday CrossFit", description: "Whole-gym class", location: "Main gym", activity_label: "CrossFit",
      occurrence_date: "2026-09-08", start_time: "18:00", end_time: "19:00",
      recurrence_rule: { frequency: "weekly", interval: 1, weekdays: ["tue"], ends: { type: "after_count", value: 2 } }
    }, { cookie: owner.cookie, csrf: owner.csrf });
    assertStatus(created, 201, "owner creates a real gym-wide event");
    const eventId = created.json?.event?.event_id;
    assert.equal(created.json?.event?.owner_scope, "org");
    assert.equal(created.json?.event?.owner_org_id, gymOrgId);
    assert.equal(created.json?.invited_count, 2, "exactly athlete1 and athlete2 were auto-invited, never the outsider");
    assert.equal(created.json?.occurrences?.length, 2, "the recurring gym class materialized 2 occurrences");
    const [occ0, occ1] = created.json.occurrences;

    // ============================================================
    // The owner's list of gym-wide events for this org includes it.
    // ============================================================
    const ownerEvents = await request(baseUrl, "GET", `/org/organisations/${encodeURIComponent(gymOrgId)}/attendance-events`, undefined, { cookie: owner.cookie });
    assertStatus(ownerEvents, 200, "owner lists gym-wide events for this org");
    assert.equal(ownerEvents.json?.events?.length, 1);
    assert.equal(ownerEvents.json?.events?.[0]?.event_id, eventId);

    // ============================================================
    // The owner's detail/roster view reveals FULL identity for BOTH
    // auto-invited athletes, never the outsider.
    // ============================================================
    const detail = await request(baseUrl, "GET", `/org/organisations/${encodeURIComponent(gymOrgId)}/attendance-events/${encodeURIComponent(eventId)}`, undefined, { cookie: owner.cookie });
    assertStatus(detail, 200, "owner reads the gym-wide event's detail");
    const roster = detail.json?.roster ?? [];
    assert.equal(roster.length, 2);
    const rosterIds = roster.map((entry) => entry.athlete_user_id);
    assert.ok(rosterIds.includes(athlete1.userId));
    assert.ok(rosterIds.includes(athlete2.userId));
    assert.ok(!rosterIds.includes(outsiderAthlete.userId), "the outsider athlete never appears on the gym-wide roster");
    const athlete1Entry = roster.find((entry) => entry.athlete_user_id === athlete1.userId);
    assert.equal(athlete1Entry.display_name, "Attendance Gym 1 Athlete", "full real identity, not an aggregate");

    // A different org owner cannot view this event's detail either.
    const otherOwnerDetail = await request(baseUrl, "GET", `/org/organisations/${encodeURIComponent(gymOrgId)}/attendance-events/${encodeURIComponent(eventId)}`, undefined, { cookie: otherOwner.cookie });
    assertStatus(otherOwnerDetail, 403, "a different org owner cannot view this org's event detail");

    // ============================================================
    // athlete1 (auto-invited, never explicitly picked) sees the event
    // and RSVPs normally.
    // ============================================================
    const mine = await request(baseUrl, "GET", "/attendance-events/mine", undefined, { cookie: athlete1.cookie });
    assertStatus(mine, 200, "athlete1 reads own invited occurrences");
    assert.equal(mine.json?.occurrences?.length, 2);

    const rsvp = await request(
      baseUrl, "POST", `/attendance-events/occurrences/${encodeURIComponent(occ0.occurrence_id)}/rsvp`,
      { rsvp_state: "attending" }, { cookie: athlete1.cookie, csrf: athlete1.csrf }
    );
    assertStatus(rsvp, 201, "athlete1 submits an RSVP to the gym-wide event");

    // ============================================================
    // The owner reschedules occurrence 0 (which already carries
    // athlete1's RSVP) to a new date/time - the RSVP must survive since
    // it's the same occurrence_id, just moved.
    // ============================================================
    const rescheduled = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(gymOrgId)}/attendance-events/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(occ0.occurrence_id)}/reschedule`,
      { new_date: "2026-09-09", new_start_time: "19:00", new_end_time: "20:00" }, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(rescheduled, 200, "owner reschedules occurrence 0");
    assert.equal(rescheduled.json?.occurrence?.status, "rescheduled");
    assert.equal(rescheduled.json?.occurrence?.rescheduled_to_date, "2026-09-09");

    const detailAfterReschedule = await request(baseUrl, "GET", `/org/organisations/${encodeURIComponent(gymOrgId)}/attendance-events/${encodeURIComponent(eventId)}`, undefined, { cookie: owner.cookie });
    assertStatus(detailAfterReschedule, 200, "owner re-reads detail after reschedule");
    const athlete1RosterAfterReschedule = (detailAfterReschedule.json?.roster ?? []).find((entry) => entry.athlete_user_id === athlete1.userId);
    assert.equal(athlete1RosterAfterReschedule?.rsvp_by_occurrence?.[occ0.occurrence_id], "attending", "occurrence 0's RSVP survived its own reschedule");
    const occ1AfterReschedule = (detailAfterReschedule.json?.occurrences ?? []).find((occurrence) => occurrence.occurrence_id === occ1.occurrence_id);
    assert.equal(occ1AfterReschedule?.status, "scheduled", "occurrence 1 is untouched by occurrence 0's reschedule");

    // A non-owner (a different org owner) cannot reschedule this event's
    // occurrences either.
    const otherOwnerReschedule = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(gymOrgId)}/attendance-events/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(occ1.occurrence_id)}/reschedule`,
      { new_date: "2026-09-16" }, { cookie: otherOwner.cookie, csrf: otherOwner.csrf }
    );
    assertStatus(otherOwnerReschedule, 403, "a different org owner cannot reschedule this org's occurrence");

    // ============================================================
    // The owner skips occurrence 1, leaving occurrence 0 (and its RSVP,
    // and its reschedule) completely untouched - proving cancel/skip
    // correctly reuse the same underlying management functions for an
    // owner identity.
    // ============================================================
    const skipped = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(gymOrgId)}/attendance-events/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(occ1.occurrence_id)}/skip`,
      {}, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(skipped, 200, "owner skips occurrence 1");
    assert.equal(skipped.json?.occurrence?.status, "skipped");

    const detailAfterSkip = await request(baseUrl, "GET", `/org/organisations/${encodeURIComponent(gymOrgId)}/attendance-events/${encodeURIComponent(eventId)}`, undefined, { cookie: owner.cookie });
    assertStatus(detailAfterSkip, 200, "owner re-reads detail after skip");
    const occ0AfterSkip = (detailAfterSkip.json?.occurrences ?? []).find((occurrence) => occurrence.occurrence_id === occ0.occurrence_id);
    assert.equal(occ0AfterSkip?.status, "rescheduled", "occurrence 0 is untouched by occurrence 1's skip");
    const athlete1RosterAfterSkip = (detailAfterSkip.json?.roster ?? []).find((entry) => entry.athlete_user_id === athlete1.userId);
    assert.equal(athlete1RosterAfterSkip?.rsvp_by_occurrence?.[occ0.occurrence_id], "attending", "occurrence 0's RSVP survived the sibling skip");

    // ============================================================
    // The owner cancels the whole event; a coach's public roster/detail
    // route can never see a gym-wide event at all (it was never created
    // under a coach identity).
    // ============================================================
    const cancelled = await request(
      baseUrl, "POST", `/org/organisations/${encodeURIComponent(gymOrgId)}/attendance-events/${encodeURIComponent(eventId)}/cancel`,
      {}, { cookie: owner.cookie, csrf: owner.csrf }
    );
    assertStatus(cancelled, 200, "owner cancels the gym-wide event");
    assert.equal(cancelled.json?.event?.status, "cancelled");

    const coachDetailAttempt = await request(baseUrl, "GET", `/attendance-events/${encodeURIComponent(eventId)}`, undefined, { cookie: coachA.cookie });
    assertStatus(coachDetailAttempt, 404, "a coach can never see a gym-wide event through the coach-facing route");
  }
);
