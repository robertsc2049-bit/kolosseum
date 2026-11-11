// /blocks and coach review/assignment access (src/api/coach_and_blocks_access
// _gate.ts) against a real database: these took an athlete's or coach's user
// id from the request and trusted it with no sign-in - anyone could create
// sessions owned by any athlete, read any coach's reviews, or replace and
// cancel an athlete's programme naming any coach. Now the named athlete or
// coach must be the signed-in account, with the CSRF header for changes.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";

delete process.env.KOLOSSEUM_SESSIONS_TEST_HARNESS;

test.after(() => pool.end());

async function listen() {
  return await new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function call(baseUrl, method, route, { cookie, csrf, body } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  if (csrf) headers["x-kolosseum-csrf"] = csrf;
  const response = await fetch(`${baseUrl}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  return { status: response.status, json, text, response };
}

async function register(baseUrl, actorType) {
  const tag = crypto.randomUUID().slice(0, 8);
  const result = await call(baseUrl, "POST", "/account/register", {
    body: {
      email: `gate.${actorType}.${tag}@example.test`,
      password: "gate-test-password-123",
      actor_type: actorType,
      display_name: `Gate ${actorType} ${tag}`,
      ...(actorType === "athlete" ? { activity_id: "powerlifting" } : {}),
      accepted_terms: true,
      accepted_consent: true,
      accepted_terms_version: "terms_v1",
      accepted_consent_version: "consent_v1",
      date_of_birth: "1990-01-01",
      age_confirmed: true
    }
  });
  assert.equal(result.status, 201, `register ${actorType}: ${result.text}`);
  const setCookie = result.response.headers.getSetCookie().find((value) => value.startsWith("kolosseum_"));
  assert.ok(setCookie, "session cookie");
  const cookie = setCookie.split(";")[0];
  const detail = await call(baseUrl, "GET", "/account/detail", { cookie });
  return { userId: result.json.account.user_id, cookie, csrf: detail.json.csrf_token };
}

test("compile, blocks, reviews and assignments need the named athlete or coach signed in", { timeout: 60000 }, async (t) => {
  const server = await listen();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const created = [];
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query(`DELETE FROM sessions WHERE session_id = ANY($1)`, [created]);
    await pool.query(`DELETE FROM blocks WHERE block_id = ANY($1)`, [created]);
  });

  const athlete = await register(baseUrl, "athlete");
  const stranger = await register(baseUrl, "athlete");
  const coach = await register(baseUrl, "coach");
  const notGate = (result, label) => {
    assert.notEqual(result.status, 401, `${label}: ${result.text}`);
    assert.ok(!/identity_mismatch|block_not_yours|compile_athlete_required/u.test(result.text), `${label}: ${result.text}`);
  };

  // Compile naming an athlete: that athlete, signed in, with CSRF.
  const compile = { phase1_input: {}, beta_user_id: athlete.userId, beta_coach_user_id: coach.userId };
  const compileRoute = "/blocks/compile?create_session=true&beta_path=true";
  assert.equal((await call(baseUrl, "POST", compileRoute, { body: compile })).status, 401, "no sign-in");
  assert.equal((await call(baseUrl, "POST", compileRoute, { cookie: stranger.cookie, csrf: stranger.csrf, body: compile })).status, 403, "someone else");
  assert.equal((await call(baseUrl, "POST", compileRoute, { cookie: athlete.cookie, body: compile })).status, 403, "CSRF needed");
  assert.equal((await call(baseUrl, "POST", compileRoute, { cookie: coach.cookie, csrf: coach.csrf, body: compile })).status, 403, "a coach can't compile as their athlete");
  const selfContext = { phase1_input: {}, beta_path_context: { auth_record: { user_id: athlete.userId } } };
  assert.equal((await call(baseUrl, "POST", compileRoute, { cookie: stranger.cookie, csrf: stranger.csrf, body: selfContext })).status, 403, "a self-coached compile for someone else");
  notGate(await call(baseUrl, "POST", compileRoute, { cookie: athlete.cookie, csrf: athlete.csrf, body: compile }), "the athlete themselves");
  notGate(await call(baseUrl, "POST", "/blocks/compile", { body: { phase1_input: {} } }), "an anonymous engine compile stays open");

  // A block with someone's session in it is theirs (or their coach's).
  const blockId = `gate_block_${crypto.randomUUID()}`;
  const sessionId = `gate_s_${crypto.randomUUID()}`;
  created.push(blockId, sessionId);
  await pool.query(
    `INSERT INTO blocks (block_id, engine_version, canonical_hash, phase1_input, phase2_canonical, phase3_output, phase4_program)
     VALUES ($1, 'test', $2, '{}', '{}', '{}', '{}')`, [blockId, crypto.randomUUID()]);
  await pool.query(
    `INSERT INTO sessions (session_id, block_id, planned_session, beta_subject_user_id, beta_coach_user_id) VALUES ($1, $2, '{"exercises":[]}', $3, $4)`,
    [sessionId, blockId, athlete.userId, coach.userId]);
  for (const route of [`/blocks/${blockId}`, `/blocks/${blockId}/sessions`]) {
    assert.equal((await call(baseUrl, "GET", route)).status, 401, `${route} without sign-in`);
    assert.equal((await call(baseUrl, "GET", route, { cookie: stranger.cookie })).status, 403, `${route} as someone else`);
    notGate(await call(baseUrl, "GET", route, { cookie: athlete.cookie }), `${route} as the athlete`);
    notGate(await call(baseUrl, "GET", route, { cookie: coach.cookie }), `${route} as their coach`);
  }
  assert.equal((await call(baseUrl, "POST", `/blocks/${blockId}/sessions`, { cookie: stranger.cookie, csrf: stranger.csrf, body: {} })).status, 403);

  // Reviews and assignment changes name the signed-in coach.
  const reviews = `/coach-workspace/reviews?coach_user_id=${encodeURIComponent(coach.userId)}`;
  assert.equal((await call(baseUrl, "GET", reviews)).status, 401);
  assert.equal((await call(baseUrl, "GET", reviews, { cookie: stranger.cookie })).status, 403, "another account reading this coach's reviews");
  const ownReviews = await call(baseUrl, "GET", reviews, { cookie: coach.cookie });
  assert.equal(ownReviews.status, 200, ownReviews.text);
  for (const route of [`/coach-workspace/session-review/${sessionId}`, "/coach-workspace/athlete-assignment/assign_x/replace", "/coach-workspace/athlete-assignment/assign_x/cancel"]) {
    const change = { coach_user_id: coach.userId, athlete_user_id: athlete.userId };
    assert.equal((await call(baseUrl, "POST", route, { body: change })).status, 401, `${route} without sign-in`);
    assert.equal((await call(baseUrl, "POST", route, { cookie: stranger.cookie, csrf: stranger.csrf, body: change })).status, 403, `${route} naming another coach`);
    assert.equal((await call(baseUrl, "POST", route, { cookie: coach.cookie, body: change })).status, 403, `${route} without CSRF`);
    notGate(await call(baseUrl, "POST", route, { cookie: coach.cookie, csrf: coach.csrf, body: change }), `${route} as the coach`);
  }
});
