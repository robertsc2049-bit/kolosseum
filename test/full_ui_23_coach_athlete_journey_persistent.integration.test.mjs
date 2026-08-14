// DEV NOTE: FULL-UI-23 coach-to-athlete vertical journey proof.
// Every step below crosses only public HTTP routes that the real single-page
// app itself calls (confirmed against public/app/app.js call sites). No
// database edit, opaque-ID shortcut, diagnostic page or internal service
// import is used to advance the journey - only the same wire contract a real
// browser session would use. A companion evidence record is written to
// docs/product/FULL_UI_23_COACH_ATHLETE_JOURNEY_EVIDENCE.json at the end of
// a passing run.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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

function dateOnlyFromNow(offset) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
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

function blockOfWeeks(weekCount, namePrefix) {
  return {
    block_id: "",
    order_index: 1,
    name: `${namePrefix} Block`,
    description: "",
    block_type: "strength",
    week_count: weekCount,
    weeks: Array.from({ length: weekCount }, (_, index) => index + 1).map((week) => ({
      week_id: "",
      order_index: week,
      sessions: [{
        session_id: "",
        order_index: 1,
        title: `Week ${week} Session`,
        work_items: workItems()
      }]
    }))
  };
}

// --- Fresh-process restart plumbing (mirrors BETA-E2E-01's HTTP restart gate). ---

function spawnNode(argumentsList, options) {
  const child = spawn(process.execPath, argumentsList, {
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
  return {
    child,
    get stdout() { return stdout; },
    get stderr() { return stderr; }
  };
}

async function waitForExit(child) {
  if (child.exitCode !== null) {
    return { code: child.exitCode, signal: child.signalCode ?? null };
  }
  return await new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal: signal ?? null }));
  });
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForHealth(processRecord, baseUrl, timeoutMilliseconds = 15000) {
  const deadline = Date.now() + timeoutMilliseconds;
  let lastError = null;

  while (Date.now() < deadline) {
    if (processRecord.child.exitCode !== null) {
      const exit = await waitForExit(processRecord.child);
      throw new Error(
        `Server exited before health became ready. exit_code=${exit.code} signal=${exit.signal}\n` +
        `stdout:\n${processRecord.stdout || "<empty>"}\nstderr:\n${processRecord.stderr || "<empty>"}`
      );
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
      lastError = new Error(`Health returned ${response.status}`);
    }
    catch (error) {
      lastError = error;
    }
    await delay(120);
  }

  throw new Error(
    `Server did not become healthy. base_url=${baseUrl} last_error=${lastError?.message ?? String(lastError)}\n` +
    `stdout:\n${processRecord.stdout || "<empty>"}\nstderr:\n${processRecord.stderr || "<empty>"}`
  );
}

async function startFreshServerProcess(root, environment) {
  const mainModule = path.join(root, "dist", "src", "main.js");
  await fs.access(mainModule);
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const processRecord = spawnNode([mainModule], {
    cwd: root,
    env: { ...environment, PORT: String(port) }
  });
  await waitForHealth(processRecord, baseUrl);
  return { ...processRecord, baseUrl, port };
}

async function stopFreshServerProcess(server) {
  if (!server?.child || server.child.exitCode !== null) return;
  if (process.platform === "win32") server.child.kill();
  else server.child.kill("SIGTERM");
  await Promise.race([waitForExit(server.child), delay(3000)]);
  if (server.child.exitCode === null) {
    server.child.kill("SIGKILL");
    await Promise.race([waitForExit(server.child), delay(2000)]);
  }
}

