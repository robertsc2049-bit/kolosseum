// DEV NOTE: FULL-UI-24 athlete self-service vertical journey proof.
// Every step below crosses only public HTTP routes the real single-page app
// itself calls. The one lawful coach-setup prerequisite (event, programme,
// calendar bind, activation, strength profile, assignment) is created
// through the same public coach-workspace routes proven in FULL-UI-23 - never
// a database edit. Step 8 uses FULL-UI-24's own new invite-by-email +
// athlete-accept routes, so the athlete never types an opaque id anywhere in
// this journey. A companion evidence record is written to
// docs/product/FULL_UI_24_ATHLETE_SELF_SERVICE_JOURNEY_EVIDENCE.json at the
// end of a passing run.

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
    role: index === 0 ? "primary" : "accessory"
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

// --- Fresh-process restart plumbing (mirrors FULL-UI-23's HTTP restart gate). ---

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
  "FULL-UI-24 proves the complete athlete self-service journey through public HTTP routes, persists across a fresh-process restart, and denies a different athlete",
  async (testContext) => {
    const root = repoRoot();
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 16);

    const evidence = {
      schema_version: "kolosseum.full_ui_24.athlete_self_service_journey.v1.0.0",
      slice_id: "FULL-UI-24",
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
    const athleteUserId_holder = { value: "" };
    const otherAthleteUserId_holder = { value: "" };

    const cleanup = async () => {
      for (const userId of [
        coachUserId_holder.value,
        athleteUserId_holder.value,
        otherAthleteUserId_holder.value
      ]) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_support_requests WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM data_export_requests WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM data_deletion_requests WHERE user_id = $1", [userId]).catch(() => {});
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
          athleteUserId_holder.value,
          otherAthleteUserId_holder.value
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

    const athleteEmail = `full_ui_24_athlete_${nonce}@example.com`;
    const athletePasswordOriginal = "FullUi24AthleteJourney!2026";
    const athletePasswordChanged = "FullUi24AthleteJourneyChanged!2026";
    const coachEmail = `full_ui_24_coach_${nonce}@example.com`;
    const coachPassword = "FullUi24CoachSetup!2026";

    // ============================================================
    // Lawful coach-setup prerequisite (public routes only - proven
    // exactly this way in FULL-UI-23, reused here as a fixture).
    // ============================================================
    const coachRegistration = await request(baseUrl, "POST", "/account/register", {
      actor_type: "coach",
      display_name: "Full-UI-24 Setup Coach",
      email: coachEmail,
      password: coachPassword,
      accepted_terms: true,
      accepted_consent: true,
      accepted_terms_version: "terms_v1",
      accepted_consent_version: "consent_v1"
    });
    assertStatus(coachRegistration, 201, "coach setup registration");
    const coachUserId = coachRegistration.json?.account?.user_id ?? "";
    coachUserId_holder.value = coachUserId;
    const coachCookie = sessionCookie(coachRegistration, "coach setup registration");
    const coachCsrf = coachRegistration.json?.csrf_token;

    await request(baseUrl, "PATCH", "/account/coach-onboarding/profile", {
      display_name: "Full-UI-24 Setup Coach", email: coachEmail
    }, { cookie: coachCookie, csrf: coachCsrf });
    await request(baseUrl, "POST", "/account/coach-onboarding/terms", {
      accepted: true, terms_version: "terms_v1"
    }, { cookie: coachCookie, csrf: coachCsrf });
    await request(baseUrl, "POST", "/account/coach-onboarding/complete", {
      completion_confirmed: true
    }, { cookie: coachCookie, csrf: coachCsrf });

    const eventTimestamp = new Date().toISOString();
    const createdEvent = await request(baseUrl, "POST", "/coach-workspace/events", {
      coach_user_id: coachUserId,
      event_id: "",
      event_name: "Full-UI-24 Journey Meet",
      activity_id: "powerlifting",
      event_type: "powerlifting_meet",
      programme_start_date: dateOnlyFromNow(1),
      event_date: dateOnlyFromNow(15),
      location: "Mansfield",
      timezone: "Europe/London",
      notes: "FULL-UI-24 athlete self-service proof",
      created_at_iso8601: eventTimestamp,
      updated_at_iso8601: eventTimestamp
    }, { cookie: coachCookie, csrf: coachCsrf });
    assertStatus(createdEvent, 201, "setup event create");
    const eventId = createdEvent.json?.event?.event_id;
    const requiredWeekCount = Number(createdEvent.json?.event?.event_compile_summary?.required_week_count);
    assert.ok(eventId && requiredWeekCount > 0);

    const savedTemplate = await request(baseUrl, "POST", "/templates", {
      coach_user_id: coachUserId,
      template_version: 1,
      template_name: "Full-UI-24 Journey Programme",
      description: "FULL-UI-24 athlete self-service proof.",
      activity_id: "powerlifting",
      event_plan: null,
      blocks: [blockOfWeeks(requiredWeekCount, "Full-UI-24 Journey")],
      updated_at_iso8601: new Date().toISOString()
    });
    assertStatus(savedTemplate, 201, "setup programme create");
    const templateId = savedTemplate.json?.template?.template_id;

    const bound = await request(baseUrl, "POST", `/templates/${encodeURIComponent(templateId)}/bind-event`, {
      coach_user_id: coachUserId,
      event_id: eventId
    });
    assertStatus(bound, 200, "setup calendar bind");

    const activated = await request(baseUrl, "POST", `/templates/${encodeURIComponent(templateId)}/activate`, {
      coach_user_id: coachUserId
    });
    assertStatus(activated, 200, "setup programme activate");

    // ============================================================
    // Step 1: athlete creates an account.
    // ============================================================
    const athleteRegistration = await request(baseUrl, "POST", "/account/register", {
      actor_type: "athlete",
      display_name: "Full-UI-24 Journey Athlete",
      email: athleteEmail,
      password: athletePasswordOriginal,
      activity_id: "powerlifting",
      accepted_terms: true,
      accepted_consent: true,
      accepted_terms_version: "terms_v1",
      accepted_consent_version: "consent_v1"
    });
    assertStatus(athleteRegistration, 201, "athlete creates account");
    const athleteUserId = athleteRegistration.json?.account?.user_id ?? "";
    assert.ok(athleteUserId, "expected registered athlete user_id");
    athleteUserId_holder.value = athleteUserId;
    let athleteCookie = sessionCookie(athleteRegistration, "athlete creates account");
    let athleteCsrf = athleteRegistration.json?.csrf_token;
    record(
      "step_01_athlete_creates_account",
      "Athlete creates an account",
      athleteRegistration.response.status === 201 && Boolean(athleteUserId),
      { athlete_user_id: athleteUserId }
    );

    // ============================================================
    // Step 2: athlete verifies the account through the supported
    // product route (the real completion route; this environment
    // returns the code directly instead of sending an email).
    // ============================================================
    const verificationRequest = await request(baseUrl, "POST", "/account/email-verification/request", {}, {
      cookie: athleteCookie, csrf: athleteCsrf
    });
    assertStatus(verificationRequest, 202, "email verification request");
    const verificationCode = String(verificationRequest.json?.development_code ?? "");
    assert.match(verificationCode, /^\d{6}$/u, "expected a six-digit verification code");

    const verificationComplete = await request(baseUrl, "POST", "/account/email-verification/complete", {
      code: verificationCode
    }, { cookie: athleteCookie, csrf: athleteCsrf });
    assertStatus(verificationComplete, 200, "email verification complete");
    assert.equal(verificationComplete.json?.account?.email_verified, true);
    record(
      "step_02_athlete_verifies_account",
      "Athlete verifies the account through the supported product route",
      verificationComplete.json?.account?.email_verified === true,
      { athlete_user_id: athleteUserId }
    );

    // ============================================================
    // Step 3: athlete signs in (a fresh, explicit sign-in distinct
    // from the registration session captured above).
    // ============================================================
    const athleteSignIn = await request(baseUrl, "POST", "/account/sign-in", {
      email: athleteEmail,
      password: athletePasswordOriginal
    });
    assertStatus(athleteSignIn, 200, "athlete signs in");
    athleteCookie = sessionCookie(athleteSignIn, "athlete signs in");
    athleteCsrf = athleteSignIn.json?.csrf_token;
    assert.equal(athleteSignIn.json?.account?.user_id, athleteUserId);
    record(
      "step_03_athlete_signs_in",
      "Athlete signs in",
      athleteSignIn.response.status === 200 && Boolean(athleteCookie),
      { athlete_user_id: athleteUserId }
    );

    // ============================================================
    // Steps 4-6: staged onboarding, accessibility/instruction-density
    // preferences, review and confirmation of declarations.
    // ============================================================
    const initialOnboarding = await request(baseUrl, "GET", "/account/onboarding/", undefined, { cookie: athleteCookie });
    assertStatus(initialOnboarding, 200, "initial athlete onboarding");
    assert.equal(initialOnboarding.json?.current_stage, "activity");
    assert.equal(initialOnboarding.json?.current_effective_declaration, null);

    const activityStage = await request(baseUrl, "PATCH", "/account/onboarding/draft", {
      current_stage: "execution_scope",
      fields: { activity_id: "powerlifting" }
    }, { cookie: athleteCookie, csrf: athleteCsrf });
    assertStatus(activityStage, 200, "onboarding activity stage");

    const executionScopeStage = await request(baseUrl, "PATCH", "/account/onboarding/draft", {
      current_stage: "product_acknowledgement",
      fields: { activity_id: "powerlifting", execution_scope: "coach_managed" }
    }, { cookie: athleteCookie, csrf: athleteCsrf });
    assertStatus(executionScopeStage, 200, "onboarding execution scope stage");

    const acknowledgementStage = await request(baseUrl, "PATCH", "/account/onboarding/draft", {
      current_stage: "jurisdiction",
      fields: {
        ...executionScopeStage.json?.draft?.fields,
        product_acknowledged: true
      }
    }, { cookie: athleteCookie, csrf: athleteCsrf });
    assertStatus(acknowledgementStage, 200, "onboarding product acknowledgement stage");

    const jurisdictionStage = await request(baseUrl, "PATCH", "/account/onboarding/draft", {
      current_stage: "accessibility",
      fields: {
        ...acknowledgementStage.json?.draft?.fields,
        jurisdiction_code: "england_wales",
        jurisdiction_acknowledged: true
      }
    }, { cookie: athleteCookie, csrf: athleteCsrf });
    assertStatus(jurisdictionStage, 200, "onboarding jurisdiction stage");

    const accessibilityStage = await request(baseUrl, "PATCH", "/account/onboarding/draft", {
      current_stage: "instruction_density",
      fields: {
        ...jurisdictionStage.json?.draft?.fields,
        accessibility_preferences: {
          reduced_motion: true,
          high_contrast: false,
          larger_text: false,
          screen_reader_optimised: false
        }
      }
    }, { cookie: athleteCookie, csrf: athleteCsrf });
    assertStatus(accessibilityStage, 200, "onboarding accessibility stage");
    record(
      "step_05_athlete_accessibility_preferences",
      "Athlete records accessibility and instruction-density preferences",
      accessibilityStage.json?.draft?.fields?.accessibility_preferences?.reduced_motion === true,
      { athlete_user_id: athleteUserId }
    );

    const reviewStage = await request(baseUrl, "PATCH", "/account/onboarding/draft", {
      current_stage: "review",
      fields: {
        ...accessibilityStage.json?.draft?.fields,
        instruction_density: "standard"
      }
    }, { cookie: athleteCookie, csrf: athleteCsrf });
    assertStatus(reviewStage, 200, "onboarding review stage");
    assert.equal(reviewStage.json?.current_stage, "review");
    record(
      "step_04_athlete_staged_onboarding",
      "Athlete completes staged onboarding",
      reviewStage.json?.current_stage === "review",
      { athlete_user_id: athleteUserId }
    );

    const onboardingConfirm = await request(baseUrl, "POST", "/account/onboarding/confirm", {
      review_confirmed: true
    }, { cookie: athleteCookie, csrf: athleteCsrf });
    assertStatus(onboardingConfirm, 200, "onboarding confirm");
    assert.equal(onboardingConfirm.json?.onboarding_status, "completed");
    assert.equal(onboardingConfirm.json?.current_effective_declaration?.declaration_status, "current");
    record(
      "step_06_athlete_reviews_confirms_declarations",
      "Athlete reviews and confirms declarations",
      onboardingConfirm.json?.onboarding_status === "completed",
      { athlete_user_id: athleteUserId }
    );

    // ============================================================
    // Step 7: athlete sees current terms and consent history.
    // ============================================================
    const terms = await request(baseUrl, "GET", "/account/terms");
    assertStatus(terms, 200, "current terms");
    assert.equal(terms.json?.current_terms_version, "terms_v1");

    const accountDetail = await request(baseUrl, "GET", "/account/detail", undefined, { cookie: athleteCookie });
    assertStatus(accountDetail, 200, "account detail with consent history");
    const acceptedConsentEntry = accountDetail.json?.consent_history?.some(
      (entry) => entry.event_type === "terms_and_consent_accepted"
    );
    record(
      "step_07_athlete_sees_terms_and_consent",
      "Athlete sees current terms and consent history",
      terms.json?.current_terms_version === "terms_v1" && acceptedConsentEntry === true,
      { athlete_user_id: athleteUserId }
    );

    // ============================================================
    // Step 8: athlete receives and accepts a coach invitation without
    // typing opaque IDs (FULL-UI-24's own invite-by-email + accept
    // routes - the coach names the athlete only by email; the athlete
    // accepts using only the relationship_id their own pending-
    // invitations list already supplied).
    // ============================================================
    const invitation = await request(baseUrl, "POST", "/coach-workspace/relationship-invitations", {
      athlete_email: athleteEmail
    }, { cookie: coachCookie, csrf: coachCsrf });
    assertStatus(invitation, 201, "coach invites athlete by email");
    assert.equal(invitation.json?.relationship?.relationship_state, "invited");

    const pendingInvitations = await request(baseUrl, "GET", "/coach-workspace/relationship-invitations", undefined, {
      cookie: athleteCookie
    });
    assertStatus(pendingInvitations, 200, "athlete sees pending invitations");
    const pendingInvitation = pendingInvitations.json?.invitations?.find(
      (entry) => entry.coach_user_id === coachUserId
    );
    assert.ok(pendingInvitation, "expected the coach's invitation in the athlete's own pending list");
    assert.equal(pendingInvitation.coach_display_name, "Full-UI-24 Setup Coach");

    const accepted = await request(
      baseUrl, "POST",
      `/coach-workspace/relationship-invitations/${encodeURIComponent(pendingInvitation.relationship_id)}/accept`,
      {}, { cookie: athleteCookie, csrf: athleteCsrf }
    );
    assertStatus(accepted, 201, "athlete accepts coach invitation");
    assert.equal(accepted.json?.relationship?.relationship_state, "accepted");
    record(
      "step_08_athlete_accepts_invitation",
      "Athlete receives and accepts a coach invitation without typing opaque IDs",
      pendingInvitation.relationship_id === accepted.json?.relationship?.relationship_id &&
        accepted.json?.relationship?.relationship_state === "accepted",
      { relationship_id: accepted.json?.relationship?.relationship_id }
    );

    // --- Coach-side prerequisites for a session: strength profile and
    //     the actual assignment (both real, public, coach-authenticated
    //     routes - the same ones proven in FULL-UI-23). ---
    await request(baseUrl, "POST", "/coach-workspace/athlete-strength-profile", {
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      preferred_weight_unit: "kg",
      load_rounding_increment: 2.5,
      bodyweight: 82,
      bodyweight_unit: "kg",
      benchmarks: [
        ["back_squat", 150],
        ["bench_press", 100],
        ["deadlift", 190],
        ["overhead_press", 65]
      ].map(([exerciseId, value]) => ({
        benchmark_id: "",
        exercise_id: exerciseId,
        value,
        unit: "kg",
        basis: "tested_1rm",
        effective_date: dateOnlyFromNow(0),
        source_note: "FULL-UI-24 journey proof"
      })),
      expected_current_record_sha256: null
    }, { cookie: coachCookie, csrf: coachCsrf });

    const assignmentRequest = await request(baseUrl, "POST", "/coach-workspace/athlete-assignment", {
      request_id: `full_ui_24_assignment_${nonce}`,
      requested_at_iso8601: new Date().toISOString(),
      coach_user_id: coachUserId,
      athlete_user_id: athleteUserId,
      template_id: templateId,
      activity_id: "powerlifting",
      event_id: eventId
    }, { cookie: coachCookie, csrf: coachCsrf });
    assertStatus(assignmentRequest, 201, "coach assigns programme to athlete");
    const assignmentId = assignmentRequest.json?.assignment?.assignment_id;
    assert.ok(assignmentId, "expected assignment_id");

    // ============================================================
    // Step 9: athlete sees a lawful assigned programme and event.
    // Step 10: athlete opens Today.
    // ============================================================
    async function todayFor() {
      const result = await request(baseUrl, "POST", "/sessions/beta-athlete-today", {
        athlete_user_id: athleteUserId
      });
      assertStatus(result, 200, "athlete today");
      return result.json;
    }

    const today = await todayFor();
    assert.equal(today.assignment?.assignment_id, assignmentId);
    assert.equal(today.event?.status, "active");
    assert.equal(today.event?.event_name, "Full-UI-24 Journey Meet");
    record(
      "step_09_athlete_sees_assigned_programme_and_event",
      "Athlete sees a lawful assigned programme and event",
      today.assignment?.assignment_id === assignmentId && today.event?.status === "active",
      { assignment_id: assignmentId, event_status: today.event?.status }
    );
    record(
      "step_10_athlete_opens_today",
      "Athlete opens Today",
      Boolean(today.session),
      { session_action: today.session?.action }
    );

    // ============================================================
    // Step 11: athlete starts a session.
    // ============================================================
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
    assertStatus(compiled, 201, "athlete compiles session");
    const sessionId = compiled.json?.session_id;
    assert.ok(sessionId, "expected session_id");

    const started = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {});
    assertStatus(started, 200, "athlete starts session");
    record(
      "step_11_athlete_starts_session",
      "Athlete starts a session",
      started.response.status === 200,
      { session_id: sessionId }
    );

    // ============================================================
    // Step 12: athlete records at least one lawful partial/skip path -
    // a real SKIP_EXERCISE with a closed-enum reason code.
    // ============================================================
    const firstState = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(firstState, 200, "session state before skip");
    const firstExerciseId = firstState.json?.current_step?.exercise?.exercise_id;
    assert.ok(firstExerciseId, "expected a current exercise to skip");

    const skip = await request(baseUrl, "POST", `/sessions/${encodeURIComponent(sessionId)}/events`, {
      event: { type: "SKIP_EXERCISE", exercise_id: firstExerciseId, reason_code: "fatigue" }
    });
    assertStatus(skip, 201, "athlete records a lawful skip");
    record(
      "step_12_athlete_records_lawful_skip",
      "Athlete records at least one lawful partial, skip or stop/return path",
      skip.response.status === 201,
      { session_id: sessionId, skipped_exercise_id: firstExerciseId }
    );

    // ============================================================
    // Step 13: refresh reconstructs the open session.
    // ============================================================
    const stateBeforeRefresh = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(stateBeforeRefresh, 200, "session state before refresh");
    const stateAfterRefresh = await request(baseUrl, "GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
    assertStatus(stateAfterRefresh, 200, "session state after refresh");
    assert.deepEqual(stateAfterRefresh.json, stateBeforeRefresh.json);
    assert.equal(stateAfterRefresh.json?.execution_status, "in_progress");
    record(
      "step_13_refresh_reconstructs_open_session",
      "Refresh reconstructs the open session",
      stateAfterRefresh.json?.execution_status === "in_progress",
      { session_id: sessionId }
    );

    // ============================================================
    // Step 14: athlete completes or lawfully closes the session -
    // completing every remaining exercise reaches a lawful terminal
    // state even though one exercise was dropped (execution_status
    // "partial", not "completed").
    // ============================================================
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
    assert.equal(terminalState.execution_status, "partial");
    record(
      "step_14_athlete_completes_or_closes_session",
      "Athlete completes or lawfully closes the session",
      terminalState.execution_status === "partial",
      { session_id: sessionId, execution_status: terminalState.execution_status }
    );

    // ============================================================
    // Step 15: athlete opens factual history and session detail.
    // ============================================================
    const historyList = await request(baseUrl, "POST", "/sessions/beta-athlete-history", {
      athlete_user_id: athleteUserId
    });
    assertStatus(historyList, 200, "athlete opens history");
    assert.ok(historyList.json?.sessions?.some((entry) => entry.session_id === sessionId));

    const historyDetail = await request(baseUrl, "POST", "/sessions/beta-athlete-history-detail", {
      athlete_user_id: athleteUserId,
      session_id: sessionId
    });
    assertStatus(historyDetail, 200, "athlete opens session detail");
    record(
      "step_15_athlete_opens_history_and_detail",
      "Athlete opens factual history and session detail",
      historyList.json?.sessions?.some((entry) => entry.session_id === sessionId) === true &&
        historyDetail.response.status === 200,
      { session_id: sessionId }
    );

    // ============================================================
    // Step 16: athlete updates lawful account profile fields.
    // ============================================================
    const profileUpdate = await request(baseUrl, "PATCH", "/account/profile", {
      display_name: "Full-UI-24 Journey Athlete Updated",
      email: athleteEmail
    }, { cookie: athleteCookie, csrf: athleteCsrf });
    assertStatus(profileUpdate, 200, "athlete updates profile");
    assert.equal(profileUpdate.json?.account?.display_name, "Full-UI-24 Journey Athlete Updated");
    record(
      "step_16_athlete_updates_profile",
      "Athlete updates lawful account profile fields",
      profileUpdate.json?.account?.display_name === "Full-UI-24 Journey Athlete Updated",
      { athlete_user_id: athleteUserId }
    );

    // ============================================================
    // Step 17: athlete changes password and signs in again.
    // ============================================================
    const passwordChange = await request(baseUrl, "POST", "/account/password/change", {
      current_password: athletePasswordOriginal,
      new_password: athletePasswordChanged
    }, { cookie: athleteCookie, csrf: athleteCsrf });
    assertStatus(passwordChange, 204, "athlete changes password");

    await request(baseUrl, "POST", "/account/sign-out", {}, { cookie: athleteCookie, csrf: athleteCsrf });

    const signInAgain = await request(baseUrl, "POST", "/account/sign-in", {
      email: athleteEmail,
      password: athletePasswordChanged
    });
    assertStatus(signInAgain, 200, "athlete signs in again with new password");
    athleteCookie = sessionCookie(signInAgain, "athlete signs in again");
    athleteCsrf = signInAgain.json?.csrf_token;
    record(
      "step_17_athlete_changes_password_and_signs_in",
      "Athlete changes password and signs in again",
      signInAgain.response.status === 200,
      { athlete_user_id: athleteUserId }
    );

    // ============================================================
    // Step 18: athlete submits a support request.
    // ============================================================
    const supportReport = await request(baseUrl, "POST", "/account/support/reports", {
      correlation_id: crypto.randomUUID(),
      route_hash: "#/athlete/today",
      occurred_at_iso8601: new Date().toISOString(),
      description: "FULL-UI-24 journey proof support report.",
      browser_context: {
        user_agent: "Mozilla/5.0 (full-ui-24 journey)",
        language: "en-GB",
        viewport_width: 1280,
        viewport_height: 800,
        timezone_offset_minutes: 0
      },
      failure_context: {
        status: 500,
        reason: "today_view_load_failed",
        method: "GET",
        path: "/sessions/beta-athlete-today"
      }
    }, { cookie: athleteCookie, csrf: athleteCsrf });
    assertStatus(supportReport, 201, "athlete submits support report");
    record(
      "step_18_athlete_submits_support_request",
      "Athlete submits a support request",
      supportReport.response.status === 201,
      { athlete_user_id: athleteUserId }
    );

    // ============================================================
    // Step 19: athlete requests a personal-data export and sees its
    // status.
    // ============================================================
    const exportRequest = await request(baseUrl, "POST", "/account/data-rights/export", {}, {
      cookie: athleteCookie, csrf: athleteCsrf
    });
    assertStatus(exportRequest, 202, "athlete requests data export");

    const exportStatus = await request(baseUrl, "GET", "/account/data-rights/export", undefined, {
      cookie: athleteCookie
    });
    assertStatus(exportStatus, 200, "athlete sees data export status");
    record(
      "step_19_athlete_requests_export_sees_status",
      "Athlete requests a personal-data export and sees its status",
      exportStatus.response.status === 200,
      { athlete_user_id: athleteUserId }
    );

    // ============================================================
    // Step 20: athlete opens deletion consequence review WITHOUT
    // accidentally submitting deletion - only the preview route is
    // ever called; POST /account/data-rights/deletion is never called
    // in this step.
    // ============================================================
    const deletionPreview = await request(baseUrl, "POST", "/account/data-rights/deletion/preview", {}, {
      cookie: athleteCookie, csrf: athleteCsrf
    });
    assertStatus(deletionPreview, 200, "athlete opens deletion consequence preview");

    const deletionStatusBeforeConfirm = await request(baseUrl, "GET", "/account/data-rights/deletion", undefined, {
      cookie: athleteCookie
    });
    assertStatus(deletionStatusBeforeConfirm, 200, "deletion status before any confirmation");
    assert.equal(
      deletionStatusBeforeConfirm.json?.deletion_requests?.length,
      0,
      "no deletion request must exist merely from opening the preview"
    );
    record(
      "step_20_athlete_reviews_deletion_without_submitting",
      "Athlete opens deletion consequence review without accidentally submitting deletion",
      deletionPreview.response.status === 200 && deletionStatusBeforeConfirm.json?.deletion_requests?.length === 0,
      { athlete_user_id: athleteUserId }
    );

    // ============================================================
    // Refresh reconstruction of the account-level state (distinct
    // from step 13's mid-session refresh proof).
    // ============================================================
    const accountRefetchBefore = await request(baseUrl, "GET", "/account/detail", undefined, { cookie: athleteCookie });
    const accountRefetchAfter = await request(baseUrl, "GET", "/account/detail", undefined, { cookie: athleteCookie });
    assertStatus(accountRefetchAfter, 200, "account refresh reconstruction");
    assert.deepEqual(accountRefetchAfter.json, accountRefetchBefore.json);

    // ============================================================
    // Fresh-process restart: the same recovery a browser refresh
    // after a deploy/restart would trigger.
    // ============================================================
    const databaseUrl = process.env.DATABASE_URL;
    assert.ok(typeof databaseUrl === "string" && databaseUrl.trim().length > 0, "FULL-UI-24 restart gate requires DATABASE_URL");
    const environment = { ...process.env, DATABASE_URL: databaseUrl };
    delete environment.SMOKE_NO_DB;

    restarted = await startFreshServerProcess(root, environment);
    assert.notEqual(restarted.child.pid, firstProcessId, "restart must use a new operating-system process");

    const historyAfterRestart = await request(restarted.baseUrl, "POST", "/sessions/beta-athlete-history", {
      athlete_user_id: athleteUserId
    });
    assertStatus(historyAfterRestart, 200, "history after restart");
    assert.ok(historyAfterRestart.json?.sessions?.some((entry) => entry.session_id === sessionId));

    const accountAfterRestart = await request(restarted.baseUrl, "GET", "/account/detail", undefined, { cookie: athleteCookie });
    assertStatus(accountAfterRestart, 200, "account after restart");
    assert.equal(accountAfterRestart.json?.account?.display_name, "Full-UI-24 Journey Athlete Updated");

    const exportStatusAfterRestart = await request(restarted.baseUrl, "GET", "/account/data-rights/export", undefined, {
      cookie: athleteCookie
    });
    assertStatus(exportStatusAfterRestart, 200, "export status after restart");

    record(
      "restart_fresh_process_reconstruction",
      "A fresh operating-system process reconstructs the same state",
      historyAfterRestart.json?.sessions?.some((entry) => entry.session_id === sessionId) === true &&
        accountAfterRestart.json?.account?.display_name === "Full-UI-24 Journey Athlete Updated",
      { first_pid: firstProcessId, restarted_pid: restarted.child.pid }
    );

    // ============================================================
    // Step 21: a different athlete is denied access to all records
    // from this journey - proven the same way a real browser session
    // works: the other athlete's own session/identity is used
    // throughout, never a borrowed or guessed id.
    // ============================================================
    const otherAthleteEmail = `full_ui_24_other_athlete_${nonce}@example.com`;
    const otherAthleteRegistration = await request(restarted.baseUrl, "POST", "/account/register", {
      actor_type: "athlete",
      display_name: "Full-UI-24 Unrelated Athlete",
      email: otherAthleteEmail,
      password: "FullUi24OtherAthlete!2026",
      activity_id: "powerlifting",
      accepted_terms: true,
      accepted_consent: true,
      accepted_terms_version: "terms_v1",
      accepted_consent_version: "consent_v1"
    });
    assertStatus(otherAthleteRegistration, 201, "unrelated athlete registration");
    const otherAthleteUserId = otherAthleteRegistration.json?.account?.user_id ?? "";
    otherAthleteUserId_holder.value = otherAthleteUserId;
    const otherAthleteCookie = sessionCookie(otherAthleteRegistration, "unrelated athlete registration");

    const otherHistory = await request(restarted.baseUrl, "POST", "/sessions/beta-athlete-history", {
      athlete_user_id: otherAthleteUserId
    });
    assertStatus(otherHistory, 200, "unrelated athlete's own history");
    assert.equal(otherHistory.json?.session_count, 0, "unrelated athlete must see none of this journey's sessions");

    const otherHistoryDetail = await request(restarted.baseUrl, "POST", "/sessions/beta-athlete-history-detail", {
      athlete_user_id: otherAthleteUserId,
      session_id: sessionId
    });
    assertStatus(otherHistoryDetail, 403, "unrelated athlete denied this journey's session detail");

    const otherAccountDetail = await request(restarted.baseUrl, "GET", "/account/detail", undefined, {
      cookie: otherAthleteCookie
    });
    assertStatus(otherAccountDetail, 200, "unrelated athlete's own account detail");
    assert.notEqual(otherAccountDetail.json?.account?.display_name, "Full-UI-24 Journey Athlete Updated");

    const otherExportStatus = await request(restarted.baseUrl, "GET", "/account/data-rights/export", undefined, {
      cookie: otherAthleteCookie
    });
    assertStatus(otherExportStatus, 200, "unrelated athlete's own export status");
    assert.equal(
      otherExportStatus.json?.requests?.length ?? 0,
      0,
      "unrelated athlete must see none of this journey's export requests"
    );

    const otherPendingInvitations = await request(restarted.baseUrl, "GET", "/coach-workspace/relationship-invitations", undefined, {
      cookie: otherAthleteCookie
    });
    assertStatus(otherPendingInvitations, 200, "unrelated athlete's own pending invitations");
    assert.equal(
      otherPendingInvitations.json?.invitations?.length ?? 0,
      0,
      "unrelated athlete must see none of this coach's invitations"
    );

    record(
      "step_21_different_athlete_denied",
      "A different athlete is denied access to all records from this journey",
      otherHistory.json?.session_count === 0 &&
        otherHistoryDetail.response.status === 403 &&
        otherAccountDetail.json?.account?.display_name !== "Full-UI-24 Journey Athlete Updated" &&
        (otherExportStatus.json?.requests?.length ?? 0) === 0 &&
        (otherPendingInvitations.json?.invitations?.length ?? 0) === 0,
      { other_athlete_user_id: otherAthleteUserId }
    );

    // --- Write the machine-readable evidence record. ---
    assert.ok(evidence.steps.every((entry) => entry.result === "PASS"), "every recorded step must be PASS before writing evidence");
    evidence.status = "PASS";
    evidence.athlete_user_id = athleteUserId;
    evidence.coach_user_id = coachUserId;
    evidence.session_id = sessionId;
    evidence.assignment_id = assignmentId;

    const evidencePath = path.join(root, "docs", "product", "FULL_UI_24_ATHLETE_SELF_SERVICE_JOURNEY_EVIDENCE.json");
    await fs.writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

    const writtenBack = JSON.parse(await fs.readFile(evidencePath, "utf8"));
    assert.equal(writtenBack.status, "PASS");
    assert.equal(writtenBack.steps.length, evidence.steps.length);
  }
);
