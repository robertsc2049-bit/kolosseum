// DEV NOTE: FULL-UI-09C / FULL-UI-06 persistent proof that replacing an
// assignment with a new event link is guarded by the same same-date
// conflict rule linkAthleteToStandaloneEvent already enforces.
// linkReplacementEvent (product_assignment.routes.ts) writes the exact
// same beta19_event_athlete_link record as the direct link route, but
// previously built it inline rather than reusing assertNoDateConflict -
// so replacing an assignment could quietly create the exact double-
// booking the direct link route already refuses to create. Proves: an
// athlete with two independent, still-linked events on two different
// dates cannot have one assignment replaced onto the other's date, the
// rejected replace leaves both original links untouched, and a
// replacement onto a genuinely free date still succeeds. Every step
// crosses only public HTTP routes.

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

function dateOnlyFromNow(offset) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function registerCoach(baseUrl, nonce) {
  const email = `replace_conflict_coach_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "coach",
    display_name: "Replace Conflict Coach",
    email,
    password: "ReplaceConflictCoach!2026",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, "coach registration");
  const cookie = cookieNamed(result, "kolosseum_session", "coach registration");
  const csrf = result.json?.csrf_token;

  assertStatus(await request(
    baseUrl, "PATCH", "/account/coach-onboarding/profile",
    { display_name: "Replace Conflict Coach", email },
    { cookie, csrf }
  ), 200, "coach onboarding profile");
  assertStatus(await request(
    baseUrl, "POST", "/account/coach-onboarding/terms",
    { accepted: true, terms_version: "terms_v1" },
    { cookie, csrf }
  ), 200, "coach onboarding terms");
  assertStatus(await request(
    baseUrl, "POST", "/account/coach-onboarding/complete",
    { completion_confirmed: true },
    { cookie, csrf }
  ), 200, "coach onboarding complete");

  return { userId: result.json?.account?.user_id ?? "", email, cookie, csrf };
}

async function registerAthlete(baseUrl, nonce) {
  const email = `replace_conflict_athlete_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: "Replace Conflict Athlete",
    email,
    password: "ReplaceConflictAthlete!2026",
    activity_id: "powerlifting",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(result, 201, "athlete registration");
  return { userId: result.json?.account?.user_id ?? "", email };
}

async function seedAcceptedRelationship(baseUrl, { relationshipId, coachUserId, athleteUserId }) {
  const now = new Date().toISOString();
  assertStatus(await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
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
  }), 201, `seed accepted relationship ${relationshipId}`);
}

async function createEvent(baseUrl, coach, name, eventDate) {
  const result = await request(baseUrl, "POST", "/coach-workspace/events/create", {
    event_id: "",
    event_name: name,
    activity_id: "powerlifting",
    event_type: "powerlifting_meet",
    programme_start_date: dateOnlyFromNow(1),
    event_date: eventDate,
    location: "Nowhere",
    timezone: "Europe/London",
    notes: ""
  }, { cookie: coach.cookie, csrf: coach.csrf });
  assertStatus(result, 201, `${name}: create`);
  return {
    eventId: result.json?.event?.event_id,
    requiredWeeks: Number(result.json?.event?.event_compile_summary?.required_week_count)
  };
}

function workItems() {
  return [["back_squat", 75], ["bench_press", 75]].map(([exerciseId, percent], index) => ({
    work_item_id: "", order_index: index + 1, exercise_id: exerciseId, planned_sets: 3,
    rep_mode: "fixed", planned_reps: 5, rep_min: 5, rep_max: 5, load_mode: "percent_1rm",
    percent_1rm: percent, weight_value: 20, weight_unit: "kg", rest_seconds: 120,
    role: index === 0 ? "primary" : "accessory", coaching_notes: "", segment: "working",
    group_id: "", group_type: "straight"
  }));
}

