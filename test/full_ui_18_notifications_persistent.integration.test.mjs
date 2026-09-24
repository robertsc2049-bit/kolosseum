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
    server.close((error) => error ? reject(error) : resolve());
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

function sessionCookie(result, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const session = values.find((value) => String(value).startsWith("kolosseum_session="));
  assert.ok(session, `${label}: expected session cookie`);
  return String(session).split(";")[0];
}

async function registerAccount(baseUrl, actorType, label, nonce) {
  const registration = await request(baseUrl, "POST", "/account/register", {
    actor_type: actorType,
    display_name: label,
    email: `${label.toLowerCase().replaceAll(/[^a-z0-9]/gu, "_")}_${nonce}@example.com`,
    password: "Full18Notifications!2026",
    activity_id: "powerlifting",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  assertStatus(registration, 201, `${label} account registration`);

  const userId = registration.json?.account?.user_id ?? "";
  assert.ok(userId, `${label}: expected registered user_id`);
  const cookie = sessionCookie(registration, `${label} account registration`);
  const csrf = registration.json?.csrf_token;
  assert.ok(csrf, `${label}: expected csrf token`);

  return { userId, cookie, csrf };
}

async function setUpCoach(baseUrl, label, nonce) {
  const coach = await registerAccount(baseUrl, "coach", label, nonce);
  const timestamp = new Date().toISOString();

  const profileResult = await request(baseUrl, "POST", "/sessions/beta-coach-profile", {
    coach_user_id: coach.userId,
    email: `${coach.userId}@example.com`,
    display_name: label,
    account_role: "coach",
    account_state: "active",
    accepted_terms_version: "terms_v1",
    created_at_iso8601: timestamp
  });
  assertStatus(profileResult, 201, `${label} coach profile`);

  return { ...coach, profile: profileResult.json.coach_profile };
}

function phase1Input() {
  return {
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: "powerlifting",
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none"
  };
}

async function setUpAthlete(baseUrl, label, nonce) {
  // Register a modern, session-authenticated account first (so this athlete
  // can call the session-authenticated notifications surface), then reuse
  // that same user_id for the legacy beta-16 auth/acknowledgement/declaration
  // chain the assignment/compile path still depends on.
  const account = await registerAccount(baseUrl, "athlete", label, nonce);
  const userId = account.userId;
  const timestamp = new Date().toISOString();

  assertStatus(await request(baseUrl, "POST", "/sessions/beta-auth", {
    user_id: userId,
    email: `${userId}@example.com`,
    display_name: label,
    account_role: "athlete",
    account_state: "active",
    accepted_terms_version: "terms_v1",
    created_at_iso8601: timestamp
  }), 201, `${label} athlete auth`);

  assertStatus(await request(baseUrl, "POST", "/sessions/beta-acknowledgement", {
    acknowledgement_id: `ack_${userId}`,
    user_id: userId,
    beta_id: "september_beta_2026",
    accepted: true,
    jurisdiction_acknowledged: true,
    accepted_at_iso8601: timestamp,
    copy_acknowledgement_id: "BETA16_COPY_ACKNOWLEDGEMENT_LABEL"
  }), 201, `${label} acknowledgement`);

  assertStatus(await request(baseUrl, "POST", "/sessions/beta-declaration", {
    declaration_id: `declaration_${userId}`,
    user_id: userId,
    phase1_input: phase1Input(),
    jurisdiction_acknowledged: true,
    declared_at_iso8601: timestamp,
    accepted_terms_version: "terms_v1",
    copy_acknowledgement_id: "BETA16_COPY_DECLARATION_ACKNOWLEDGEMENT"
  }), 201, `${label} declaration`);

  return { userId, cookie: account.cookie, csrf: account.csrf };
}

async function connectRelationship(baseUrl, coachUserId, athleteUserId, relationshipId, state, timestamp) {
  return request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: relationshipId,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    relationship_state: state,
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: state === "accepted" ? timestamp : null,
    created_at_iso8601: timestamp,
    updated_at_iso8601: timestamp,
    revoked_at_iso8601: (state === "revoked" || state === "declined") ? timestamp : null,
    expires_at_iso8601: null
  });
}

