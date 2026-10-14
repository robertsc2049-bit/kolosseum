// A coach sees the sessions an athlete runs on their own (no coach
// assignment) in the review queue, and can mark them reviewed - but only the
// ones recorded since the athlete accepted that coach, only while the
// relationship is accepted, and never another athlete's
// (src/api/product_review.routes.ts).
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

async function request(baseUrl, method, route, body, options = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;
  const response = await fetch(`${baseUrl}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json };
}

function sessionCookie(result) {
  const values = result.response.headers.getSetCookie();
  return String(values.find((value) => value.startsWith("kolosseum_session="))).split(";")[0];
}

function assertStatus(result, status, label) {
  assert.equal(result.response.status, status, `${label}: expected ${status}, received ${result.response.status}. raw=${result.text}`);
}

async function register(baseUrl, actorType, label, nonce) {
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: actorType, display_name: `Self Directed ${label}`, email: `self_directed_${label}_${nonce}@example.com`, password: `SelfDirected${label}!2026`,
    ...(actorType === "athlete" ? { activity_id: "powerlifting" } : {}),
    accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", date_of_birth: "1990-01-15"
  });
  assertStatus(result, 201, `${label} registration`);
  return { userId: result.json.account.user_id, auth: { cookie: sessionCookie(result), csrf: result.json.csrf_token } };
}

test("a coach reviews the sessions an athlete ran on her own since accepting him - not earlier ones, not another athlete's, and not once she ends it", { timeout: 120000 }, async (testContext) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  const server = await listen();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const coach = await register(baseUrl, "coach", "Coach", nonce);
  const athlete = await register(baseUrl, "athlete", "Lifter", nonce);
  const stranger = await register(baseUrl, "athlete", "Stranger", nonce);
  const userIds = [coach.userId, athlete.userId, stranger.userId];
  const blockId = `self_directed_block_${nonce}`;
  testContext.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query("DELETE FROM product_session_reviews WHERE actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.query("DELETE FROM blocks WHERE block_id = $1", [blockId]).catch(() => {});
    for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = ANY($1::text[])`, [userIds]).catch(() => {});
    await pool.query("DELETE FROM beta_product_records WHERE subject_user_id = ANY($1::text[]) OR actor_user_id = ANY($1::text[])", [userIds]).catch(() => {});
    await pool.end();
  });

  const accepted = new Date(Date.now() - 2 * 86400000);
  const relationship = (state, at) => request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: `self_directed_relationship_${nonce}`, coach_user_id: coach.userId, athlete_user_id: athlete.userId,
    relationship_state: state, relationship_scope: "individual_coach_athlete", accepted_at_iso8601: accepted.toISOString(), created_at_iso8601: accepted.toISOString(),
    updated_at_iso8601: at.toISOString(), revoked_at_iso8601: state === "revoked" ? at.toISOString() : null, expires_at_iso8601: null
  });
  assertStatus(await relationship("accepted", accepted), 201, "relationship");

  // Her own sessions: one the week before she accepted him, one since; and
  // another athlete's. All completed, none with a coach on them.
  await pool.query(
    `INSERT INTO blocks (block_id, engine_version, canonical_hash, phase1_input, phase2_canonical, phase3_output, phase4_program)
     VALUES ($1, 'test', $1, '{}', '{}', '{}', '{}')`, [blockId]);
  const session = async (name, subject, daysAgo) => {
    const id = `self_directed_${name}_${nonce}`;
    await pool.query(
      `INSERT INTO sessions (session_id, block_id, status, planned_session, beta_subject_user_id, created_at, updated_at)
       VALUES ($1, $2, 'completed', $3, $4, now() - make_interval(days => $5), now() - make_interval(days => $5))`,
      [id, blockId, { title: `Own ${name} session`, exercises: [{ exercise_id: "back_squat" }] }, subject, daysAgo]);
    return id;
  };
  const before = await session("before", athlete.userId, 7);
  const since = await session("since", athlete.userId, 1);
  const theirs = await session("stranger", stranger.userId, 1);

  const list = async (query = "") => {
    const result = await request(baseUrl, "GET", `/coach-workspace/reviews?coach_user_id=${encodeURIComponent(coach.userId)}${query}`, undefined, coach.auth);
    assertStatus(result, 200, "review list");
    return result.json.records;
  };
  for (const records of [await list(), await list(`&athlete_user_id=${encodeURIComponent(athlete.userId)}`)]) {
    const ids = records.map((record) => record.session_id);
    assert.ok(ids.includes(since), "the session she ran since accepting him is in his queue");
    assert.ok(!ids.includes(before), "the one from before she accepted him stays private");
    assert.ok(!ids.includes(theirs), "another athlete's own session never shows");
    const record = records.find((r) => r.session_id === since);
    assert.deepEqual([record.self_directed, record.assignment_id, record.awaiting_review, record.session_title], [true, null, true, "Own since session"]);
  }

  const mark = (sessionId) => request(baseUrl, "POST", `/coach-workspace/session-review/${encodeURIComponent(sessionId)}`, {
    request_id: `self_directed_review_${sessionId}`, requested_at_iso8601: new Date().toISOString(), coach_user_id: coach.userId,
    athlete_user_id: athlete.userId, artefact_id: `beta_e2e_artefact_${sessionId}`, review_status: "reviewed"
  }, coach.auth);
  assertStatus(await mark(since), 201, "mark her own session reviewed");
  assert.equal((await list()).find((r) => r.session_id === since).review_status, "reviewed");
  assertStatus(await mark(before), 403, "the session from before she accepted him can't be reviewed");

  // She ends it: her sessions leave his queue.
  assertStatus(await relationship("revoked", new Date()), 201, "relationship ended");
  assert.ok(!(await list()).some((r) => r.session_id === since), "gone once she ends the relationship");
});
