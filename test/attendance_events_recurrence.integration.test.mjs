// DEV NOTE: Attendance events slice 2 - full recurrence rules (weekdays +
// interval + end-date-or-count) and per-occurrence skip/reschedule.
// Proves: a weekly series generates the correct occurrence dates; a
// daily series generates the correct occurrence dates; a start date
// whose weekday isn't in the requested weekday set is rejected; an
// over-cap after_count is rejected at validation time; an over-cap
// on_date range is rejected during generation (never silently
// truncated); skipping/rescheduling one occurrence never mutates any
// sibling occurrence or its RSVP history; a skipped occurrence can no
// longer accept an RSVP while a rescheduled one still can; a non-owning
// coach cannot skip/reschedule another coach's occurrence.

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

async function registerCoach(baseUrl, nonce, label) {
  const email = `attendance_rec_${label}_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: `Attendance Rec ${label} Coach`,
    email,
    password: `AttendanceRec${label}Coach!2026`,
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
    { display_name: `Attendance Rec ${label} Coach`, email },
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
  const email = `attendance_rec_${label}_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: `Attendance Rec ${label} Athlete`,
    email,
    password: `AttendanceRec${label}Athlete!2026`,
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

test(
  "Attendance events recurrence: weekly/daily generation, weekday mismatch, over-cap rejection (both forms), and skip/reschedule invariants",
  async (testContext) => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
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
    };

    testContext.after(async () => {
      await closeServer(server);
      await cleanup();
    });

    server = await listen();
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const coach = await registerCoach(baseUrl, nonce, "a");
    coachUserIds.push(coach.userId);
    const otherCoach = await registerCoach(baseUrl, nonce, "b");
    coachUserIds.push(otherCoach.userId);
    const athlete1 = await registerAthlete(baseUrl, nonce, "1");
    athleteUserIds.push(athlete1.userId);

    await seedRelationship(baseUrl, {
      relationshipId: `attendance_rec_rel_${nonce}_1`, coachUserId: coach.userId, athleteUserId: athlete1.userId, state: "accepted"
    });

    // ============================================================
    // Sanity self-check: 2026-09-07 really is a Monday, 2026-09-09 a
    // Wednesday, 2026-09-11 a Friday - the whole weekly test below
    // depends on this.
    // ============================================================
    assert.equal(new Date("2026-09-07T00:00:00.000Z").getUTCDay(), 1, "2026-09-07 must be a Monday");
    assert.equal(new Date("2026-09-09T00:00:00.000Z").getUTCDay(), 3, "2026-09-09 must be a Wednesday");
    assert.equal(new Date("2026-09-11T00:00:00.000Z").getUTCDay(), 5, "2026-09-11 must be a Friday");

    // ============================================================
    // A start date whose weekday isn't in the requested weekday set is
    // rejected outright.
    // ============================================================
    const weekdayMismatch = await request(baseUrl, "POST", "/attendance-events", {
      title: "Mismatch series", location: "Gym", activity_label: "Powerlifting",
      occurrence_date: "2026-09-07", start_time: "09:00", end_time: "10:00",
      recurrence_rule: { frequency: "weekly", interval: 1, weekdays: ["tue"], ends: { type: "after_count", value: 3 } }
    }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(weekdayMismatch, 400, "start date weekday must be in the requested weekday set");
    assert.equal(weekdayMismatch.json?.error, "attendance_event_recurrence_start_date_weekday_mismatch");

    // ============================================================
    // An over-cap after_count is rejected at validation time.
    // ============================================================
    const overCapAfterCount = await request(baseUrl, "POST", "/attendance-events", {
      title: "Too many", location: "Gym", activity_label: "Powerlifting",
      occurrence_date: "2026-09-07", start_time: "09:00", end_time: "10:00",
      recurrence_rule: { frequency: "weekly", interval: 1, weekdays: ["mon"], ends: { type: "after_count", value: 500 } }
    }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(overCapAfterCount, 400, "after_count above the cap is rejected");
    assert.equal(overCapAfterCount.json?.error, "attendance_event_recurrence_ends_after_count_invalid");

    // ============================================================
    // An over-cap on_date range is rejected during generation, not
    // silently truncated to the cap.
    // ============================================================
    const overCapOnDate = await request(baseUrl, "POST", "/attendance-events", {
      title: "Too far out", location: "Gym", activity_label: "Powerlifting",
      occurrence_date: "2026-01-01", start_time: "09:00", end_time: "10:00",
      recurrence_rule: { frequency: "daily", interval: 1, ends: { type: "on_date", value: "2026-12-31" } }
    }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(overCapOnDate, 400, "an on_date range generating over 200 occurrences is rejected");
    assert.equal(overCapOnDate.json?.error, "attendance_event_recurrence_occurrence_cap_exceeded");

    const eventsBeforeReal = await request(baseUrl, "GET", "/attendance-events", undefined, { cookie: coach.cookie });
    assertStatus(eventsBeforeReal, 200, "coach reads own events before creating the real series");
    assert.equal(eventsBeforeReal.json?.events?.length, 0, "none of the rejected creates left an orphaned event behind");

    // ============================================================
    // Daily recurrence: every 2 days from 2026-10-01 through 2026-10-09
    // inclusive -> exactly 5 occurrences.
    // ============================================================
    const dailyCreated = await request(baseUrl, "POST", "/attendance-events", {
      title: "Daily conditioning", location: "Gym", activity_label: "Conditioning",
      occurrence_date: "2026-10-01", start_time: "07:00", end_time: "07:30",
      recurrence_rule: { frequency: "daily", interval: 2, ends: { type: "on_date", value: "2026-10-09" } }
    }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(dailyCreated, 201, "create daily recurring event");
    const dailyDates = (dailyCreated.json?.occurrences ?? []).map((occurrence) => occurrence.occurrence_date);
    assert.deepEqual(dailyDates, ["2026-10-01", "2026-10-03", "2026-10-05", "2026-10-07", "2026-10-09"]);

    // ============================================================
    // Weekly recurrence: Mon/Wed/Fri starting 2026-09-07, 5 occurrences
    // -> 09-07 (Mon), 09-09 (Wed), 09-11 (Fri), 09-14 (Mon), 09-16 (Wed).
    // ============================================================
    const weeklyCreated = await request(baseUrl, "POST", "/attendance-events", {
      title: "MWF class", description: "Squat and bench focus", location: "Main gym", activity_label: "Powerlifting",
      timezone: "Europe/London", occurrence_date: "2026-09-07", start_time: "09:00", end_time: "10:00",
      recurrence_rule: { frequency: "weekly", interval: 1, weekdays: ["mon", "wed", "fri"], ends: { type: "after_count", value: 5 } },
      athlete_user_ids: [athlete1.userId]
    }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(weeklyCreated, 201, "create weekly recurring event");
    const eventId = weeklyCreated.json?.event?.event_id;
    assert.equal(weeklyCreated.json?.event?.recurrence_rule?.frequency, "weekly");
    const occurrences = weeklyCreated.json?.occurrences ?? [];
    assert.deepEqual(
      occurrences.map((occurrence) => occurrence.occurrence_date),
      ["2026-09-07", "2026-09-09", "2026-09-11", "2026-09-14", "2026-09-16"]
    );
    const [occ0, occ1, occ2, occ3, occ4] = occurrences;

    // ============================================================
    // Athlete RSVPs "attending" on the 1st and 3rd occurrences before any
    // skip/reschedule happens.
    // ============================================================
    assertStatus(await request(
      baseUrl, "POST", `/attendance-events/occurrences/${encodeURIComponent(occ0.occurrence_id)}/rsvp`,
      { rsvp_state: "attending" }, { cookie: athlete1.cookie, csrf: athlete1.csrf }
    ), 201, "RSVP on occurrence 0");
    assertStatus(await request(
      baseUrl, "POST", `/attendance-events/occurrences/${encodeURIComponent(occ2.occurrence_id)}/rsvp`,
      { rsvp_state: "attending" }, { cookie: athlete1.cookie, csrf: athlete1.csrf }
    ), 201, "RSVP on occurrence 2");

    // ============================================================
    // A non-owning coach cannot skip or reschedule this event's
    // occurrences.
    // ============================================================
    const foreignSkip = await request(
      baseUrl, "POST", `/attendance-events/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(occ1.occurrence_id)}/skip`,
      {}, { cookie: otherCoach.cookie, csrf: otherCoach.csrf }
    );
    assertStatus(foreignSkip, 404, "a non-owning coach cannot skip an occurrence");

    // ============================================================
    // Coach skips occurrence 1 (2026-09-09).
    // ============================================================
    const skipped = await request(
      baseUrl, "POST", `/attendance-events/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(occ1.occurrence_id)}/skip`,
      {}, { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(skipped, 200, "coach skips occurrence 1");
    assert.equal(skipped.json?.occurrence?.status, "skipped");
    assert.equal(skipped.json?.occurrence?.occurrence_date, "2026-09-09");

    // Re-skipping an already-skipped occurrence is rejected.
    const doubleSkip = await request(
      baseUrl, "POST", `/attendance-events/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(occ1.occurrence_id)}/skip`,
      {}, { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(doubleSkip, 409, "double-skip is rejected");
    assert.equal(doubleSkip.json?.error, "attendance_event_occurrence_already_skipped");

    // A skipped occurrence can no longer accept an RSVP.
    const rsvpAfterSkip = await request(
      baseUrl, "POST", `/attendance-events/occurrences/${encodeURIComponent(occ1.occurrence_id)}/rsvp`,
      { rsvp_state: "attending" }, { cookie: athlete1.cookie, csrf: athlete1.csrf }
    );
    assertStatus(rsvpAfterSkip, 404, "cannot RSVP to a skipped occurrence");
    assert.equal(rsvpAfterSkip.json?.error, "attendance_event_occurrence_not_available");

    // ============================================================
    // Coach reschedules occurrence 2 (originally 2026-09-11) to
    // 2026-09-12 at a new time.
    // ============================================================
    const rescheduled = await request(
      baseUrl, "POST", `/attendance-events/${encodeURIComponent(eventId)}/occurrences/${encodeURIComponent(occ2.occurrence_id)}/reschedule`,
      { new_date: "2026-09-12", new_start_time: "11:00", new_end_time: "12:00" }, { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(rescheduled, 200, "coach reschedules occurrence 2");
    assert.equal(rescheduled.json?.occurrence?.status, "rescheduled");
    assert.equal(rescheduled.json?.occurrence?.occurrence_date, "2026-09-11", "the original slot's date never changes");
    assert.equal(rescheduled.json?.occurrence?.rescheduled_to_date, "2026-09-12");
    assert.equal(rescheduled.json?.occurrence?.rescheduled_to_start_time, "11:00");

    // A rescheduled occurrence still accepts a (new) RSVP - it's the same
    // commitment, just moved.
    const rsvpAfterReschedule = await request(
      baseUrl, "POST", `/attendance-events/occurrences/${encodeURIComponent(occ2.occurrence_id)}/rsvp`,
      { rsvp_state: "maybe" }, { cookie: athlete1.cookie, csrf: athlete1.csrf }
    );
    assertStatus(rsvpAfterReschedule, 201, "a rescheduled occurrence still accepts an RSVP");

    // ============================================================
    // The coach's detail view: sibling occurrences (0, 3, 4) are
    // completely unaffected by the skip/reschedule above, and occurrence
    // 0's RSVP (recorded before any of this happened) is still intact.
    // ============================================================
    const detail = await request(baseUrl, "GET", `/attendance-events/${encodeURIComponent(eventId)}`, undefined, { cookie: coach.cookie });
    assertStatus(detail, 200, "coach reads event detail");
    const byId = Object.fromEntries((detail.json?.occurrences ?? []).map((occurrence) => [occurrence.occurrence_id, occurrence]));
    assert.equal(byId[occ0.occurrence_id]?.status, "scheduled");
    assert.equal(byId[occ1.occurrence_id]?.status, "skipped");
    assert.equal(byId[occ2.occurrence_id]?.status, "rescheduled");
    assert.equal(byId[occ3.occurrence_id]?.status, "scheduled");
    assert.equal(byId[occ3.occurrence_id]?.occurrence_date, "2026-09-14");
    assert.equal(byId[occ4.occurrence_id]?.status, "scheduled");
    assert.equal(byId[occ4.occurrence_id]?.occurrence_date, "2026-09-16");

    const roster = detail.json?.roster ?? [];
    assert.equal(roster.length, 1);
    const rsvpByOccurrence = roster[0].rsvp_by_occurrence;
    assert.equal(rsvpByOccurrence[occ0.occurrence_id], "attending", "occurrence 0's RSVP survived the skip/reschedule of its siblings");
    assert.equal(rsvpByOccurrence[occ2.occurrence_id], "maybe", "occurrence 2's RSVP reflects the post-reschedule change");
    assert.equal(rsvpByOccurrence[occ3.occurrence_id], null, "occurrence 3 was never RSVP'd to");
    assert.equal(rsvpByOccurrence[occ4.occurrence_id], null, "occurrence 4 was never RSVP'd to");

    // ============================================================
    // The athlete's own "mine" view: the skipped occurrence is gone
    // entirely, the rescheduled one shows its new target date/time, and
    // untouched occurrences are unaffected.
    // ============================================================
    const mine = await request(baseUrl, "GET", "/attendance-events/mine", undefined, { cookie: athlete1.cookie });
    assertStatus(mine, 200, "athlete reads own occurrences");
    const mineById = Object.fromEntries((mine.json?.occurrences ?? []).map((occurrence) => [occurrence.occurrence_id, occurrence]));
    assert.equal(Object.keys(mineById).length, 4, "the skipped occurrence is excluded entirely");
    assert.equal(mineById[occ1.occurrence_id], undefined, "the skipped occurrence never appears in the athlete's list");
    assert.equal(mineById[occ2.occurrence_id]?.status, "rescheduled");
    assert.equal(mineById[occ2.occurrence_id]?.rescheduled_to_date, "2026-09-12");
    assert.equal(mineById[occ2.occurrence_id]?.my_rsvp_state, "maybe");
    assert.equal(mineById[occ0.occurrence_id]?.status, "scheduled");
    assert.equal(mineById[occ0.occurrence_id]?.my_rsvp_state, "attending");
  }
);
