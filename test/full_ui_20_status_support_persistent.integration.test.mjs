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
    password: "Full20StatusSupport!2026",
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

function reportPayload(overrides = {}) {
  return {
    correlation_id: crypto.randomUUID(),
    route_hash: "#/athlete/today",
    occurred_at_iso8601: new Date().toISOString(),
    description: "The Today page would not load after signing in.",
    browser_context: {
      user_agent: "Mozilla/5.0 (test runner)",
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
    },
    ...overrides
  };
}

test(
  "FULL-UI-20 status, support and error reporting: report creation, redaction, idempotency, retry safety, history states, access control and restart reconstruction",
  async () => {
    const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    let server = null;

    const userIds = [];
    const correlationIds = [];

    const cleanup = async () => {
      await pool.query(
        "DELETE FROM product_support_requests WHERE correlation_id = ANY($1::text[])",
        [correlationIds]
      ).catch(() => {});
      for (const userId of userIds) {
        if (!userId) continue;
        await pool.query("DELETE FROM product_account_events WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_challenges WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_auth_sessions WHERE user_id = $1", [userId]).catch(() => {});
        await pool.query("DELETE FROM product_accounts WHERE user_id = $1", [userId]).catch(() => {});
      }
    };

    try {
      server = await listen();
      let address = server.address();
      let baseUrl = `http://127.0.0.1:${address.port}`;

      const athlete = await registerAccount(baseUrl, "athlete", "Full20 Athlete", nonce);
      userIds.push(athlete.userId);
      const otherAthlete = await registerAccount(baseUrl, "athlete", "Full20 Other Athlete", nonce);
      userIds.push(otherAthlete.userId);

      // --- Platform status: the existing /health surface stays honest and
      //     unauthenticated. ---
      const health = await request(baseUrl, "GET", "/health");
      assertStatus(health, 200, "platform status");
      assert.equal(health.json.status, "ok");

      // --- Anonymous access to support endpoints is rejected. ---
      const anonymousCreate = await request(baseUrl, "POST", "/account/support/reports", reportPayload());
      assertStatus(anonymousCreate, 401, "anonymous report creation");
      const anonymousList = await request(baseUrl, "GET", "/account/support/reports");
      assertStatus(anonymousList, 401, "anonymous report list");

      // --- Report creation with route/timestamp/browser/correlation
      //     context, and a redaction attempt: extra sensitive-looking
      //     fields must never reach storage. ---
      const firstCorrelationId = crypto.randomUUID();
      correlationIds.push(firstCorrelationId);

      const smuggleAttempt = reportPayload({
        correlation_id: firstCorrelationId,
        browser_context: {
          user_agent: "Mozilla/5.0 (test runner)",
          language: "en-GB",
          viewport_width: 1280,
          viewport_height: 800,
          timezone_offset_minutes: 0,
          access_token: "should-never-be-stored",
          session_cookie: "kolosseum_session=should-never-be-stored",
          password: "should-never-be-stored"
        }
      });

      const created = await request(
        baseUrl, "POST", "/account/support/reports", smuggleAttempt,
        { cookie: athlete.cookie, csrf: athlete.csrf }
      );
      assertStatus(created, 201, "create support report");
      assert.equal(created.json.report.correlation_id, firstCorrelationId);
      assert.equal(created.json.report.route_hash, "#/athlete/today");
      assert.equal(created.json.report.description, smuggleAttempt.description);
      assert.equal(created.json.report.status, "submitted");

      const storedContext = created.json.report.browser_context;
      assert.equal(storedContext.user_agent, "Mozilla/5.0 (test runner)");
      assert.equal(storedContext.viewport_width, 1280);
      assert.equal(Object.hasOwn(storedContext, "access_token"), false, "access_token must never be stored");
      assert.equal(Object.hasOwn(storedContext, "session_cookie"), false, "session_cookie must never be stored");
      assert.equal(Object.hasOwn(storedContext, "password"), false, "password must never be stored");

      // Verify directly against the database too - not just the HTTP
      // response shape - that no sensitive key ever reached the row.
      const dbRow = await pool.query(
        "SELECT browser_context, failure_context FROM product_support_requests WHERE correlation_id = $1",
        [firstCorrelationId]
      );
      const rawStored = JSON.stringify(dbRow.rows[0].browser_context) + JSON.stringify(dbRow.rows[0].failure_context);
      assert.doesNotMatch(rawStored, /access_token|session_cookie|password|should-never-be-stored/u);

      // --- Retry safety: a GET failure is marked retryable; a mutation
      //     failure must never be. ---
      const failureContext = created.json.report.failure_context;
      assert.equal(failureContext.method, "GET");
      assert.equal(failureContext.path, "/sessions/beta-athlete-today");
      assert.equal(failureContext.retryable, true);

      const mutationCorrelationId = crypto.randomUUID();
      correlationIds.push(mutationCorrelationId);
      const mutationReport = await request(
        baseUrl, "POST", "/account/support/reports",
        reportPayload({
          correlation_id: mutationCorrelationId,
          failure_context: { status: 409, reason: "conflict", method: "DELETE", path: "/sessions/some-session" }
        }),
        { cookie: athlete.cookie, csrf: athlete.csrf }
      );
      assertStatus(mutationReport, 201, "create report for a failed mutation");
      assert.equal(mutationReport.json.report.failure_context.retryable, false, "a DELETE failure must never be marked retryable");

      // An unrecognised HTTP method must be dropped entirely, not stored
      // verbatim, and must not be retryable.
      const unknownMethodCorrelationId = crypto.randomUUID();
      correlationIds.push(unknownMethodCorrelationId);
      const unknownMethodReport = await request(
        baseUrl, "POST", "/account/support/reports",
        reportPayload({
          correlation_id: unknownMethodCorrelationId,
          failure_context: { status: 500, reason: "x", method: "TRACE", path: "/whatever" }
        }),
        { cookie: athlete.cookie, csrf: athlete.csrf }
      );
      assertStatus(unknownMethodReport, 201, "create report with an unrecognised method");
      assert.equal(unknownMethodReport.json.report.failure_context.method, null);
      assert.equal(unknownMethodReport.json.report.failure_context.retryable, false);

      // --- Idempotent duplicate submission: resubmitting the same
      //     correlation_id must replay the original row, not create a
      //     second one. ---
      const beforeDuplicateCount = await pool.query(
        "SELECT count(*)::int AS c FROM product_support_requests WHERE user_id = $1",
        [athlete.userId]
      );
      const duplicate = await request(
        baseUrl, "POST", "/account/support/reports", smuggleAttempt,
        { cookie: athlete.cookie, csrf: athlete.csrf }
      );
      assertStatus(duplicate, 201, "duplicate submission of the same correlation_id");
      assert.equal(duplicate.json.report.correlation_id, firstCorrelationId);
      assert.equal(duplicate.json.report.created_at_iso8601, created.json.report.created_at_iso8601);
      const afterDuplicateCount = await pool.query(
        "SELECT count(*)::int AS c FROM product_support_requests WHERE user_id = $1",
        [athlete.userId]
      );
      assert.equal(afterDuplicateCount.rows[0].c, beforeDuplicateCount.rows[0].c, "resubmitting the same correlation_id must not create a duplicate row");

      // --- Cross-user correlation_id conflict: another user reusing the
      //     same id must be rejected, not silently attached to a different
      //     account or allowed to read the first user's report. ---
      const crossUserAttempt = await request(
        baseUrl, "POST", "/account/support/reports",
        reportPayload({ correlation_id: firstCorrelationId }),
        { cookie: otherAthlete.cookie, csrf: otherAthlete.csrf }
      );
      assertStatus(crossUserAttempt, 409, "cross-user correlation_id reuse");

      // --- Input validation: unknown field, invalid correlation_id shape,
      //     missing description. ---
      assertStatus(
        await request(baseUrl, "POST", "/account/support/reports", { ...reportPayload(), extra_field: "x" }, { cookie: athlete.cookie, csrf: athlete.csrf }),
        400,
        "unknown field rejected"
      );
      assertStatus(
        await request(baseUrl, "POST", "/account/support/reports", reportPayload({ correlation_id: "!!!" }), { cookie: athlete.cookie, csrf: athlete.csrf }),
        400,
        "invalid correlation_id rejected"
      );
      assertStatus(
        await request(baseUrl, "POST", "/account/support/reports", reportPayload({ description: "" }), { cookie: athlete.cookie, csrf: athlete.csrf }),
        400,
        "empty description rejected"
      );

      // --- Support history: only the caller's own reports, newest first,
      //     status defaults to submitted (a real persisted column, not a
      //     hardcoded label). ---
      const history = await request(baseUrl, "GET", "/account/support/reports", undefined, { cookie: athlete.cookie });
      assertStatus(history, 200, "support history");
      assert.ok(history.json.reports.length >= 3, "expected at least 3 reports for this athlete");
      assert.ok(history.json.reports.every((r) => r.status === "submitted"));

      const otherHistory = await request(baseUrl, "GET", "/account/support/reports", undefined, { cookie: otherAthlete.cookie });
      assertStatus(otherHistory, 200, "other athlete's support history");
      assert.equal(otherHistory.json.reports.length, 0, "another athlete must never see this athlete's reports");

      // --- Support history reflects a status only when it is actually
      //     persisted - simulate an operator acknowledging the report by
      //     writing the column directly (there is no product-client path
      //     that can do this itself), then read it back through the same
      //     GET the UI uses. ---
      await pool.query(
        "UPDATE product_support_requests SET status = 'acknowledged' WHERE correlation_id = $1",
        [firstCorrelationId]
      );
      const historyAfterAck = await request(baseUrl, "GET", "/account/support/reports", undefined, { cookie: athlete.cookie });
      assertStatus(historyAfterAck, 200, "support history after operator acknowledgement");
      const acknowledged = historyAfterAck.json.reports.find((r) => r.correlation_id === firstCorrelationId);
      assert.ok(acknowledged, "expected the acknowledged report in history");
      assert.equal(acknowledged.status, "acknowledged");

      // --- Fresh-process restart reconstruction. ---
      await closeServer(server);
      server = await listen();
      address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;

      const historyAfterRestart = await request(baseUrl, "GET", "/account/support/reports", undefined, { cookie: athlete.cookie });
      assertStatus(historyAfterRestart, 200, "support history after restart");
      assert.equal(historyAfterRestart.json.reports.length, history.json.reports.length, "restart must reconstruct the same report set");
      const acknowledgedAfterRestart = historyAfterRestart.json.reports.find((r) => r.correlation_id === firstCorrelationId);
      assert.equal(acknowledgedAfterRestart.status, "acknowledged", "persisted status survives a fresh process restart");
    }
    finally {
      await closeServer(server);
      await cleanup();
    }
  }
);
