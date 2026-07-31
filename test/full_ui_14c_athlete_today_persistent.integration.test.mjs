import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
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

function sessionCookie(result, label) {
  const values =
    typeof result.response.headers.getSetCookie === "function"
      ? result.response.headers.getSetCookie()
      : [result.response.headers.get("set-cookie")].filter(Boolean);

  const session = values.find((value) => String(value).startsWith("kolosseum_session="));
  assert.ok(session, `${label}: expected session cookie`);
  return String(session).split(";")[0];
}

function assertStatus(result, status, label) {
  assert.equal(
    result.response.status,
    status,
    `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`
  );
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
    role: index === 0 ? "primary" : "accessory"
  }));
}

function blockWithSessions(sessionCount) {
  return {
    block_id: "",
    order_index: 1,
    name: "Full-UI-14C Block",
    description: "",
    block_type: "strength",
    week_count: sessionCount,
    weeks: Array.from({ length: sessionCount }, (_, index) => index + 1).map((week) => ({
      week_id: "",
      order_index: week,
      sessions: [{
        session_id: "",
        order_index: 1,
        title: `Session ${week}`,
        work_items: workItems()
      }]
    }))
  };
}

async function registerAccount(baseUrl, actorType, label, nonce) {
  const registration = await request(baseUrl, "POST", "/account/register", {
    actor_type: actorType,
    display_name: label,
    email: `${label.toLowerCase().replaceAll(/[^a-z0-9]/gu, "_")}_${nonce}@example.com`,
    password: "Full14cAthleteToday!2026",
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

async function setUpAthlete(baseUrl, label, nonce) {
  const userId = `full_ui_14c_${label.toLowerCase().replaceAll(/[^a-z0-9]/gu, "_")}_${nonce}`;
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
    phase1_input: {
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
    },
    jurisdiction_acknowledged: true,
    declared_at_iso8601: timestamp,
    accepted_terms_version: "terms_v1",
    copy_acknowledgement_id: "BETA16_COPY_DECLARATION_ACKNOWLEDGEMENT"
  }), 201, `${label} declaration`);

  return { userId };
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
    revoked_at_iso8601: state === "revoked" ? timestamp : null,
    expires_at_iso8601: null
  });
}

async function createActivatedTemplate(baseUrl, coachUserId, name, sessionCount) {
  const saved = await request(baseUrl, "POST", "/templates", {
    coach_user_id: coachUserId,
    template_version: 1,
    template_name: name,
    description: "FULL-UI-14C athlete-today proof.",
    activity_id: "powerlifting",
    event_plan: null,
    blocks: [blockWithSessions(sessionCount)],
    updated_at_iso8601: new Date().toISOString()
  });
  assertStatus(saved, 201, `${name}: draft save`);
  const template = saved.json.template;

  assertStatus(
    await request(baseUrl, "POST", `/templates/${encodeURIComponent(template.template_id)}/activate`, {
      coach_user_id: coachUserId
    }),
    200,
    `${name}: activate`
  );

  return template;
}

async function assignTemplate(baseUrl, coach, athleteUserId, templateId, nonce, eventId) {
  const body = {
    request_id: `full_ui_14c_request_${nonce}_${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`,
    requested_at_iso8601: new Date().toISOString(),
    coach_user_id: coach.userId,
    athlete_user_id: athleteUserId,
    template_id: templateId,
    activity_id: "powerlifting",
    event_id: eventId ?? ""
  };
  const assignment = await request(
    baseUrl,
    "POST",
    "/coach-workspace/athlete-assignment",
    body,
    { cookie: coach.cookie, csrf: coach.csrf }
  );
  assertStatus(assignment, 201, "athlete assignment");
  return assignment.json.assignment;
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
      source_note: "FULL-UI-14C integration proof"
    })),
    expected_current_record_sha256: null
  }, { cookie: coach.cookie, csrf: coach.csrf }), 201, "strength profile");
}

async function todayFor(baseUrl, athleteUserId) {
  const result = await request(baseUrl, "POST", "/sessions/beta-athlete-today", {
    athlete_user_id: athleteUserId
  });
  assertStatus(result, 200, `today(${athleteUserId})`);
  return result.json;
}