async function setUpStrengthProfile(baseUrl, coach, athleteUserId) {
  const dateOnly = new Date().toISOString().slice(0, 10);
  assertStatus(await request(baseUrl, "POST", "/coach-workspace/athlete-strength-profile", {
    coach_user_id: coach.userId,
    athlete_user_id: athleteUserId,
    preferred_weight_unit: "kg",
    load_rounding_increment: 2.5,
    bodyweight: 90,
    bodyweight_unit: "kg",
    benchmarks: [
      ["back_squat", 160],
      ["bench_press", 110],
      ["deadlift", 200],
      ["overhead_press", 70]
    ].map(([exerciseId, value]) => ({
      benchmark_id: "",
      exercise_id: exerciseId,
      value,
      unit: "kg",
      basis: "tested_1rm",
      effective_date: dateOnly,
      source_note: "FULL-UI-18 notifications proof"
    })),
    expected_current_record_sha256: null
  }, { cookie: coach.cookie, csrf: coach.csrf }), 201, "strength profile");
}

function workItems() {
  return [
    ["back_squat", 75],
    ["bench_press", 75],
    ["deadlift", 70],
    ["overhead_press", 65]
  ].map(([exerciseId, percent], index) => ({
    work_item_id: "",
    order_index: index + 1,
    exercise_id: exerciseId,
    planned_sets: index === 0 ? 4 : 3,
    rep_mode: "fixed",
    planned_reps: index === 0 ? 5 : 8,
    rep_min: index === 0 ? 5 : 8,
    rep_max: index === 0 ? 5 : 8,
    load_mode: "percent_1rm",
    percent_1rm: percent,
    weight_value: 20,
    weight_unit: "kg",
    rest_seconds: index === 0 ? 180 : 120,
    role: index === 0 ? "primary" : "accessory",
    coaching_notes: "",
    segment: "working",
    group_id: "",
    group_type: "straight"
  }));
}

async function createActivatedTemplate(baseUrl, coachUserId, name, sessionCount) {
  const saved = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: name,
    description: "FULL-UI-18 notifications proof.",
    activity_id: "powerlifting",
    event_plan: null,
    blocks: [{
      block_id: "",
      order_index: 1,
      name: "Full-UI-18 Block",
      description: "",
      block_type: "strength",
      week_count: sessionCount,
      weeks: Array.from({ length: sessionCount }, (_, index) => index + 1).map((week) => ({
        week_id: "",
        order_index: week,
        sessions: [{ session_id: "", order_index: 1, title: `Session ${week}`, work_items: workItems() }]
      }))
    }],
    updated_at_iso8601: new Date().toISOString()
  });
  assertStatus(saved, 201, `${name}: draft save`);
  const template = saved.json.template;

  assertStatus(
    await request(baseUrl, "POST", `/templates/${encodeURIComponent(template.template_id)}/complete`, {
      coach_user_id: coachUserId
    }),
    200,
    `${name}: complete`
  );

  assertStatus(
    await request(baseUrl, "POST", `/templates/${encodeURIComponent(template.template_id)}/activate`, {
      coach_user_id: coachUserId
    }),
    200,
    `${name}: activate`
  );

  return template;
}

async function assignTemplate(baseUrl, coach, athleteUserId, templateId, nonce, eventId = "") {
  const assignment = await request(
    baseUrl,
    "POST",
    "/coach-workspace/athlete-assignment",
    {
      request_id: `full_ui_18_request_${nonce}`,
      requested_at_iso8601: new Date().toISOString(),
      coach_user_id: coach.userId,
      athlete_user_id: athleteUserId,
      template_id: templateId,
      activity_id: "powerlifting",
      event_id: eventId
    },
    { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(assignment, 201, "athlete assignment");
  return assignment.json.assignment;
}

async function compileSession(baseUrl, coach, athleteUserId) {
  const compiled = await request(
    baseUrl,
    "POST",
    "/blocks/compile?create_session=true&beta_path=true",
    {
      phase1_input: phase1Input(),
      beta_user_id: athleteUserId,
      beta_coach_user_id: coach.userId
    }
  );
  assertStatus(compiled, 201, "compile session");
  const sessionId = compiled.json.session_id;
  assert.ok(sessionId, "expected a created session id");
  return sessionId;
}

async function createEvent(baseUrl, coach, name, dayOffset) {
  const created = await request(baseUrl, "POST", "/coach-workspace/events/create", {
    event_id: "",
    event_name: name,
    activity_id: "powerlifting",
    event_type: "powerlifting_meet",
    programme_start_date: (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    })(),
    event_date: (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + dayOffset);
      return d.toISOString().slice(0, 10);
    })(),
    location: "Mansfield",
    timezone: "Europe/London",
    notes: "FULL-UI-18 notifications proof"
  }, { cookie: coach.cookie, csrf: coach.csrf });
  assertStatus(created, 201, "create event");
  return created.json.event;
}

