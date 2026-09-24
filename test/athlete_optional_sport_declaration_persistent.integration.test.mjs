// DEV NOTE: real-Postgres proof that sport declaration is genuinely
// optional/deferrable (slice 1 of the "make sport declaration optional"
// redesign). The critical behavior under test is NOT just "the request
// doesn't error" - it's that the beta16 compile-admission records
// (beta16_auth / beta16_acknowledgement / beta16_phase1_declaration in
// beta_product_records) are correctly deferred until a real activity is
// declared, since createBeta16Phase1DeclarationRecord's own sealed
// assertPhase1Input validator would otherwise reject a missing activity_id
// outright. See src/api/product_account_service.ts and
// src/api/athlete_onboarding_service.ts.
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

async function registerAccount(baseUrl, label, nonce, activityId) {
  const registration = await request(baseUrl, "POST", "/account/register", {
    actor_type: "athlete",
    display_name: label,
    email: `${label.toLowerCase().replaceAll(/[^a-z0-9]/gu, "_")}_${nonce}@example.com`,
    password: "OptionalSport!2026",
    activity_id: activityId,
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    accepted_consent_version: "consent_v1"
  });
  return registration;
}

function accessibilityPreferences() {
  return { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false };
}

async function getOnboardingState(baseUrl, athlete) {
  const result = await request(baseUrl, "GET", "/account/onboarding/", undefined, { cookie: athlete.cookie });
  assertStatus(result, 200, "get onboarding state");
  return result.json;
}

async function betaRecordTypes(userId) {
  const result = await pool.query(
    "SELECT DISTINCT record_type FROM beta_product_records WHERE subject_user_id = $1",
    [userId]
  );
  return result.rows.map((row) => row.record_type).sort();
}

test(
  "sport declaration is optional: registration and onboarding both succeed without one, beta16 compile-admission records are deferred, and the existing self-service activity-change flow declares it for the first time",
  async () => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    let server = null;
    const userIds = [];

    const cleanup = async () => {
      for (const userId of userIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_notifications WHERE recipient_user_id = $1", [userId]).catch(() => {});
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

      // --- 1. Registration with no activity succeeds. ---
      const registration = await registerAccount(baseUrl, "Optional Sport Athlete", nonce, null);
      assertStatus(registration, 201, "registration with no activity");
      const athlete = {
        userId: registration.json?.account?.user_id ?? "",
        cookie: sessionCookie(registration, "registration"),
        csrf: registration.json?.csrf_token
      };
      assert.ok(athlete.userId, "expected a registered user_id");
      assert.ok(athlete.csrf, "expected a csrf token");
      userIds.push(athlete.userId);

      // Only the non-activity-dependent beta16 records exist yet - the
      // phase1 declaration (the one that actually requires an activity_id)
      // is deferred.
      assert.deepEqual(await betaRecordTypes(athlete.userId), ["beta16_acknowledgement", "beta16_auth"]);

      // Registering with an empty string behaves identically to omitting it.
      const registrationEmptyString = await registerAccount(baseUrl, "Optional Sport Athlete Empty", nonce, "");
      assertStatus(registrationEmptyString, 201, "registration with an empty-string activity");
      userIds.push(registrationEmptyString.json?.account?.user_id ?? "");

      // A non-empty but unsupported activity is still rejected.
      const badRegistration = await registerAccount(baseUrl, "Bad Activity Athlete", nonce, "not_a_real_sport");
      assertStatus(badRegistration, 400, "registration with an invalid activity");
      assert.equal(badRegistration.json?.error, "account_activity_invalid");

      // --- 2. Completing onboarding without declaring an activity succeeds. ---
      const draft = await request(
        baseUrl, "PATCH", "/account/onboarding/draft",
        {
          current_stage: "review",
          fields: {
            execution_scope: "individual",
            product_acknowledged: true,
            jurisdiction_code: "england_wales",
            jurisdiction_acknowledged: true,
            accessibility_preferences: accessibilityPreferences(),
            instruction_density: "standard"
          }
        },
        { cookie: athlete.cookie, csrf: athlete.csrf }
      );
      assertStatus(draft, 200, "onboarding draft without activity_id");

      const confirm = await request(
        baseUrl, "POST", "/account/onboarding/confirm",
        { review_confirmed: true },
        { cookie: athlete.cookie, csrf: athlete.csrf }
      );
      assertStatus(confirm, 200, "onboarding confirm without activity_id");
      assert.equal(confirm.json.onboarding_status, "completed");
      assert.equal(
        Object.prototype.hasOwnProperty.call(confirm.json.current_effective_declaration.fields, "activity_id"),
        false,
        "activity_id must be absent, not defaulted to anything"
      );

      // Onboarding completion still doesn't create the phase1 declaration -
      // it stays deferred until a real activity is declared.
      assert.deepEqual(await betaRecordTypes(athlete.userId), ["beta16_acknowledgement", "beta16_auth"]);

      const state = await getOnboardingState(baseUrl, athlete);
      assert.equal(state.onboarding_status, "completed");
      assert.equal(
        Object.prototype.hasOwnProperty.call(state.current_effective_declaration.fields, "activity_id"),
        false
      );

      // --- 3. The existing self-service activity-change flow declares a real activity for the first time. ---
      const declare = await request(
        baseUrl, "PATCH", "/account/onboarding/activity",
        { new_activity_id: "crossfit", apply_at: "immediately" },
        { cookie: athlete.cookie, csrf: athlete.csrf }
      );
      assertStatus(declare, 200, "first-time self-service activity declaration");
      assert.equal(declare.json.request_state, "applied");

      const afterDeclare = await getOnboardingState(baseUrl, athlete);
      assert.equal(afterDeclare.current_effective_declaration.fields.activity_id, "crossfit");
      assert.equal(afterDeclare.current_effective_declaration.declaration_version, 2);

      // The beta16 compile-admission records now exist, for the first time
      // (plus the activity_change_request record the self-service flow
      // itself writes).
      assert.deepEqual(
        await betaRecordTypes(athlete.userId),
        ["athlete_activity_change_request", "beta16_acknowledgement", "beta16_auth", "beta16_phase1_declaration"]
      );

      // --- 4. Fresh-process recovery. ---
      await closeServer(server);
      server = await listen();
      address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;

      const restarted = await getOnboardingState(baseUrl, athlete);
      assert.equal(restarted.current_effective_declaration.fields.activity_id, "crossfit");
    }
    finally {
      await closeServer(server);
      await cleanup();
    }
  }
);