async function activateTemplate(baseUrl, coach, weekCount, name) {
  const template = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coach.userId,
    template_version: 1,
    template_name: name,
    description: "FULL-UI-09C replace-conflict persistent proof.",
    activity_id: "powerlifting",
    event_plan: null,
    blocks: [{
      block_id: "", order_index: 1, name: "Block", description: "", block_type: "strength", week_count: weekCount,
      weeks: Array.from({ length: weekCount }, (_, index) => index + 1).map((week) => ({
        week_id: "", order_index: week, sessions: [{ session_id: "", order_index: 1, title: `Week ${week}`, work_items: workItems() }]
      }))
    }],
    updated_at_iso8601: new Date().toISOString()
  });
  assertStatus(template, 201, `${name}: draft`);
  const templateId = template.json?.template?.template_id;
  assertStatus(await request(baseUrl, "POST", `/templates/${encodeURIComponent(templateId)}/complete`, { coach_user_id: coach.userId }), 200, `${name}: complete`);
  assertStatus(await request(baseUrl, "POST", `/templates/${encodeURIComponent(templateId)}/activate`, { coach_user_id: coach.userId }), 200, `${name}: activate`);
  return templateId;
}

test(
  "Replacing an assignment onto an event that shares a date with another of the athlete's still-linked events is rejected, leaves both original links untouched, and a replacement onto a genuinely free date still succeeds",
  async (testContext) => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);

    let server = null;
    const userIds = [];
    const eventIds = [];

    const cleanup = async () => {
      for (const eventId of eventIds) {
        await pool.query(
          `DELETE FROM beta_product_records WHERE record_payload ->> 'event_id' = $1`,
          [eventId]
        ).catch(() => {});
      }
      if (userIds.length > 0) {
        await pool.query(
          `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
          [userIds]
        ).catch(() => {});
      }
      for (const userId of userIds) {
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

    const coach = await registerCoach(baseUrl, nonce);
    userIds.push(coach.userId);
    const athlete = await registerAthlete(baseUrl, nonce);
    userIds.push(athlete.userId);
    await seedAcceptedRelationship(baseUrl, { relationshipId: `replace_conflict_rel_${nonce}`, coachUserId: coach.userId, athleteUserId: athlete.userId });

    // Two independent events, on two different dates - plus event W,
    // a THIRD, distinct event sharing event Y's date (the conflict
    // fixture: assertNoDateConflict skips a link to the *same* event_id
    // as the target as a no-op relink, so the conflicting link must be
    // a different event_id on the same date, never the target itself).
    const eventX = await createEvent(baseUrl, coach, "Replace Conflict Event X", dateOnlyFromNow(20));
    eventIds.push(eventX.eventId);
    const eventY = await createEvent(baseUrl, coach, "Replace Conflict Event Y", dateOnlyFromNow(40));
    eventIds.push(eventY.eventId);
    const eventW = await createEvent(baseUrl, coach, "Replace Conflict Event W", dateOnlyFromNow(40));
    eventIds.push(eventW.eventId);

    const templateX = await activateTemplate(baseUrl, coach, eventX.requiredWeeks, "Replace Conflict Programme X");

    // ============================================================
    // Assignment 1 links the athlete to event X (their one "current"
    // assignment). Independently, and without any programme, the
    // athlete is also directly linked to event W from the event-detail
    // surface - a link the assignment system never owns or supersedes.
    // All links are "linked" simultaneously, event W and event Y merely
    // sharing a date - no conflict yet, since nothing is linked to
    // event Y itself.
    // ============================================================
    const assignment1 = await request(baseUrl, "POST", "/coach-workspace/athlete-assignment", {
      request_id: `replace_conflict_request_1_${nonce}`,
      requested_at_iso8601: new Date().toISOString(),
      coach_user_id: coach.userId,
      athlete_user_id: athlete.userId,
      template_id: templateX,
      activity_id: "powerlifting",
      event_id: eventX.eventId
    }, { cookie: coach.cookie, csrf: coach.csrf });
    assertStatus(assignment1, 201, "assignment 1 links to event X");
    const assignment1Id = assignment1.json?.assignment?.assignment_id;
    assert.ok(assignment1Id, "expected assignment 1 id");

    const directLinkW = await request(
      baseUrl, "POST", `/coach-workspace/events/${encodeURIComponent(eventW.eventId)}/athletes/${encodeURIComponent(athlete.userId)}/link`,
      { template_id: "", request_id: "" },
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(directLinkW, 201, "direct (no-programme) link to event W");

    const templateY = await activateTemplate(baseUrl, coach, eventY.requiredWeeks, "Replace Conflict Programme Y");

    // ============================================================
    // Replacing assignment 1 onto event Y's date is rejected - event W
    // is still directly linked and shares event Y's date, so this
    // would double-book the athlete on that date.
    // ============================================================
    const replaceOntoConflictingDate = await request(
      baseUrl, "POST", `/coach-workspace/athlete-assignment/${encodeURIComponent(assignment1Id)}/replace`,
      {
        request_id: `replace_conflict_replace_request_${nonce}`,
        requested_at_iso8601: new Date().toISOString(),
        coach_user_id: coach.userId,
        athlete_user_id: athlete.userId,
        template_id: templateY,
        activity_id: "powerlifting",
        event_id: eventY.eventId
      },
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(replaceOntoConflictingDate, 409, "replace onto a date already linked via another assignment is rejected");
    assert.match(String(replaceOntoConflictingDate.json?.error ?? ""), /already linked to another event on the same date/u);

    // ============================================================
    // The rejected replace left both original links completely
    // untouched - event X still shows exactly one linked athlete,
    // and so does event W. Event Y itself was never linked to at all.
    // ============================================================
    const eventXDetail = await request(baseUrl, "GET", `/coach-workspace/events/${encodeURIComponent(eventX.eventId)}`, undefined, { cookie: coach.cookie });
    assertStatus(eventXDetail, 200, "event X detail after rejected replace");
    assert.equal(eventXDetail.json?.detail?.linked_athletes?.length, 1, "event X link must survive the rejected replace");
    assert.equal(eventXDetail.json?.detail?.linked_athletes?.[0]?.athlete_user_id, athlete.userId);

    const eventWDetail = await request(baseUrl, "GET", `/coach-workspace/events/${encodeURIComponent(eventW.eventId)}`, undefined, { cookie: coach.cookie });
    assertStatus(eventWDetail, 200, "event W detail after rejected replace");
    assert.equal(eventWDetail.json?.detail?.linked_athletes?.length, 1, "event W link must be completely unaffected by the rejected replace");

    const eventYDetail = await request(baseUrl, "GET", `/coach-workspace/events/${encodeURIComponent(eventY.eventId)}`, undefined, { cookie: coach.cookie });
    assertStatus(eventYDetail, 200, "event Y detail after rejected replace");
    assert.equal(eventYDetail.json?.detail?.linked_athletes?.length, 0, "event Y was never actually linked to - the rejected replace must not have linked it either");

    // ============================================================
    // Replacing assignment 1 onto a genuinely free date still
    // succeeds - the guard only blocks a real conflict, never a
    // legitimate replace.
    // ============================================================
    const eventZ = await createEvent(baseUrl, coach, "Replace Conflict Event Z", dateOnlyFromNow(60));
    eventIds.push(eventZ.eventId);
    const templateZ = await activateTemplate(baseUrl, coach, eventZ.requiredWeeks, "Replace Conflict Programme Z");

    const replaceOntoFreeDate = await request(
      baseUrl, "POST", `/coach-workspace/athlete-assignment/${encodeURIComponent(assignment1Id)}/replace`,
      {
        request_id: `replace_conflict_replace_free_request_${nonce}`,
        requested_at_iso8601: new Date().toISOString(),
        coach_user_id: coach.userId,
        athlete_user_id: athlete.userId,
        template_id: templateZ,
        activity_id: "powerlifting",
        event_id: eventZ.eventId
      },
      { cookie: coach.cookie, csrf: coach.csrf }
    );
    assertStatus(replaceOntoFreeDate, 201, "replace onto a genuinely free date succeeds");
    assert.equal(replaceOntoFreeDate.json?.event_link?.event_id, eventZ.eventId);
  }
);