test(
  "FULL-UI-23 proves the complete coach-to-athlete product journey through public HTTP routes, persists across a fresh-process restart, and denies an unrelated coach",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 16);

    const evidence = {
      schema_version: "kolosseum.full_ui_23.coach_athlete_journey.v1.0.0",
      slice_id: "FULL-UI-23",
      recorded_at_iso8601: new Date().toISOString(),
      nonce,
      steps: []
    };

    function record(id, label, ok, detail) {
      evidence.steps.push({ id, label, result: ok ? "PASS" : "FAIL", detail: detail ?? null });
      assert.ok(ok, `${id}: ${label}`);
    }

    let server = null;
    let restarted = null;

    const coachUserId_holder = { value: "" };
    const otherCoachUserId_holder = { value: "" };
    const athleteUserId_holder = { value: "" };

    const cleanup = async () => {
      for (const userId of [
        coachUserId_holder.value,
        otherCoachUserId_holder.value,
        athleteUserId_holder.value
      ]) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_session_reviews WHERE coach_user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_coach_notes WHERE coach_user_id = $1", [userId]).catch(() => {});
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
        [[
          coachUserId_holder.value,
          otherCoachUserId_holder.value,
          athleteUserId_holder.value
        ].filter(Boolean)]
      );
    };

    testContext.after(async () => {
      await stopFreshServerProcess(restarted);
      await closeServer(server);
      await cleanup();
      await pool.end();
    });

    server = await listen();
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const firstProcessId = server.child?.pid ?? process.pid;

    const coachEmail = `full_ui_23_coach_${nonce}@example.com`;
    const coachPassword = "FullUi23CoachJourney!2026";
    const athleteEmail = `full_ui_23_athlete_${nonce}@example.com`;
    const athletePassword = "FullUi23AthleteJourney!2026";

    // --- Step 1: coach signs in (registration establishes the coach's first
    //     authenticated session - there is no pre-existing account for a
    //     fresh nonce, so account creation and the coach's first sign-in are
    //     the same public HTTP action a real coach performs once). ---
    const coachRegistration = await request(baseUrl, "POST", "/account/register", {
      actor_type: "coach",
      display_name: "Full-UI-23 Journey Coach",
      email: coachEmail,
      password: coachPassword,
      accepted_terms: true,
      accepted_consent: true,
      accepted_terms_version: "terms_v1",
      accepted_consent_version: "consent_v1"
    });
    assertStatus(coachRegistration, 201, "coach registration");
    const coachUserId = coachRegistration.json?.account?.user_id ?? "";
    assert.ok(coachUserId, "expected registered coach user_id");
    coachUserId_holder.value = coachUserId;
    let coachCookie = sessionCookie(coachRegistration, "coach registration");
    let coachCsrf = coachRegistration.json?.csrf_token;
    assert.ok(coachCsrf, "expected coach csrf token");
    record(
      "step_01_coach_sign_in",
      "Coach signs in",
      coachRegistration.response.status === 201 && Boolean(coachCookie) && Boolean(coachCsrf),
      { coach_user_id: coachUserId, actor_home_route: coachRegistration.json?.account?.actor_home_route }
    );

    // --- Step 2: coach completes required onboarding. ---
    const initialOnboarding = await request(baseUrl, "GET", "/account/coach-onboarding/", undefined, { cookie: coachCookie });
    assertStatus(initialOnboarding, 200, "initial coach onboarding");
    assert.equal(initialOnboarding.json?.current_stage, "profile");

    const onboardingProfile = await request(
      baseUrl, "PATCH", "/account/coach-onboarding/profile",
      { display_name: "Full-UI-23 Journey Coach", email: coachEmail },
      { cookie: coachCookie, csrf: coachCsrf }
    );
    assertStatus(onboardingProfile, 200, "coach onboarding profile");
    assert.equal(onboardingProfile.json?.current_stage, "terms");

    const onboardingTerms = await request(
      baseUrl, "POST", "/account/coach-onboarding/terms",
      { accepted: true, terms_version: "terms_v1" },
      { cookie: coachCookie, csrf: coachCsrf }
    );
    assertStatus(onboardingTerms, 200, "coach onboarding terms");
    assert.equal(onboardingTerms.json?.current_stage, "review");

    const onboardingComplete = await request(
      baseUrl, "POST", "/account/coach-onboarding/complete",
      { completion_confirmed: true },
      { cookie: coachCookie, csrf: coachCsrf }
    );
    assertStatus(onboardingComplete, 200, "coach onboarding complete");
    record(
      "step_02_coach_onboarding",
      "Coach completes required onboarding",
      onboardingComplete.json?.onboarding_status === "completed" &&
        onboardingComplete.json?.completion_persisted === true,
      { workspace_route: onboardingComplete.json?.workspace_route }
    );

    // --- Athlete account is created now (a real coach cannot connect to an
    //     athlete who does not yet exist); the athlete's own explicit sign-in
    //     proof is captured later at step 11 with a fresh session. ---
    const athleteBootstrap = await request(baseUrl, "POST", "/account/register", {
      actor_type: "athlete",
      display_name: "Full-UI-23 Journey Athlete",
      email: athleteEmail,
      password: athletePassword,
      activity_id: "powerlifting",
      accepted_terms: true,
      accepted_consent: true,
      accepted_terms_version: "terms_v1",
      accepted_consent_version: "consent_v1"
    });
    assertStatus(athleteBootstrap, 201, "athlete registration");
    const athleteUserId = athleteBootstrap.json?.account?.user_id ?? "";
    assert.ok(athleteUserId, "expected registered athlete user_id");
    athleteUserId_holder.value = athleteUserId;

    // --- Step 3: coach creates a standalone event (the real Events-page
    //     create form: POST /coach-workspace/events). ---
    const eventTimestamp = new Date().toISOString();
    const createdEvent = await request(baseUrl, "POST", "/coach-workspace/events", {
      coach_user_id: coachUserId,
      event_id: "",
      event_name: "Full-UI-23 Journey Meet",
      activity_id: "powerlifting",
      event_type: "powerlifting_meet",
      programme_start_date: dateOnlyFromNow(1),
      event_date: dateOnlyFromNow(15),
      location: "Mansfield",
      timezone: "Europe/London",
      notes: "FULL-UI-23 vertical journey proof",
      created_at_iso8601: eventTimestamp,
      updated_at_iso8601: eventTimestamp
    }, { cookie: coachCookie, csrf: coachCsrf });
    assertStatus(createdEvent, 201, "standalone event create");
    const eventId = createdEvent.json?.event?.event_id;
    const requiredWeekCount = Number(createdEvent.json?.event?.event_compile_summary?.required_week_count);
    assert.ok(eventId, "expected event_id");
    assert.ok(requiredWeekCount > 0, "expected a positive required week count");
    record(
      "step_03_coach_creates_event",
      "Coach creates a standalone event",
      Boolean(eventId) && requiredWeekCount > 0,
      { event_id: eventId, required_week_count: requiredWeekCount }
    );

    // --- Step 4: coach creates a programme (draft template) matching the
    //     event's required week count. ---
    const savedTemplate = await request(baseUrl, "POST", "/templates", {
      coach_user_id: coachUserId,
      template_version: 1,
      template_name: "Full-UI-23 Journey Programme",
      description: "FULL-UI-23 vertical journey proof.",
      activity_id: "powerlifting",
      event_plan: null,
      blocks: [blockOfWeeks(requiredWeekCount, "Full-UI-23 Journey")],
      updated_at_iso8601: new Date().toISOString()
    });
    assertStatus(savedTemplate, 201, "programme draft create");
    const templateId = savedTemplate.json?.template?.template_id;
    assert.ok(templateId, "expected template_id");
    record(
      "step_04_coach_creates_programme",
      "Coach creates a programme",
      Boolean(templateId) && savedTemplate.json?.template?.template_status === "draft",
      { template_id: templateId, week_count: savedTemplate.json?.template?.week_count }
    );

    // --- Step 5: coach binds the programme calendar to the existing event. ---
    const bound = await request(baseUrl, "POST", `/templates/${encodeURIComponent(templateId)}/bind-event`, {
      coach_user_id: coachUserId,
      event_id: eventId
    });
    assertStatus(bound, 200, "bind programme calendar to event");
    assert.equal(bound.json?.template?.bound_event_id, eventId);
    assert.equal(bound.json?.template?.event_compile_summary?.allocation_state, "balanced");
    record(
      "step_05_coach_binds_calendar",
      "Coach binds the programme calendar to the event",
      bound.json?.template?.bound_event_id === eventId &&
        bound.json?.template?.event_compile_summary?.allocation_state === "balanced",
      { allocation_state: bound.json?.template?.event_compile_summary?.allocation_state }
    );

    // --- Step 6: coach activates the programme. ---
    const completed = await request(baseUrl, "POST", `/templates/${encodeURIComponent(templateId)}/complete`, {
      coach_user_id: coachUserId
    });
    assertStatus(completed, 200, "complete programme");
    const activated = await request(baseUrl, "POST", `/templates/${encodeURIComponent(templateId)}/activate`, {
      coach_user_id: coachUserId
    });
    assertStatus(activated, 200, "activate programme");
    assert.equal(activated.json?.template?.template_status, "active");
    record(
      "step_06_coach_activates_programme",
      "Coach activates the programme",
      activated.json?.template?.template_status === "active",
      { template_status: activated.json?.template?.template_status }
    );

    // --- Prerequisite the real UI enforces before a profile can be opened or
    //     an assignment made: an accepted coach-athlete relationship, created
    //     through the real "connect athlete" form
    //     (POST /sessions/beta-coach-relationship). ---
    const relationshipTimestamp = new Date().toISOString();
    const relationship = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
      relationship_id: `full_ui_23_relationship_${nonce}`,
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      relationship_state: "accepted",
      relationship_scope: "individual_coach_athlete",
      accepted_at_iso8601: relationshipTimestamp,
      created_at_iso8601: relationshipTimestamp,
      updated_at_iso8601: relationshipTimestamp,
      revoked_at_iso8601: null,
      expires_at_iso8601: null
    });
    assertStatus(relationship, 201, "connect athlete (accepted relationship)");

    const strengthProfile = await request(baseUrl, "POST", "/coach-workspace/athlete-strength-profile", {
      coach_user_id: coachUserId,
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
        effective_date: dateOnlyFromNow(0),
        source_note: "FULL-UI-23 journey proof"
      })),
      expected_current_record_sha256: null
    }, { cookie: coachCookie, csrf: coachCsrf });
    assertStatus(strengthProfile, 201, "athlete strength profile");

    // --- Step 7: coach opens an athlete profile through a stable route. ---
    const profileBeforeAssignment = await request(
      baseUrl, "GET",
      `/coach-workspace/athlete-detail?athlete_user_id=${encodeURIComponent(athleteUserId)}`,
      undefined, { cookie: coachCookie }
    );
    assertStatus(profileBeforeAssignment, 200, "coach opens athlete profile");
    record(
      "step_07_coach_opens_athlete_profile",
      "Coach opens an athlete profile through a stable route",
      profileBeforeAssignment.json?.ok === true,
      { athlete_user_id: athleteUserId }
    );

    // --- Steps 8+9: coach links the athlete to the event and assigns the
    //     active programme + exact version, in the one real UI action that
    //     performs both (the assignment form carries both the programme and
    //     event selection; the server records the event link and the
    //     assignment together). ---
    const assignmentRequest = await request(baseUrl, "POST", "/coach-workspace/athlete-assignment", {
      request_id: `full_ui_23_assignment_${nonce}`,
      requested_at_iso8601: new Date().toISOString(),
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      template_id: templateId,
      activity_id: "powerlifting",
      event_id: eventId
    }, { cookie: coachCookie, csrf: coachCsrf });
    assertStatus(assignmentRequest, 201, "link athlete to event and assign programme");
    const assignmentId = assignmentRequest.json?.assignment?.assignment_id;
    assert.ok(assignmentId, "expected assignment_id");
    assert.equal(assignmentRequest.json?.assignment?.template_id, templateId);
    assert.equal(assignmentRequest.json?.assignment?.assignment_status, "assigned");
    assert.equal(assignmentRequest.json?.event_link?.event_id, eventId);
    assert.equal(assignmentRequest.json?.event_link?.lifecycle_action, "athlete_linked");
    record(
      "step_08_coach_links_athlete_to_event",
      "Coach links the athlete to the event",
      assignmentRequest.json?.event_link?.event_id === eventId,
      { event_id: eventId, assignment_id: assignmentId }
    );
    record(
      "step_09_coach_assigns_programme_and_version",
      "Coach assigns the active programme and exact version",
      assignmentRequest.json?.assignment?.template_id === templateId &&
        assignmentRequest.json?.assignment?.assignment_status === "assigned",
      { assignment_id: assignmentId, template_id: templateId }
    );

    // --- Step 10: coach reviews the persisted assignment. ---
    const persistedAssignments = await request(
      baseUrl, "GET", "/coach-workspace/assignments", undefined, { cookie: coachCookie }
    );
    assertStatus(persistedAssignments, 200, "coach reviews persisted assignments");
    const persistedAssignment = persistedAssignments.json?.assignments?.find(
      (entry) => entry.assignment_id === assignmentId
    );
    assert.ok(persistedAssignment, "expected the new assignment in the coach's assignment list");

    const profileAfterAssignment = await request(
      baseUrl, "GET",
      `/coach-workspace/athlete-detail?athlete_user_id=${encodeURIComponent(athleteUserId)}`,
      undefined, { cookie: coachCookie }
    );
    assertStatus(profileAfterAssignment, 200, "athlete profile after assignment");
    assert.equal(profileAfterAssignment.json?.detail?.current_assignment?.assignment_id, assignmentId);
    record(
      "step_10_coach_reviews_persisted_assignment",
      "Coach reviews the persisted assignment",
      Boolean(persistedAssignment) &&
        profileAfterAssignment.json?.detail?.current_assignment?.assignment_id === assignmentId,
      { assignment_id: assignmentId }
    );

    // --- Deep-link proof (part of FULL-UI-23's done-when criteria): the
    //     server-side data a coach_programme_detail / coach_review_athlete
    //     deep link resolves against is real, persisted and addressable by
    //     exactly the id the hash route carries. ---
    const templateLibrary = await request(baseUrl, "GET", `/templates?coach_user_id=${encodeURIComponent(coachUserId)}`, undefined, { cookie: coachCookie });
    assertStatus(templateLibrary, 200, "template library for programme-detail deep link");
    const templateInLibrary = templateLibrary.json?.templates?.find((entry) => entry.template_id === templateId);
    assert.ok(templateInLibrary, "expected #/coach/programmes/:template_id target to be addressable via the real template library");

    const coachRelationships = await request(baseUrl, "GET", "/coach-workspace/relationships", undefined, { cookie: coachCookie });
    assertStatus(coachRelationships, 200, "coach relationships for review-athlete deep link");
    const persistedRelationshipEntry = coachRelationships.json?.relationships?.find(
      (entry) => entry.athlete_user_id === athleteUserId
    );
    const persistedRelationship = persistedRelationshipEntry?.relationship;
    const athleteInRelationships = Boolean(persistedRelationshipEntry);
    assert.ok(athleteInRelationships, "expected #/coach/review/:athlete_id target to be addressable via the real relationships list");
    record(
      "deep_link_coach_programme_detail",
      "coach_programme_detail deep link target is real, persisted, addressable data",
      Boolean(templateInLibrary),
      { template_id: templateId }
    );
    record(
      "deep_link_coach_review_athlete",
      "coach_review_athlete deep link target is real, persisted, addressable data",
      athleteInRelationships === true,
      { athlete_id: athleteUserId }
    );

    // --- Step 11: athlete signs in (a fresh, explicit sign-in - distinct
    //     from the registration session captured above). ---
    const athleteSignIn = await request(baseUrl, "POST", "/account/sign-in", {
      email: athleteEmail,
      password: athletePassword
    });
    assertStatus(athleteSignIn, 200, "athlete sign-in");
    const athleteCookie = sessionCookie(athleteSignIn, "athlete sign-in");
    assert.equal(athleteSignIn.json?.account?.user_id, athleteUserId);
    record(
      "step_11_athlete_sign_in",
      "Athlete signs in",
      athleteSignIn.response.status === 200 && Boolean(athleteCookie),
      { athlete_user_id: athleteUserId }
    );

    // --- Step 12: athlete sees programme, version, event and countdown. ---
    async function todayFor() {
      const result = await request(baseUrl, "POST", "/sessions/beta-athlete-today", {
        athlete_user_id: athleteUserId
      });
      assertStatus(result, 200, "athlete today");
      return result.json;
    }

    const today = await todayFor();
    assert.equal(today.assignment?.assignment_id, assignmentId);
    assert.equal(today.assignment?.template_version, 1);
    assert.equal(today.event?.status, "active");
    assert.equal(today.event?.event_name, "Full-UI-23 Journey Meet");
    assert.equal(today.session?.action, "start");
    record(
      "step_12_athlete_sees_today",
      "Athlete sees programme, version, event and countdown",
      today.assignment?.assignment_id === assignmentId &&
        today.event?.status === "active" &&
        Boolean(today.session),
      { assignment_id: assignmentId, event_status: today.event?.status }
    );

    // --- Step 13: athlete compiles/opens the next assigned session through
    //     the lawful product path. ---
    const compiled = await request(baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
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
      beta_user_id: athleteUserId,
      beta_coach_user_id: coachUserId
    });
    assertStatus(compiled, 201, "compile next session");
    const sessionId = compiled.json?.session_id;
    assert.ok(sessionId, "expected session_id");
    assert.equal(compiled.json?.beta_path?.assignment_id, assignmentId);
    assert.equal(compiled.json?.beta_path?.event_id, eventId);
    const exercises = compiled.json?.planned_session?.exercises;
    assert.ok(Array.isArray(exercises) && exercises.length > 0, "expected planned exercises");
    record(
      "step_13_athlete_compiles_session",
      "Athlete compiles/opens the next assigned session",
      Boolean(sessionId) && compiled.json?.beta_path?.assignment_id === assignmentId,
      { session_id: sessionId }
    );

    // --- Step 14: athlete executes and completes the session. ---
    assertStatus(await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {}), 200, "session start");

    let terminalState = null;
    for (let i = 0; i < 10; i += 1) {
      const stateResult = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
      assertStatus(stateResult, 200, `session state probe ${i}`);
      const currentStep = stateResult.json?.current_step;
      if (!currentStep) {
        terminalState = stateResult.json;
        break;
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
    assert.ok(terminalState, "session did not reach a terminal state");
    assert.equal(terminalState.execution_status, "completed");
    record(
      "step_14_athlete_completes_session",
      "Athlete executes and completes the session",
      terminalState.execution_status === "completed",
      { session_id: sessionId, execution_status: terminalState.execution_status }
    );

    // --- Step 14b: a second session records a real skip reason and a real
    //     pain report, and the coach's athlete-detail surface reflects both
    //     facts - not just an opaque recorded-event count. ---
    const secondCompiled = await request(baseUrl, "POST", "/blocks/compile?create_session=true&beta_path=true", {
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
      beta_user_id: athleteUserId,
      beta_coach_user_id: coachUserId
    });
    assertStatus(secondCompiled, 201, "compile second session");
    const secondSessionId = secondCompiled.json?.session_id;
    assert.ok(secondSessionId, "expected a second session_id");
    assert.notEqual(secondSessionId, sessionId, "expected a distinct second session");

    assertStatus(await request(baseUrl, "POST", `/sessions/${encodeURIComponent(secondSessionId)}/start`, {}), 200, "second session start");

    const usedSkipReason = "pain_or_discomfort";
    let secondTerminalState = null;
    let skippedExerciseId = null;
    let painReportedExerciseId = null;

    for (let i = 0; i < 10; i += 1) {
      const stateResult = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(secondSessionId)}/state`);
      assertStatus(stateResult, 200, `second session state probe ${i}`);
      const currentStep = stateResult.json?.current_step;
      if (!currentStep) {
        secondTerminalState = stateResult.json;
        break;
      }
      const exerciseId = currentStep.exercise?.exercise_id;
      assert.ok(exerciseId, `second session probe ${i}: expected an exercise_id on current step`);

      if (!skippedExerciseId) {
        skippedExerciseId = exerciseId;
        assertStatus(
          await request(baseUrl, "POST", `/sessions/${encodeURIComponent(secondSessionId)}/events`, {
            event: { type: "SKIP_EXERCISE", exercise_id: exerciseId, reason_code: usedSkipReason }
          }),
          201,
          `skip exercise ${exerciseId} (second session)`
        );
        continue;
      }

      if (!painReportedExerciseId) {
        painReportedExerciseId = exerciseId;
        assertStatus(
          await request(baseUrl, "POST", `/sessions/${encodeURIComponent(secondSessionId)}/events`, {
            event: { type: "PAIN_REPORT", exercise_id: exerciseId, pain_reported: true }
          }),
          201,
          `pain report ${exerciseId} (second session)`
        );
      }

      assertStatus(
        await request(baseUrl, "POST", `/sessions/${encodeURIComponent(secondSessionId)}/events`, {
          event: { type: "COMPLETE_EXERCISE", exercise_id: exerciseId }
        }),
        201,
        `complete exercise ${exerciseId} (second session)`
      );
    }
    assert.ok(secondTerminalState, "second session did not reach a terminal state");
    assert.equal(secondTerminalState.execution_status, "partial");
    assert.ok(skippedExerciseId, "expected a skipped exercise in the second session");
    assert.ok(painReportedExerciseId, "expected a pain-reported exercise in the second session");

    const athleteDetailAfterSecondSession = await request(
      baseUrl, "GET",
      `/coach-workspace/athlete-detail?athlete_user_id=${encodeURIComponent(athleteUserId)}`,
      undefined, { cookie: coachCookie }
    );
    assertStatus(athleteDetailAfterSecondSession, 200, "coach athlete-detail after second session");
    const secondSessionSummary = athleteDetailAfterSecondSession.json?.detail?.session_history?.find(
      (entry) => entry.session_id === secondSessionId
    );
    assert.ok(secondSessionSummary, "expected the second session in the coach's session history");
    assert.equal(secondSessionSummary.pain_reported, true);
    assert.ok(
      Array.isArray(secondSessionSummary.skip_reasons) && secondSessionSummary.skip_reasons.includes(usedSkipReason),
      "expected the coach's session history to surface the athlete's recorded skip reason"
    );

    const firstSessionSummary = athleteDetailAfterSecondSession.json?.detail?.session_history?.find(
      (entry) => entry.session_id === sessionId
    );
    assert.ok(firstSessionSummary, "expected the first session in the coach's session history");
    assert.equal(firstSessionSummary.pain_reported, false);
    assert.deepEqual(firstSessionSummary.skip_reasons, []);

    record(
      "step_14b_coach_sees_pain_and_skip_facts",
      "Coach's session history surfaces the athlete's recorded pain report and skip reason, not just an event count",
      secondSessionSummary.pain_reported === true &&
        secondSessionSummary.skip_reasons.includes(usedSkipReason) &&
        firstSessionSummary.pain_reported === false,
      { session_id: secondSessionId, skip_reason: usedSkipReason }
    );

    // --- Step 15: coach sees the factual completed-session record. ---
    const reviewQueue = await request(
      baseUrl, "GET",
      `/coach-workspace/reviews?coach_user_id=${encodeURIComponent(coachUserId)}&athlete_user_id=${encodeURIComponent(athleteUserId)}`,
      undefined, { cookie: coachCookie }
    );
    assertStatus(reviewQueue, 200, "coach review queue");
    const completedRecord = reviewQueue.json?.records?.find((entry) => entry.session_id === sessionId);
    assert.ok(completedRecord, "expected the completed session in the coach's review queue");
    assert.equal(completedRecord.session_status, "completed");
    assert.equal(completedRecord.awaiting_review, true);
    assert.equal(completedRecord.calls_engine, false);

    const markedReviewed = await request(baseUrl, "POST", `/coach-workspace/session-review/${encodeURIComponent(sessionId)}`, {
      request_id: `full_ui_23_review_${nonce}`,
      requested_at_iso8601: new Date().toISOString(),
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      artefact_id: `beta_e2e_artefact_${sessionId}`,
      review_status: "reviewed"
    }, { cookie: coachCookie, csrf: coachCsrf });
    assertStatus(markedReviewed, 201, "mark session reviewed");
    assert.equal(markedReviewed.json?.review?.review_status, "reviewed");
    assert.equal(markedReviewed.json?.review?.non_binding, true);
    assert.equal(markedReviewed.json?.review?.included_in_engine_input, false);
    record(
      "step_15_coach_sees_completed_session",
      "Coach sees the factual completed-session record",
      completedRecord.session_status === "completed" &&
        markedReviewed.json?.review?.review_status === "reviewed",
      { session_id: sessionId }
    );

    // --- Step 16: coach adds a non-binding athlete-visible note (plus a
    //     coach-private note that must never reach the athlete). ---
    const athleteVisibleNoteText = "Great tempo control today.";
    const coachPrivateNoteText = "Consider a deload if grip keeps failing.";

    const coachProfileForNotes = coachRegistration.json?.bootstrap?.coach_profile;
    assert.ok(coachProfileForNotes, "expected the coach's bootstrap coach_profile record");
    assert.ok(persistedRelationship, "expected the persisted relationship record");

    assertStatus(await request(baseUrl, "POST", "/sessions/beta-coach-notes", {
      coach_profile: coachProfileForNotes,
      relationship: persistedRelationship,
      athlete_user_id: athleteUserId,
      session_id: "not_applicable",
      artefact_id: "not_applicable",
      note_text: athleteVisibleNoteText,
      visibility: "athlete_visible"
    }), 201, "athlete-visible note");

    assertStatus(await request(baseUrl, "POST", "/sessions/beta-coach-notes", {
      coach_profile: coachProfileForNotes,
      relationship: persistedRelationship,
      athlete_user_id: athleteUserId,
      session_id: "not_applicable",
      artefact_id: "not_applicable",
      note_text: coachPrivateNoteText,
      visibility: "coach_private"
    }), 201, "coach-private note");
    record(
      "step_16_coach_adds_note",
      "Coach adds a non-binding athlete-visible note",
      true,
      { athlete_visible_note: athleteVisibleNoteText }
    );

    // --- Step 17: athlete sees that note, and only that note - no engine or
    //     session mutation results from it. ---
    const todayWithNote = await todayFor();
    assert.equal(todayWithNote.notes?.length, 1);
    assert.equal(todayWithNote.notes?.[0]?.note_text, athleteVisibleNoteText);
    assert.equal(todayWithNote.notes?.[0]?.non_binding, true);

    const stateAfterNote = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(stateAfterNote, 200, "session state after note");
    assert.equal(stateAfterNote.json?.execution_status, "completed");
    record(
      "step_17_athlete_sees_note",
      "Athlete sees that note without any engine or session mutation",
      todayWithNote.notes?.length === 1 &&
        todayWithNote.notes?.[0]?.note_text === athleteVisibleNoteText &&
        stateAfterNote.json?.execution_status === "completed",
      { visible_note_count: todayWithNote.notes?.length }
    );

    // --- Step 18: refreshing both actor contexts reconstructs the same
    //     server-backed state (a second, independent read of every view each
    //     actor's browser would refresh). ---
    const coachRefreshBefore = {
      profile: profileAfterAssignment.json,
      assignments: persistedAssignments.json,
      reviews: reviewQueue.json
    };
    const athleteRefreshBefore = { today: todayWithNote };

    const coachProfileRefetch = await request(
      baseUrl, "GET",
      `/coach-workspace/athlete-detail?athlete_user_id=${encodeURIComponent(athleteUserId)}`,
      undefined, { cookie: coachCookie }
    );
    assertStatus(coachProfileRefetch, 200, "coach profile refresh");
    const coachAssignmentsRefetch = await request(baseUrl, "GET", "/coach-workspace/assignments", undefined, { cookie: coachCookie });
    assertStatus(coachAssignmentsRefetch, 200, "coach assignments refresh");
    const athleteTodayRefetch = await todayFor();

    assert.equal(
      coachProfileRefetch.json?.detail?.current_assignment?.assignment_id,
      coachRefreshBefore.profile?.detail?.current_assignment?.assignment_id
    );
    assert.deepEqual(
      coachAssignmentsRefetch.json?.assignments?.find((entry) => entry.assignment_id === assignmentId),
      coachRefreshBefore.assignments?.assignments?.find((entry) => entry.assignment_id === assignmentId)
    );
    assert.deepEqual(athleteTodayRefetch, athleteRefreshBefore.today);
    record(
      "step_18_refresh_reconstruction",
      "Refreshing both actor contexts reconstructs the same server-backed state",
      true,
      { assignment_id: assignmentId }
    );

    // --- Step 19: a fresh operating-system process reconstructs the same
    //     state (the same recovery a browser refresh after a deploy/restart
    //     would trigger). ---
    const databaseUrl = process.env.DATABASE_URL;
    assert.ok(typeof databaseUrl === "string" && databaseUrl.trim().length > 0, "FULL-UI-23 restart gate requires DATABASE_URL");
    const environment = { ...process.env, DATABASE_URL: databaseUrl };
    delete environment.SMOKE_NO_DB;

    restarted = await startFreshServerProcess(root, environment);
    assert.notEqual(restarted.child.pid, firstProcessId, "restart must use a new operating-system process");

    const coachProfileAfterRestart = await request(
      restarted.baseUrl, "GET",
      `/coach-workspace/athlete-detail?athlete_user_id=${encodeURIComponent(athleteUserId)}`,
      undefined, { cookie: coachCookie }
    );
    assertStatus(coachProfileAfterRestart, 200, "coach profile after restart");

    const reviewQueueAfterRestart = await request(
      restarted.baseUrl, "GET",
      `/coach-workspace/reviews?coach_user_id=${encodeURIComponent(coachUserId)}&athlete_user_id=${encodeURIComponent(athleteUserId)}`,
      undefined, { cookie: coachCookie }
    );
    assertStatus(reviewQueueAfterRestart, 200, "review queue after restart");

    const athleteTodayAfterRestart = await request(restarted.baseUrl, "POST", "/sessions/beta-athlete-today", {
      athlete_user_id: athleteUserId
    });
    assertStatus(athleteTodayAfterRestart, 200, "athlete today after restart");

    assert.equal(
      coachProfileAfterRestart.json?.detail?.current_assignment?.assignment_id,
      assignmentId
    );
    const reviewedRecordAfterRestart = reviewQueueAfterRestart.json?.records?.find(
      (entry) => entry.session_id === sessionId
    );
    assert.equal(reviewedRecordAfterRestart?.review_status, "reviewed");
    assert.deepEqual(athleteTodayAfterRestart.json, athleteTodayRefetch);
    record(
      "step_19_fresh_process_restart",
      "A fresh operating-system process reconstructs the same state",
      coachProfileAfterRestart.json?.detail?.current_assignment?.assignment_id === assignmentId &&
        reviewedRecordAfterRestart?.review_status === "reviewed",
      { first_pid: firstProcessId, restarted_pid: restarted.child.pid }
    );

    // --- Step 20: an unrelated coach is denied. ---
    const otherCoachRegistration = await request(restarted.baseUrl, "POST", "/account/register", {
      actor_type: "coach",
      display_name: "Full-UI-23 Unrelated Coach",
      email: `full_ui_23_other_coach_${nonce}@example.com`,
      password: "FullUi23OtherCoach!2026",
      accepted_terms: true,
      accepted_consent: true,
      accepted_terms_version: "terms_v1",
      accepted_consent_version: "consent_v1"
    });
    assertStatus(otherCoachRegistration, 201, "unrelated coach registration");
    const otherCoachUserId = otherCoachRegistration.json?.account?.user_id ?? "";
    otherCoachUserId_holder.value = otherCoachUserId;
    const otherCoachCookie = sessionCookie(otherCoachRegistration, "unrelated coach registration");

    const deniedProfile = await request(
      restarted.baseUrl, "GET",
      `/coach-workspace/athlete-detail?athlete_user_id=${encodeURIComponent(athleteUserId)}`,
      undefined, { cookie: otherCoachCookie }
    );
    // The coach-workspace surface reports every access-boundary rejection
    // (this one included) as a 400 with an explicit relationship_access_denied
    // reason, rather than a 403 - an existing, established convention across
    // this whole route surface, not something introduced by this proof.
    assertStatus(deniedProfile, 400, "unrelated coach denied athlete profile");
    assert.equal(deniedProfile.json?.details?.reason, "relationship_access_denied");

    const deniedReviews = await request(
      restarted.baseUrl, "GET",
      `/coach-workspace/reviews?coach_user_id=${encodeURIComponent(otherCoachUserId)}&athlete_user_id=${encodeURIComponent(athleteUserId)}`,
      undefined, { cookie: otherCoachCookie }
    );
    assertStatus(deniedReviews, 403, "unrelated coach denied review queue");

    record(
      "step_20_unrelated_coach_denied",
      "An unrelated coach is denied",
      deniedProfile.json?.details?.reason === "relationship_access_denied" &&
        deniedReviews.response.status === 403,
      { other_coach_user_id: otherCoachUserId }
    );

    // --- Write the machine-readable evidence record. ---
    assert.ok(evidence.steps.every((entry) => entry.result === "PASS"), "every recorded step must be PASS before writing evidence");
    evidence.status = "PASS";
    evidence.assignment_id = assignmentId;
    evidence.session_id = sessionId;
    evidence.template_id = templateId;
    evidence.event_id = eventId;

    const evidencePath = path.join(root, "docs", "product", "FULL_UI_23_COACH_ATHLETE_JOURNEY_EVIDENCE.json");
    await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

    const writtenBack = JSON.parse(await fs.readFile(evidencePath, "utf8"));
    assert.equal(writtenBack.status, "PASS");
    assert.equal(writtenBack.steps.length, evidence.steps.length);
  }
);