async function listNotifications(baseUrl, actor) {
  const result = await request(baseUrl, "GET", "/account/notifications", undefined, {
    cookie: actor.cookie
  });
  assertStatus(result, 200, "notifications list");
  return result.json;
}

async function unreadCount(baseUrl, actor) {
  const result = await request(baseUrl, "GET", "/account/notifications/unread-count", undefined, {
    cookie: actor.cookie
  });
  assertStatus(result, 200, "unread count");
  return result.json.unread_count;
}

function byType(list) {
  const out = {};
  for (const n of list.notifications) {
    (out[n.notification_type] ??= []).push(n);
  }
  return out;
}

test(
  "FULL-UI-18 notifications: every trigger type, dedup, read state, deep links, target availability and restart reconstruction",
  async () => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    let server = null;

    const userIds = [];
    const sessionIds = [];
    const noteIds = [];

    const cleanup = async () => {
      await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = ANY($1::text[])", [userIds]).catch(() => {});
      for (const noteId of noteIds) {
        await pool.query("DELETE FROM product_coach_notes WHERE note_id = $1", [noteId]).catch(() => {});
      }
      for (const sessionId of sessionIds) {
        await pool.query("DELETE FROM session_event_requests WHERE session_id = $1", [sessionId]).catch(() => {});
        await pool.query("DELETE FROM runtime_events WHERE session_id = $1", [sessionId]).catch(() => {});
        await pool.query("DELETE FROM session_event_seq WHERE session_id = $1", [sessionId]).catch(() => {});
      }
      await pool.query(
        "DELETE FROM product_commercial_records WHERE user_id = ANY($1::text[])",
        [userIds]
      ).catch(() => {});
      for (const userId of userIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      await pool.query(
        "DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])",
        [userIds.filter(Boolean)]
      ).catch(() => {});
    };

    try {
      server = await listen();
      let address = server.address();
      let baseUrl = `http://127.0.0.1:${address.port}`;
      const timestamp = new Date().toISOString();

      const coach = await setUpCoach(baseUrl, "Full18 Coach", nonce);
      userIds.push(coach.userId);

      const athleteInvited = await setUpAthlete(baseUrl, "Full18 Invited Athlete", nonce);
      userIds.push(athleteInvited.userId);
      const athleteDeclined = await setUpAthlete(baseUrl, "Full18 Declined Athlete", nonce);
      userIds.push(athleteDeclined.userId);
      const athlete = await setUpAthlete(baseUrl, "Full18 Main Athlete", nonce);
      userIds.push(athlete.userId);

      // --- Relationship: invited (no response yet). ---
      await connectRelationship(baseUrl, coach.userId, athleteInvited.userId, `rel_invited_${nonce}`, "invited", timestamp);

      // --- Relationship: invited then declined. ---
      await connectRelationship(baseUrl, coach.userId, athleteDeclined.userId, `rel_declined_${nonce}`, "invited", timestamp);
      const declineResult = await connectRelationship(baseUrl, coach.userId, athleteDeclined.userId, `rel_declined_${nonce}`, "declined", timestamp);
      assertStatus(declineResult, 201, "relationship declined");

      // --- Relationship: invited then accepted (the main working relationship). ---
      await connectRelationship(baseUrl, coach.userId, athlete.userId, `rel_${nonce}`, "invited", timestamp);
      await connectRelationship(baseUrl, coach.userId, athlete.userId, `rel_${nonce}`, "accepted", timestamp);

      await setUpStrengthProfile(baseUrl, coach, athlete.userId);

      // --- Assignment created + programme available. ---
      const template = await createActivatedTemplate(baseUrl, coach.userId, `Full18 Programme ${nonce}`, 2);
      const assignment = await assignTemplate(baseUrl, coach, athlete.userId, template.template_id, nonce);

      // --- Assignment replaced. ---
      const templateB = await createActivatedTemplate(baseUrl, coach.userId, `Full18 Programme B ${nonce}`, 2);
      const replaceResult = await request(
        baseUrl,
        "POST",
        `/coach-workspace/athlete-assignment/${encodeURIComponent(assignment.assignment_id)}/replace`,
        {
          request_id: `full_18_replace_${nonce}`,
          requested_at_iso8601: new Date().toISOString(),
          coach_user_id: coach.userId,
          athlete_user_id: athlete.userId,
          template_id: templateB.template_id,
          activity_id: "powerlifting",
          event_id: ""
        }
      );
      assertStatus(replaceResult, 201, "assignment replace");
      const replacedAssignment = replaceResult.json.assignment;

      // --- Assignment cancelled. ---
      const cancelResult = await request(
        baseUrl,
        "POST",
        `/coach-workspace/athlete-assignment/${encodeURIComponent(replacedAssignment.assignment_id)}/cancel`,
        {
          request_id: `full_18_cancel_${nonce}`,
          requested_at_iso8601: new Date().toISOString(),
          coach_user_id: coach.userId,
          athlete_user_id: athlete.userId
        }
      );
      assertStatus(cancelResult, 201, "assignment cancel");

      // --- Event: create, link, unlink, re-link, then cancel while linked. ---
      const event = await createEvent(baseUrl, coach, `Full18 Meet ${nonce}`, 20);

      assertStatus(
        await request(
          baseUrl, "POST",
          `/coach-workspace/events/${encodeURIComponent(event.event_id)}/athletes/${encodeURIComponent(athlete.userId)}/link`,
          { coach_user_id: coach.userId, event_id: event.event_id, athlete_user_id: athlete.userId, template_id: "", request_id: "" },
          { cookie: coach.cookie, csrf: coach.csrf }
        ),
        201,
        "link athlete to event"
      );

      assertStatus(
        await request(
          baseUrl, "POST",
          `/coach-workspace/events/${encodeURIComponent(event.event_id)}/athletes/${encodeURIComponent(athlete.userId)}/unlink`,
          undefined,
          { cookie: coach.cookie, csrf: coach.csrf }
        ),
        200,
        "unlink athlete from event"
      );

      assertStatus(
        await request(
          baseUrl, "POST",
          `/coach-workspace/events/${encodeURIComponent(event.event_id)}/athletes/${encodeURIComponent(athlete.userId)}/link`,
          { coach_user_id: coach.userId, event_id: event.event_id, athlete_user_id: athlete.userId, template_id: "", request_id: "" },
          { cookie: coach.cookie, csrf: coach.csrf }
        ),
        201,
        "re-link athlete to event"
      );

      const relinkedEvent = await request(baseUrl, "GET", `/coach-workspace/events/${encodeURIComponent(event.event_id)}`, undefined, {
        cookie: coach.cookie
      });
      assertStatus(relinkedEvent, 200, "event detail before cancel");

      assertStatus(
        await request(
          baseUrl, "POST",
          `/coach-workspace/events/${encodeURIComponent(event.event_id)}/cancel`,
          { expected_current_record_sha256: relinkedEvent.json.detail.event.record_sha256 },
          { cookie: coach.cookie, csrf: coach.csrf }
        ),
        200,
        "cancel event"
      );

      // --- A fresh active assignment is required before a session can be
      //     compiled - the earlier assignment was cancelled above. ---
      const templateC = await createActivatedTemplate(baseUrl, coach.userId, `Full18 Programme C ${nonce}`, 2);
      await assignTemplate(baseUrl, coach, athlete.userId, templateC.template_id, `${nonce}_c`);

      // --- Session completed. ---
      const sessionId = await compileSession(baseUrl, coach, athlete.userId);
      sessionIds.push(sessionId);
      await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {});
      for (const exerciseId of ["back_squat", "bench_press", "deadlift", "overhead_press"]) {
        assertStatus(
          await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
            type: "COMPLETE_EXERCISE", exercise_id: exerciseId
          }),
          201,
          `complete ${exerciseId}`
        );
      }

      // --- Coach note visible to athlete (direct row, mirroring the exact
      //     shape the real write handler persists - proves the read/derive
      //     side of this module, independently of the already-tested
      //     BETA-17 note write contract). ---
      const noteId = `note_${nonce}`;
      noteIds.push(noteId);
      await pool.query(
        `INSERT INTO product_coach_notes (note_id, coach_user_id, athlete_user_id, relationship_id, session_id, artefact_id, note_text, visibility, record_sha256, note_payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'athlete_visible',$8,$9::jsonb)`,
        [
          noteId, coach.userId, athlete.userId, `rel_${nonce}`, sessionId, `artefact_${nonce}`,
          "Great work on the squat today.", "b".repeat(64), JSON.stringify({ note_id: noteId })
        ]
      );

      // --- Billing action required: a cancelled checkout return. ---
      const priorLaunchEnv = {
        planId: process.env.KOLOSSEUM_CONTROLLED_LAUNCH_PLAN_ID,
        priceId: process.env.KOLOSSEUM_CONTROLLED_LAUNCH_PRICE_ID,
        seatLimit: process.env.KOLOSSEUM_CONTROLLED_LAUNCH_SEAT_LIMIT
      };
      process.env.KOLOSSEUM_CONTROLLED_LAUNCH_PLAN_ID = "controlled_launch_coach";
      process.env.KOLOSSEUM_CONTROLLED_LAUNCH_PRICE_ID = "price_controlled_launch_coach";
      process.env.KOLOSSEUM_CONTROLLED_LAUNCH_SEAT_LIMIT = "5";

      assertStatus(
        await request(baseUrl, "POST", "/account/commercial/checkout", { request_id: `checkout_${nonce}` }, { cookie: coach.cookie, csrf: coach.csrf }),
        201,
        "checkout request"
      );
      assertStatus(
        await request(baseUrl, "POST", "/account/commercial/payment-return", {
          request_id: `cancelled_${nonce}`,
          outcome: "cancelled",
          provider_session_id: null
        }, { cookie: coach.cookie, csrf: coach.csrf }),
        201,
        "cancelled payment return"
      );

      if (priorLaunchEnv.planId === undefined) delete process.env.KOLOSSEUM_CONTROLLED_LAUNCH_PLAN_ID;
      else process.env.KOLOSSEUM_CONTROLLED_LAUNCH_PLAN_ID = priorLaunchEnv.planId;
      if (priorLaunchEnv.priceId === undefined) delete process.env.KOLOSSEUM_CONTROLLED_LAUNCH_PRICE_ID;
      else process.env.KOLOSSEUM_CONTROLLED_LAUNCH_PRICE_ID = priorLaunchEnv.priceId;
      if (priorLaunchEnv.seatLimit === undefined) delete process.env.KOLOSSEUM_CONTROLLED_LAUNCH_SEAT_LIMIT;
      else process.env.KOLOSSEUM_CONTROLLED_LAUNCH_SEAT_LIMIT = priorLaunchEnv.seatLimit;

      // ============================================================
      // Assertions: every trigger type produced exactly the right
      // notification, for the right recipient, with a lawful deep link.
      // ============================================================

      const invitedList = await listNotifications(baseUrl, athleteInvited);
      const invitedByType = byType(invitedList);
      assert.equal(invitedByType.relationship_invited?.length, 1, "invited athlete gets relationship_invited");
      assert.equal(invitedByType.relationship_invited[0].deep_link.route_id, "athlete_today");
      assert.equal(invitedByType.relationship_invited[0].notification_payload.coach_user_id, coach.userId, "notification_payload names the inviting coach, not just the event type");

      const declinedAthleteList = await listNotifications(baseUrl, athleteDeclined);
      assert.equal(byType(declinedAthleteList).relationship_invited?.length, 1, "declined-relationship athlete still sees the original invite");
      assert.equal(byType(declinedAthleteList).relationship_declined, undefined, "the decline notification goes to the coach, not the athlete");

      let coachList = await listNotifications(baseUrl, coach);
      let coachByType = byType(coachList);
      assert.equal(coachByType.relationship_declined?.length, 1, "coach gets relationship_declined");
      assert.equal(coachByType.relationship_declined[0].deep_link.route_id, "coach_athletes");
      assert.equal(coachByType.relationship_declined[0].notification_payload.athlete_user_id, athleteDeclined.userId, "notification_payload names which athlete declined, not just that some athlete did");
      assert.equal(coachByType.relationship_accepted?.length, 1, "coach gets relationship_accepted");
      assert.equal(coachByType.relationship_accepted[0].deep_link.route_id, "coach_athlete_detail");
      assert.equal(coachByType.relationship_accepted[0].deep_link.params.athlete_id, athlete.userId);
      assert.equal(coachByType.relationship_accepted[0].target_available, true, "active relationship: target available");
      assert.equal(coachByType.relationship_accepted[0].notification_payload.athlete_user_id, athlete.userId, "notification_payload names which athlete accepted");

      let athleteList = await listNotifications(baseUrl, athlete);
      let athleteByType = byType(athleteList);
      assert.equal(athleteByType.relationship_invited?.length, 1);
      assert.equal(athleteByType.assignment_created?.length, 2, "assignment_created fires once per fresh assignment (the original, and the one that replaced the cancelled one)");
      assert.equal(athleteByType.assignment_created[0].notification_payload.coach_user_id, coach.userId, "notification_payload names which coach assigned the programme");
      assert.equal(athleteByType.programme_available?.length, 2, "programme_available fires alongside every assignment_created");
      assert.equal(athleteByType.assignment_replaced?.length, 1, "assignment_replaced fires once");
      assert.equal(athleteByType.assignment_cancelled?.length, 1, "assignment_cancelled fires once");
      assert.equal(athleteByType.event_linked?.length, 1, "event_linked fires once despite link/unlink/re-link (distinct source rows would each fire, but link_state='linked' rows collapse to one link record id per (coach,athlete,event) triple across relink)");
      assert.equal(athleteByType.event_linked[0].notification_payload.coach_user_id, coach.userId, "notification_payload names which coach linked the event");
      assert.ok(athleteByType.event_linked[0].notification_payload.event_id, "notification_payload names which event was linked");
      assert.equal(athleteByType.event_unlinked?.length, 1, "event_unlinked fires once");
      assert.equal(athleteByType.event_cancelled?.length, 1, "event_cancelled fires for the athlete still linked when the event was cancelled");
      assert.equal(athleteByType.coach_note_visible?.length, 1, "coach_note_visible fires for the athlete-visible note");
      assert.equal(athleteByType.coach_note_visible[0].notification_payload.session_id, sessionId);
      assert.equal(athleteByType.coach_note_visible[0].notification_payload.coach_user_id, coach.userId, "notification_payload names which coach left the visible note");

      coachList = await listNotifications(baseUrl, coach);
      coachByType = byType(coachList);
      assert.equal(coachByType.session_completed?.length, 1, "coach gets session_completed");
      assert.equal(coachByType.session_completed[0].deep_link.route_id, "coach_review_athlete");
      assert.equal(coachByType.session_completed[0].deep_link.params.athlete_id, athlete.userId);
      assert.equal(coachByType.session_completed[0].notification_payload.athlete_user_id, athlete.userId, "notification_payload names which athlete completed the session");
      assert.equal(coachByType.billing_action_required?.length, 1, "coach gets billing_action_required");
      assert.equal(coachByType.billing_action_required[0].deep_link.route_id, "shared_account");

      // No notification anywhere carries risk/priority/urgency language.
      const allNotifications = [...invitedList.notifications, ...declinedAthleteList.notifications, ...coachList.notifications, ...athleteList.notifications];
      for (const n of allNotifications) {
        const flattened = JSON.stringify(n).toLowerCase();
        assert.doesNotMatch(flattened, /urgent|priority|risk score|recommend|you should/u);
      }

      // ============================================================
      // Deduplication: re-listing must never create duplicate rows for
      // the same underlying source event.
      // ============================================================
      const athleteCountRow = await pool.query(
        "SELECT count(*)::int AS c FROM product_notifications WHERE recipient_user_id = $1",
        [athlete.userId]
      );
      const beforeRelistCount = athleteCountRow.rows[0].c;
      await listNotifications(baseUrl, athlete);
      await listNotifications(baseUrl, athlete);
      const afterRelistCount = await pool.query(
        "SELECT count(*)::int AS c FROM product_notifications WHERE recipient_user_id = $1",
        [athlete.userId]
      );
      assert.equal(afterRelistCount.rows[0].c, beforeRelistCount, "re-deriving twice must not create duplicate notification rows");

      // ============================================================
      // Read state: unread count, mark one read, mark all read, mark unread.
      // ============================================================
      const athleteUnreadBefore = await unreadCount(baseUrl, athlete);
      assert.ok(athleteUnreadBefore >= 6, "athlete should have several unread notifications");

      const firstNotificationId = athleteList.notifications[0].notification_id;
      assertStatus(
        await request(baseUrl, "POST", `/account/notifications/${encodeURIComponent(firstNotificationId)}/read`, {}, { cookie: athlete.cookie, csrf: athlete.csrf }),
        200,
        "mark one read"
      );
      const afterOneRead = await unreadCount(baseUrl, athlete);
      assert.equal(afterOneRead, athleteUnreadBefore - 1);

      assertStatus(
        await request(baseUrl, "POST", "/account/notifications/mark-all-read", {}, { cookie: athlete.cookie, csrf: athlete.csrf }),
        200,
        "mark all read"
      );
      assert.equal(await unreadCount(baseUrl, athlete), 0, "mark-all-read leaves nothing unread");

      assertStatus(
        await request(baseUrl, "POST", `/account/notifications/${encodeURIComponent(firstNotificationId)}/unread`, {}, { cookie: athlete.cookie, csrf: athlete.csrf }),
        200,
        "mark one unread"
      );
      assert.equal(await unreadCount(baseUrl, athlete), 1, "marking a single notification unread again is reflected in the count");

      // Marking a notification you don't own must fail, not silently succeed.
      const notOwnedAttempt = await request(
        baseUrl, "POST", `/account/notifications/${encodeURIComponent(firstNotificationId)}/read`, {}, { cookie: coach.cookie, csrf: coach.csrf }
      );
      assertStatus(notOwnedAttempt, 404, "cannot mark another recipient's notification read");

      // ============================================================
      // Target availability: revoking the relationship must make the
      // coach's athlete-scoped deep links (accepted, session_completed)
      // stop reporting an available target on the next read - without
      // deleting or mutating the notification rows themselves.
      // ============================================================
      await connectRelationship(baseUrl, coach.userId, athlete.userId, `rel_${nonce}`, "revoked", new Date().toISOString());

      const coachListAfterRevoke = await listNotifications(baseUrl, coach);
      const coachByTypeAfterRevoke = byType(coachListAfterRevoke);
      assert.equal(coachByTypeAfterRevoke.relationship_accepted[0].target_available, false, "accepted-relationship deep link becomes unavailable after revoke");
      assert.equal(coachByTypeAfterRevoke.session_completed[0].target_available, false, "session_completed deep link becomes unavailable after revoke");
      assert.equal(
        coachByTypeAfterRevoke.relationship_accepted.length,
        coachByType.relationship_accepted.length,
        "revoking the relationship must not delete or duplicate the existing notification row"
      );

      const revokedAthleteList = await listNotifications(baseUrl, athlete);
      assert.equal(byType(revokedAthleteList).relationship_revoked?.length, 1, "athlete gets relationship_revoked");

      // ============================================================
      // Fresh-process restart reconstruction.
      // ============================================================
      await closeServer(server);
      server = await listen();
      address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;

      const athleteAfterRestart = await listNotifications(baseUrl, athlete);
      assert.equal(
        athleteAfterRestart.notifications.length,
        revokedAthleteList.notifications.length,
        "restart must reconstruct the same notification set, not lose or duplicate rows"
      );
      const unreadAfterRestart = await unreadCount(baseUrl, athlete);
      assert.equal(
        unreadAfterRestart,
        2,
        "read state survives a fresh process restart (the re-marked-unread notification, plus the newly derived relationship_revoked notification)"
      );
    }
    finally {
      await closeServer(server);
      await cleanup();
    }
  }
);
