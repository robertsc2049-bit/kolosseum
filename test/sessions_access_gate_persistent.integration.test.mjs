// /sessions access gate (src/api/sessions_access_gate.ts) against a real
// database: before it, anyone holding an athlete's user id could read their
// training history, and anyone holding a session id could read it and write
// events into it, with no sign-in. Now the caller is always the signed-in
// account, changes need the CSRF header, the early harness routes are not
// served, and a coach can only invite - never record an accepted connection.
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

test("session routes are the signed-in owner's only, and a coach can only invite", { timeout: 60000 }, async (t) => {
  const server = await listen();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const created = [];
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    for (const sql of [`DELETE FROM sessions WHERE session_id = ANY($1)`, `DELETE FROM blocks WHERE block_id = ANY($1)`]) {
      await pool.query(sql, [created]);
    }
  });

  const owner = await register(baseUrl, "athlete");
  const stranger = await register(baseUrl, "athlete");
  const coach = await register(baseUrl, "coach");

  // An owned session and an anonymous engine session (no owner).
  const blockId = `gate_block_${crypto.randomUUID()}`;
  const ownedId = `gate_s_${crypto.randomUUID()}`;
  const anonymousId = `gate_s_${crypto.randomUUID()}`;
  created.push(blockId, ownedId, anonymousId);
  await pool.query(
    `INSERT INTO blocks (block_id, engine_version, canonical_hash, phase1_input, phase2_canonical, phase3_output, phase4_program)
     VALUES ($1, 'test', $2, '{}', '{}', '{}', '{}')`, [blockId, crypto.randomUUID()]);
  await pool.query(
    `INSERT INTO sessions (session_id, block_id, planned_session, beta_subject_user_id) VALUES ($1, $3, $5::jsonb, $2), ($4, $3, $5::jsonb, NULL)`,
    [ownedId, owner.userId, blockId, anonymousId, JSON.stringify({ exercises: [{ exercise_id: "back_squat", sets: 3, reps: 5 }] })]);
  const eventCount = async () => Number((await pool.query(`SELECT count(*) FROM runtime_events WHERE session_id = $1`, [ownedId])).rows[0].count);

  // A session's own routes: no cookie 401, someone else 403, wrong-CSRF write 403.
  for (const route of [`/sessions/${ownedId}/state`, `/sessions/${ownedId}/events`, `/sessions/${ownedId}/summary`]) {
    assert.equal((await call(baseUrl, "GET", route)).status, 401, `${route} without sign-in`);
    assert.equal((await call(baseUrl, "GET", route, { cookie: stranger.cookie })).status, 403, `${route} as another athlete`);
  }
  const before = await eventCount();
  assert.equal((await call(baseUrl, "POST", `/sessions/${ownedId}/events`, { body: { type: "NOOP_PROBE" } })).status, 401);
  assert.equal((await call(baseUrl, "POST", `/sessions/${ownedId}/events`, { cookie: stranger.cookie, csrf: stranger.csrf, body: { type: "NOOP_PROBE" } })).status, 403);
  assert.equal((await call(baseUrl, "POST", `/sessions/${ownedId}/events`, { cookie: owner.cookie, body: { type: "NOOP_PROBE" } })).status, 403, "the owner still needs the CSRF header to write");
  assert.equal((await call(baseUrl, "POST", `/sessions/${ownedId}/start`, { cookie: stranger.cookie, csrf: stranger.csrf, body: {} })).status, 403);
  assert.equal(await eventCount(), before, "nothing was written");
  const ownRead = await call(baseUrl, "GET", `/sessions/${ownedId}/state`, { cookie: owner.cookie });
  assert.notEqual(ownRead.status, 401);
  assert.notEqual(ownRead.status, 403, "the owner gets past the gate");

  // An anonymous engine session holds nothing personal and stays open.
  assert.notEqual((await call(baseUrl, "GET", `/sessions/${anonymousId}/state`)).status, 401);

  // Athlete reads are the athlete's own.
  for (const route of ["/sessions/beta-athlete-today", "/sessions/beta-athlete-history", "/sessions/beta-athlete-history-export"]) {
    assert.equal((await call(baseUrl, "POST", route, { body: { athlete_user_id: owner.userId } })).status, 401, `${route} without sign-in`);
    assert.equal((await call(baseUrl, "POST", route, { cookie: stranger.cookie, body: { athlete_user_id: owner.userId } })).status, 403, `${route} for someone else`);
  }
  const ownHistory = await call(baseUrl, "POST", "/sessions/beta-athlete-history", { cookie: owner.cookie, body: { athlete_user_id: owner.userId } });
  assert.equal(ownHistory.status, 200, ownHistory.text);

  // The early harness routes aren't served.
  for (const route of ["/sessions/beta-auth", "/sessions/beta-declaration", "/sessions/beta-acknowledgement", "/sessions/beta-coach-profile", "/sessions/beta-coach-assignment", "/sessions/plan"]) {
    assert.equal((await call(baseUrl, "POST", route, { cookie: owner.cookie, csrf: owner.csrf, body: { user_id: owner.userId } })).status, 404, route);
  }
  assert.equal((await call(baseUrl, "GET", "/sessions/decision-summary/run_x")).status, 404);

  // A coach can only invite, as themselves - never record an accepted connection.
  const now = new Date().toISOString();
  const relationship = (state, coachUserId = coach.userId) => ({
    relationship_id: `gate_rel_${crypto.randomUUID()}`, coach_user_id: coachUserId, athlete_user_id: owner.userId,
    relationship_state: state, relationship_scope: "individual_coach_athlete",
    accepted_at_iso8601: state === "accepted" ? now : null, created_at_iso8601: now, updated_at_iso8601: now,
    revoked_at_iso8601: null, expires_at_iso8601: null
  });
  assert.equal((await call(baseUrl, "POST", "/sessions/beta-coach-relationship", { body: relationship("invited") })).status, 401);
  assert.equal((await call(baseUrl, "POST", "/sessions/beta-coach-relationship", { cookie: coach.cookie, csrf: coach.csrf, body: relationship("accepted") })).status, 403, "a coach can't mark a connection accepted");
  assert.equal((await call(baseUrl, "POST", "/sessions/beta-coach-relationship", { cookie: coach.cookie, csrf: coach.csrf, body: relationship("declined") })).status, 403);
  assert.equal((await call(baseUrl, "POST", "/sessions/beta-coach-relationship", { cookie: stranger.cookie, csrf: stranger.csrf, body: relationship("invited") })).status, 403, "only as yourself");
  assert.equal((await call(baseUrl, "POST", "/sessions/beta-coach-relationship", { cookie: coach.cookie, body: relationship("invited") })).status, 403, "CSRF needed");
  const invitation = relationship("invited");
  const invited = await call(baseUrl, "POST", "/sessions/beta-coach-relationship", { cookie: coach.cookie, csrf: coach.csrf, body: invitation });
  assert.ok(invited.status < 400, invited.text);

  // Coach notes need an accepted relationship - an invitation isn't enough.
  const noteBody = { coach_profile: { coach_user_id: coach.userId }, relationship: { coach_user_id: coach.userId }, athlete_user_id: owner.userId, session_id: ownedId };
  const early = await call(baseUrl, "POST", "/sessions/beta-coach-notes", { cookie: coach.cookie, csrf: coach.csrf, body: noteBody });
  assert.equal(early.status, 403, early.text);
  assert.equal(early.json?.details?.failure_token ?? early.json?.failure_token, "sessions_coach_relationship_required", early.text);

  // The athlete sees the invitation and accepts it themselves.
  const pending = await call(baseUrl, "GET", "/coach-workspace/relationship-invitations", { cookie: owner.cookie });
  assert.equal(pending.status, 200, pending.text);
  assert.ok(pending.text.includes(invitation.relationship_id), "the athlete sees the invitation to accept");
  const accepted = await call(baseUrl, "POST", `/coach-workspace/relationship-invitations/${invitation.relationship_id}/accept`, { cookie: owner.cookie, csrf: owner.csrf, body: {} });
  assert.ok(accepted.status < 400, accepted.text);
  const later = await call(baseUrl, "POST", "/sessions/beta-coach-notes", { cookie: coach.cookie, csrf: coach.csrf, body: noteBody });
  assert.notEqual(later.json?.details?.failure_token ?? later.json?.failure_token, "sessions_coach_relationship_required", later.text);
});