async function advanceSessionToTerminal(baseUrl, sessionId) {
  assertStatus(
    await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {}),
    200,
    "start session"
  );

  for (let i = 0; i < 10; i += 1) {
    const stateResult = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(stateResult, 200, `session state probe ${i}`);

    const currentStep = stateResult.json?.current_step;
    if (!currentStep) {
      return stateResult.json;
    }

    const exerciseId = currentStep.exercise?.exercise_id;
    assert.ok(exerciseId, `probe ${i}: expected an exercise_id on current step`);

    assertStatus(
      await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
        event: { type: "COMPLETE_EXERCISE", exercise_id: exerciseId }
      }),
      201,
      `complete exercise ${exerciseId}`
    );
  }

  throw new Error("session did not reach a terminal state within 10 exercise completions");
}

test(
  "FULL-UI-14C reconstructs the athlete's authoritative Today state through every declared lifecycle stage",
  async () => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
    let server = null;

    const userIds = [];
    const cleanup = async () => {
      for (const userId of userIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
      await pool.query(
        `
        DELETE FROM beta_product_records
        WHERE subject_user_id = ANY($1::text[])
           OR actor_user_id = ANY($1::text[])
        `,
        [userIds.filter(Boolean)]
      );
      await pool.query("DELETE FROM product_coach_notes WHERE coach_user_id = ANY($1::text[])", [userIds.filter(Boolean)]).catch(() => {});
    };

    try {
      server = await listen();
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const timestamp = new Date().toISOString();

      const coach = await setUpCoach(baseUrl, "Full14c Today Coach", nonce);
      userIds.push(coach.userId);

      // --- Athlete A: the full lifecycle progression. ---
      const athleteA = await setUpAthlete(baseUrl, "Full14c Athlete A", nonce);
      userIds.push(athleteA.userId);

      const beforeAssignment = await todayFor(baseUrl, athleteA.userId);
      assert.equal(beforeAssignment.state, "no_current_assignment");
      assert.equal(beforeAssignment.assignment, null);
      assert.equal(beforeAssignment.session, null);

      const relationshipAResult = await connectRelationship(
        baseUrl,
        coach.userId,
        athleteA.userId,
        `relationship_a_${nonce}`,
        "accepted",
        timestamp
      );
      const relationshipA = relationshipAResult.json.relationship;

      await setUpStrengthProfile(baseUrl, coach, athleteA.userId);

      const templateA = await createActivatedTemplate(baseUrl, coach.userId, "Full14c Programme A", 2);
      const assignmentA = await assignTemplate(baseUrl, coach, athleteA.userId, templateA.template_id, nonce);

      const noSession = await todayFor(baseUrl, athleteA.userId);
      assert.equal(noSession.state, "no_session");
      assert.equal(noSession.assignment.assignment_id, assignmentA.assignment_id);
      assert.equal(noSession.assignment.template_version, 1);
      assert.equal(noSession.assignment.template_name, "Full14c Programme A");
      assert.equal(noSession.session.action, "start");
      assert.equal(noSession.session.total_session_count, 2);
      assert.equal(noSession.session.template_session_index, 0);

      const firstResolved = noSession.session.planned_items[0].resolved_load;
      assert.ok(firstResolved, "expected a resolved load on the first planned item");
      assert.ok(firstResolved.source, "expected a resolved-load source reference");
      assert.equal(firstResolved.source.source_type, "tested_1rm");

      // --- Coach notes: only the athlete-visible one must ever appear. ---
      assertStatus(await request(baseUrl, "POST", "/sessions/beta-coach-notes", {
        coach_profile: coach.profile,
        relationship: relationshipA,
        athlete_user_id: athleteA.userId,
        session_id: "not_applicable",
        artefact_id: "not_applicable",
        note_text: "Great tempo control today.",
        visibility: "athlete_visible"
      }), 201, "athlete-visible note");

      assertStatus(await request(baseUrl, "POST", "/sessions/beta-coach-notes", {
        coach_profile: coach.profile,
        relationship: relationshipA,
        athlete_user_id: athleteA.userId,
        session_id: "not_applicable",
        artefact_id: "not_applicable",
        note_text: "Consider a deload if grip keeps failing.",
        visibility: "coach_private"
      }), 201, "coach-private note");

      const withNotes = await todayFor(baseUrl, athleteA.userId);
      assert.equal(withNotes.notes.length, 1);
      assert.equal(withNotes.notes[0].note_text, "Great tempo control today.");
      assert.equal(withNotes.notes[0].non_binding, true);

      // --- Start the first session (create_session=true), then Today must
      //     report "continue" pointed at the exact same server-selected
      //     session, never a locally-cached guess. ---
      const compiled = await request(
        baseUrl,
        "POST",
        "/blocks/compile?create_session=true&beta_path=true",
        {
          phase1_input: {
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
          },
          beta_user_id: athleteA.userId,
          beta_coach_user_id: coach.userId
        }
      );
      assertStatus(compiled, 201, "compile first session");
      const firstSessionId = compiled.json.session_id;
      assert.ok(firstSessionId, "expected a created session id");

      const ongoing = await todayFor(baseUrl, athleteA.userId);
      assert.equal(ongoing.state, "ok");
      assert.equal(ongoing.session.action, "continue");
      assert.equal(ongoing.session.session_id, firstSessionId);
      assert.equal(ongoing.session.template_session_index, 0);

      // --- Complete that session; Today must distinguish "this specific
      //     session is already complete" from "programme complete", since
      //     more sessions remain. ---
      await advanceSessionToTerminal(baseUrl, firstSessionId);

      const afterFirstComplete = await todayFor(baseUrl, athleteA.userId);
      assert.equal(afterFirstComplete.state, "session_already_complete");
      assert.equal(afterFirstComplete.session.action, "start_next");
      assert.equal(afterFirstComplete.session.template_session_index, 1);
      assert.equal(afterFirstComplete.session.total_session_count, 2);

      // --- Start and complete the final session; the programme is now
      //     genuinely complete. ---
      const compiledSecond = await request(
        baseUrl,
        "POST",
        "/blocks/compile?create_session=true&beta_path=true",
        {
          phase1_input: {
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
          },
          beta_user_id: athleteA.userId,
          beta_coach_user_id: coach.userId
        }
      );
      assertStatus(compiledSecond, 201, "compile second session");
      const secondSessionId = compiledSecond.json.session_id;

      await advanceSessionToTerminal(baseUrl, secondSessionId);

      const afterProgramme = await todayFor(baseUrl, athleteA.userId);
      assert.equal(afterProgramme.state, "programme_complete");
      assert.equal(afterProgramme.assignment.assignment_id, assignmentA.assignment_id);
      assert.equal(afterProgramme.session, null);

      // --- Athlete B: assigned but with no strength reference on file. ---
      const athleteB = await setUpAthlete(baseUrl, "Full14c Athlete B", nonce);
      userIds.push(athleteB.userId);

      await connectRelationship(
        baseUrl,
        coach.userId,
        athleteB.userId,
        `relationship_b_${nonce}`,
        "accepted",
        timestamp
      );

      const templateB = await createActivatedTemplate(baseUrl, coach.userId, "Full14c Programme B", 1);
      await assignTemplate(baseUrl, coach, athleteB.userId, templateB.template_id, nonce);

      const missingReference = await todayFor(baseUrl, athleteB.userId);
      assert.equal(missingReference.state, "missing_strength_reference");
      assert.equal(missingReference.assignment.template_name, "Full14c Programme B");
      assert.equal(missingReference.session, null);

      // --- Athlete C: relationship revoked after assignment. ---
      const athleteC = await setUpAthlete(baseUrl, "Full14c Athlete C", nonce);
      userIds.push(athleteC.userId);

      await connectRelationship(
        baseUrl,
        coach.userId,
        athleteC.userId,
        `relationship_c_${nonce}`,
        "accepted",
        timestamp
      );
      await setUpStrengthProfile(baseUrl, coach, athleteC.userId);

      const templateC = await createActivatedTemplate(baseUrl, coach.userId, "Full14c Programme C", 1);
      await assignTemplate(baseUrl, coach, athleteC.userId, templateC.template_id, nonce);

      const stillOk = await todayFor(baseUrl, athleteC.userId);
      assert.equal(stillOk.state, "no_session");

      await connectRelationship(
        baseUrl,
        coach.userId,
        athleteC.userId,
        `relationship_c_${nonce}`,
        "revoked",
        new Date().toISOString()
      );

      const revoked = await todayFor(baseUrl, athleteC.userId);
      assert.equal(revoked.state, "relationship_ended");
      assert.equal(revoked.session, null);

      // --- Athlete D: assignment bound to an event that is later cancelled -
      //     "event unavailable" must be reported without blocking the rest
      //     of the Today view. ---
      const athleteD = await setUpAthlete(baseUrl, "Full14c Athlete D", nonce);
      userIds.push(athleteD.userId);

      await connectRelationship(
        baseUrl,
        coach.userId,
        athleteD.userId,
        `relationship_d_${nonce}`,
        "accepted",
        timestamp
      );
      await setUpStrengthProfile(baseUrl, coach, athleteD.userId);

      const eventCreated = await request(baseUrl, "POST", "/coach-workspace/events/create", {
        event_id: "",
        event_name: "Full14c Fixture Meet",
        activity_id: "powerlifting",
        event_type: "powerlifting_meet",
        programme_start_date: (() => {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() + 1);
          return d.toISOString().slice(0, 10);
        })(),
        event_date: (() => {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() + 15);
          return d.toISOString().slice(0, 10);
        })(),
        location: "Mansfield",
        timezone: "Europe/London",
        notes: "FULL-UI-14C event fixture"
      }, { cookie: coach.cookie, csrf: coach.csrf });
      assertStatus(eventCreated, 201, "create event");
      const eventD = eventCreated.json.event;
      assert.equal(eventD.event_compile_summary.required_week_count, 2);

      const templateD = await createActivatedTemplate(baseUrl, coach.userId, "Full14c Programme D", 2);
      const assignmentD = await assignTemplate(
        baseUrl,
        coach,
        athleteD.userId,
        templateD.template_id,
        nonce,
        eventD.event_id
      );
      assert.equal(assignmentD.assigned_by_coach_id ?? coach.userId, coach.userId);

      const withEvent = await todayFor(baseUrl, athleteD.userId);
      assert.equal(withEvent.event.status, "active");
      assert.equal(withEvent.event.event_name, "Full14c Fixture Meet");

      assertStatus(await request(
        baseUrl,
        "POST",
        `/coach-workspace/events/${encodeURIComponent(eventD.event_id)}/cancel`,
        { expected_current_record_sha256: eventD.record_sha256 },
        { cookie: coach.cookie, csrf: coach.csrf }
      ), 200, "cancel event D");

      const withCancelledEvent = await todayFor(baseUrl, athleteD.userId);
      assert.equal(withCancelledEvent.event.status, "unavailable");
      assert.equal(withCancelledEvent.event.reason, "event_cancelled");
      // Cancelling the event must not block the athlete's own programme.
      assert.equal(withCancelledEvent.state, "no_session");
      assert.ok(withCancelledEvent.session);

      // --- Fresh-process reconstruction: a brand-new Node process reconnects
      //     and reads back the same authoritative facts for every athlete. ---
      const childScript = `
        import { loadAthleteTodayView } from "./dist/src/api/athlete_today_service.js";
        import { pool } from "./dist/src/db/pool.js";

        const results = {};
        for (const [label, athleteUserId] of Object.entries(${JSON.stringify({
          athleteA: athleteA.userId,
          athleteB: athleteB.userId,
          athleteC: athleteC.userId,
          athleteD: athleteD.userId
        })})) {
          results[label] = await loadAthleteTodayView(athleteUserId);
        }

        console.log(JSON.stringify(results));
        await pool.end();
      `;

      const child = spawnSync(
        process.execPath,
        ["--input-type=module", "--eval", childScript],
        { cwd: process.cwd(), env: process.env, encoding: "utf8" }
      );

      assert.equal(child.status, 0, child.stderr || child.stdout);

      const outputLine = child.stdout.trim().split(/\r?\n/u).filter(Boolean).at(-1);
      const afterRestart = JSON.parse(outputLine);

      assert.equal(afterRestart.athleteA.state, "programme_complete");
      assert.equal(afterRestart.athleteB.state, "missing_strength_reference");
      assert.equal(afterRestart.athleteC.state, "relationship_ended");
      assert.equal(afterRestart.athleteD.event.status, "unavailable");
      assert.equal(afterRestart.athleteD.event.reason, "event_cancelled");
    }
    finally {
      await closeServer(server);
      await cleanup();
      await pool.end();
    }
  }
);
