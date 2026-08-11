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
    password: "Full16cAthleteHistory!2026",
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
  const userId = `full_ui_16c_${label.toLowerCase().replaceAll(/[^a-z0-9]/gu, "_")}_${nonce}`;
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

  return { userId };
}

async function connectRelationship(baseUrl, coachUserId, athleteUserId, relationshipId, timestamp) {
  return request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: relationshipId,
    coach_user_id: coachUserId,
    athlete_user_id: athleteUserId,
    relationship_state: "accepted",
    relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: timestamp,
    created_at_iso8601: timestamp,
    updated_at_iso8601: timestamp,
    revoked_at_iso8601: null,
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
      source_note: "FULL-UI-16C integration proof"
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
    description: "FULL-UI-16C athlete history proof.",
    activity_id: "powerlifting",
    event_plan: null,
    blocks: [{
      block_id: "",
      order_index: 1,
      name: "Full-UI-16C Block",
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

async function assignTemplate(baseUrl, coach, athleteUserId, templateId, nonce) {
  const assignment = await request(
    baseUrl,
    "POST",
    "/coach-workspace/athlete-assignment",
    {
      request_id: `full_ui_16c_request_${nonce}`,
      requested_at_iso8601: new Date().toISOString(),
      coach_user_id: coach.userId,
      athlete_user_id: athleteUserId,
      template_id: templateId,
      activity_id: "powerlifting",
      event_id: ""
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

async function historyList(baseUrl, athleteUserId, extraBody = {}) {
  const result = await request(baseUrl, "POST", "/sessions/beta-athlete-history", {
    athlete_user_id: athleteUserId,
    ...extraBody
  });
  assertStatus(result, 200, "history list");
  return result.json;
}

async function historyDetail(baseUrl, athleteUserId, sessionId) {
  return request(baseUrl, "POST", "/sessions/beta-athlete-history-detail", {
    athlete_user_id: athleteUserId,
    session_id: sessionId
  });
}

test(
  "FULL-UI-16C athlete history: completed, partial, skipped and returned sessions, filters, provenance, access control, server-generated export and restart reconstruction",
  async () => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    let server = null;

    const userIds = [];
    const sessionIds = [];

    const cleanup = async () => {
      for (const sessionId of sessionIds) {
        await pool.query("DELETE FROM session_event_requests WHERE session_id = $1", [sessionId]).catch(() => {});
        await pool.query("DELETE FROM runtime_events WHERE session_id = $1", [sessionId]).catch(() => {});
        await pool.query("DELETE FROM session_event_seq WHERE session_id = $1", [sessionId]).catch(() => {});
      }
      for (const userId of userIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      await pool.query(
        `DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])`,
        [userIds.filter(Boolean)]
      ).catch(() => {});
    };

    try {
      server = await listen();
      let address = server.address();
      let baseUrl = `http://127.0.0.1:${address.port}`;
      const timestamp = new Date().toISOString();

      const coach = await setUpCoach(baseUrl, "Full16c Coach", nonce);
      userIds.push(coach.userId);

      const athlete = await setUpAthlete(baseUrl, "Full16c Athlete", nonce);
      userIds.push(athlete.userId);

      const otherAthlete = await setUpAthlete(baseUrl, "Full16c Other Athlete", nonce);
      userIds.push(otherAthlete.userId);

      await connectRelationship(baseUrl, coach.userId, athlete.userId, `relationship_${nonce}`, timestamp);
      await setUpStrengthProfile(baseUrl, coach, athlete.userId);

      const template = await createActivatedTemplate(baseUrl, coach.userId, `Full16c Programme ${nonce}`, 3);
      await assignTemplate(baseUrl, coach, athlete.userId, template.template_id, nonce);

      // --- Session 1: fully completed. ---
      const completedSessionId = await compileSession(baseUrl, coach, athlete.userId);
      sessionIds.push(completedSessionId);
      await request(baseUrl, "POST", `/sessions/${encodeURIComponent(completedSessionId)}/start`, {});
      for (const exerciseId of ["back_squat", "bench_press", "deadlift", "overhead_press"]) {
        assertStatus(
          await request(baseUrl, "POST", `/sessions/${encodeURIComponent(completedSessionId)}/events`, {
            type: "COMPLETE_EXERCISE", exercise_id: exerciseId
          }),
          201,
          `complete ${exerciseId} (session 1)`
        );
      }

      // --- Session 2: skip with reason + pain report -> partial. ---
      const partialSessionId = await compileSession(baseUrl, coach, athlete.userId);
      sessionIds.push(partialSessionId);
      await request(baseUrl, "POST", `/sessions/${encodeURIComponent(partialSessionId)}/start`, {});
      assertStatus(
        await request(baseUrl, "POST", `/sessions/${encodeURIComponent(partialSessionId)}/events`, {
          type: "SKIP_EXERCISE", exercise_id: "back_squat", reason_code: "time_constraint"
        }),
        201,
        "skip back_squat (session 2)"
      );
      assertStatus(
        await request(baseUrl, "POST", `/sessions/${encodeURIComponent(partialSessionId)}/events`, {
          type: "PAIN_REPORT", exercise_id: "bench_press", pain_reported: true
        }),
        201,
        "pain report bench_press (session 2)"
      );
      for (const exerciseId of ["bench_press", "deadlift", "overhead_press"]) {
        assertStatus(
          await request(baseUrl, "POST", `/sessions/${encodeURIComponent(partialSessionId)}/events`, {
            type: "COMPLETE_EXERCISE", exercise_id: exerciseId
          }),
          201,
          `complete ${exerciseId} (session 2)`
        );
      }

      // --- Session 3: split then return-skip -> a genuinely "returned" session. ---
      const returnedSessionId = await compileSession(baseUrl, coach, athlete.userId);
      sessionIds.push(returnedSessionId);
      await request(baseUrl, "POST", `/sessions/${encodeURIComponent(returnedSessionId)}/start`, {});
      assertStatus(
        await request(baseUrl, "POST", `/sessions/${encodeURIComponent(returnedSessionId)}/events`, {
          type: "COMPLETE_EXERCISE", exercise_id: "back_squat"
        }),
        201,
        "complete back_squat (session 3)"
      );
      assertStatus(
        await request(baseUrl, "POST", `/sessions/${encodeURIComponent(returnedSessionId)}/events`, {
          type: "SPLIT_SESSION"
        }),
        201,
        "split session 3"
      );
      assertStatus(
        await request(baseUrl, "POST", `/sessions/${encodeURIComponent(returnedSessionId)}/events`, {
          type: "RETURN_SKIP"
        }),
        201,
        "return-skip session 3"
      );

      // --- List: unfiltered. ---
      const unfiltered = await historyList(baseUrl, athlete.userId);
      assert.equal(unfiltered.session_count, 3);
      const byId = Object.fromEntries(unfiltered.sessions.map((s) => [s.session_id, s]));

      assert.equal(byId[completedSessionId].execution_status, "completed");
      assert.equal(byId[completedSessionId].completed_count, 4);
      assert.equal(byId[completedSessionId].dropped_count, 0);

      assert.equal(byId[partialSessionId].execution_status, "partial");
      assert.equal(byId[partialSessionId].completed_count, 3);
      assert.equal(byId[partialSessionId].dropped_count, 1);

      assert.equal(byId[returnedSessionId].execution_status, "partial");
      assert.equal(byId[returnedSessionId].split_entered, true);
      assert.equal(byId[returnedSessionId].split_return_decision, "skip");

      for (const session of unfiltered.sessions) {
        assert.equal(session.activity_id, "powerlifting");
        assert.equal(session.provenance.programme.template_name, `Full16c Programme ${nonce}`);
        assert.ok(session.provenance.assignment.assignment_id);
      }

      // --- Filters: status, date range, activity, programme narrow without
      //     mutating anything (re-fetching unfiltered still returns 3). ---
      const partialOnly = await historyList(baseUrl, athlete.userId, { status: "partial" });
      assert.equal(partialOnly.session_count, 2);
      assert.deepEqual(
        new Set(partialOnly.sessions.map((s) => s.session_id)),
        new Set([partialSessionId, returnedSessionId])
      );

      const completedOnly = await historyList(baseUrl, athlete.userId, { status: "completed" });
      assert.equal(completedOnly.session_count, 1);
      assert.equal(completedOnly.sessions[0].session_id, completedSessionId);

      const todayIso = new Date().toISOString().slice(0, 10);
      const futureDateFrom = await historyList(baseUrl, athlete.userId, { date_from: "2999-01-01" });
      assert.equal(futureDateFrom.session_count, 0, "a date_from far in the future must exclude every session");

      const sameDayFilter = await historyList(baseUrl, athlete.userId, { date_from: todayIso, date_to: todayIso });
      assert.equal(sameDayFilter.session_count, 3, "date_to must be inclusive of the whole calendar day");

      const activityFilter = await historyList(baseUrl, athlete.userId, { activity_id: "powerlifting" });
      assert.equal(activityFilter.session_count, 3);

      const wrongActivityFilter = await historyList(baseUrl, athlete.userId, { activity_id: "rugby_union" });
      assert.equal(wrongActivityFilter.session_count, 0);

      const programmeFilter = await historyList(baseUrl, athlete.userId, { template_id: template.template_id });
      assert.equal(programmeFilter.session_count, 3);

      const unfilteredAfterFilters = await historyList(baseUrl, athlete.userId);
      assert.equal(unfilteredAfterFilters.session_count, 3, "filtering must never alter the underlying stored record");

      // --- Detail: planned versus recorded, split/return record, skip
      //     reason/pain, and provenance. ---
      const detail = await historyDetail(baseUrl, athlete.userId, partialSessionId);
      assertStatus(detail, 200, "history detail (partial session)");
      assert.equal(detail.json.execution_status, "partial");

      const exercisesById = Object.fromEntries(detail.json.exercises.map((ex) => [ex.exercise_id, ex]));
      assert.equal(exercisesById.back_squat.recorded_state, "dropped");
      assert.equal(exercisesById.back_squat.skip_reason, "time_constraint");
      assert.equal(exercisesById.bench_press.recorded_state, "completed");
      assert.equal(exercisesById.bench_press.pain_reported, true);
      assert.equal(exercisesById.deadlift.pain_reported, false);

      assert.equal(detail.json.provenance.programme.template_id, template.template_id);
      assert.equal(detail.json.provenance.assignment.coach_user_id, coach.userId);

      const returnedDetail = await historyDetail(baseUrl, athlete.userId, returnedSessionId);
      assertStatus(returnedDetail, 200, "history detail (returned session)");
      assert.equal(returnedDetail.json.split_entered, true);
      assert.equal(returnedDetail.json.split_return_decision, "skip");
      const returnedEventTypes = returnedDetail.json.split_return_events.map((e) => e.type);
      assert.ok(returnedEventTypes.includes("SPLIT_SESSION"));
      assert.ok(returnedEventTypes.includes("RETURN_SKIP"));

      // --- Access control: another athlete must never read this session's
      //     detail, even with a syntactically valid session_id. ---
      const crossAccess = await historyDetail(baseUrl, otherAthlete.userId, partialSessionId);
      assertStatus(crossAccess, 403, "cross-athlete history detail access");
      assert.equal(crossAccess.json.reason, "athlete_history_detail_forbidden");

      const crossAccessList = await historyList(baseUrl, otherAthlete.userId);
      assert.equal(crossAccessList.session_count, 0, "another athlete's history list must never include this athlete's sessions");

      // --- Export: server-generated via the existing GDPR export boundary,
      //     includes factual provenance, is permission-scoped to the caller's
      //     own data. ---
      const exportResult = await request(baseUrl, "POST", "/sessions/beta-athlete-history-export", {
        athlete_user_id: athlete.userId
      });
      assertStatus(exportResult, 200, "history export");
      assert.equal(exportResult.json.ok, true);
      assert.equal(exportResult.json.permission.permission_scope, "own_user_data_only");
      assert.equal(exportResult.json.boundary.proof_layer_export, false);
      assert.equal(exportResult.json.boundary.organisation_export, false);
      assert.equal(exportResult.json.included_category_counts.session_records, 3);
      assert.equal(exportResult.json.included_category_counts.programme_assignments, 1);
      assert.ok(exportResult.json.included_category_counts.runtime_events > 0);

      const crossExport = await request(baseUrl, "POST", "/sessions/beta-athlete-history-export", {
        athlete_user_id: otherAthlete.userId
      });
      assertStatus(crossExport, 200, "other athlete's own export");
      assert.equal(crossExport.json.included_category_counts.session_records, 0, "an athlete's export must never include another athlete's sessions");

      // --- Fresh-process restart reconstruction. ---
      await closeServer(server);
      server = await listen();
      address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;

      const listAfterRestart = await historyList(baseUrl, athlete.userId);
      assert.equal(listAfterRestart.session_count, 3);
      const byIdAfterRestart = Object.fromEntries(listAfterRestart.sessions.map((s) => [s.session_id, s]));
      assert.equal(byIdAfterRestart[completedSessionId].execution_status, "completed");
      assert.equal(byIdAfterRestart[partialSessionId].execution_status, "partial");
      assert.equal(byIdAfterRestart[returnedSessionId].split_return_decision, "skip");

      const detailAfterRestart = await historyDetail(baseUrl, athlete.userId, partialSessionId);
      assertStatus(detailAfterRestart, 200, "history detail after restart");
      assert.deepEqual(detailAfterRestart.json.exercises, detail.json.exercises);
    }
    finally {
      await closeServer(server);
      await cleanup();
    }
  }
);
