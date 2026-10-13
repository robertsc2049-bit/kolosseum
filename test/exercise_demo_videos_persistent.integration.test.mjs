// Exercise demo videos against the real database: a strength coach sets their
// own back squat demo - their athlete sees it, another coach's athlete sees
// the platform default, and removing it falls back to the default.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";
import { removeExerciseDemoVideo, setExerciseDemoVideo } from "../dist/src/api/exercise_demo_video_service.js";

async function request(baseUrl, method, route, body, options = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;
  const response = await fetch(`${baseUrl}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: response.status, text, json, response };
}

async function register(baseUrl, actorType, label, nonce) {
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: actorType, display_name: label,
    email: `demo_${label.toLowerCase()}_${nonce}@example.com`, password: "DemoVideos!2026",
    activity_id: "powerlifting", accepted_terms: true, accepted_consent: true,
    accepted_terms_version: "terms_v1", date_of_birth: "1994-08-20", accepted_consent_version: "consent_v1"
  });
  assert.equal(result.status, 201, result.text);
  const cookie = result.response.headers.getSetCookie().find((v) => v.startsWith("kolosseum_session=")).split(";")[0];
  return { userId: result.json.account.user_id, cookie, csrf: result.json.csrf_token };
}

async function relate(baseUrl, coach, athlete, nonce) {
  const now = new Date().toISOString();
  const result = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: `rel_demo_${nonce}_${athlete.userId.slice(-6)}`, coach_user_id: coach.userId, athlete_user_id: athlete.userId,
    relationship_state: "accepted", relationship_scope: "individual_coach_athlete", accepted_at_iso8601: now,
    created_at_iso8601: now, updated_at_iso8601: now, revoked_at_iso8601: null, expires_at_iso8601: null
  });
  assert.ok(result.status < 300, result.text);
}

test("a coach's own squat demo reaches their athlete; everyone else sees the platform default", { timeout: 120_000 }, async () => {
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const nonce = crypto.randomUUID().slice(0, 8);
  // A rarely-used exercise, so no other test's platform default interferes.
  const exercise = "safety_bar_squat";
  try {
    const coach = await register(baseUrl, "coach", "Coach", nonce);
    const otherCoach = await register(baseUrl, "coach", "OtherCoach", nonce);
    const lifter = await register(baseUrl, "athlete", "Lifter", nonce);
    const otherLifter = await register(baseUrl, "athlete", "OtherLifter", nonce);
    await relate(baseUrl, coach, lifter, nonce);
    await relate(baseUrl, otherCoach, otherLifter, nonce);
    const auth = (who) => ({ cookie: who.cookie, csrf: who.csrf });
    const seen = async (who) => (await request(baseUrl, "GET", `/exercises/${exercise}/reference-media`, undefined, auth(who))).json.reference_media;

    await removeExerciseDemoVideo(exercise, null);
    await setExerciseDemoVideo(exercise, null, "admin_test", "https://youtu.be/aaaaaaaaaaa");

    // A coach can't save a non-video link, or a demo for an exercise that doesn't exist.
    assert.equal((await request(baseUrl, "PUT", `/coach-workspace/exercise-demo-videos/${exercise}`, { video_url: "https://example.com/x.mp4" }, auth(coach))).status, 400);
    assert.equal((await request(baseUrl, "PUT", "/coach-workspace/exercise-demo-videos/not_an_exercise", { video_url: "https://youtu.be/bbbbbbbbbbb" }, auth(coach))).status, 404);
    // CSRF required; athletes can't set coach demos.
    assert.notEqual((await request(baseUrl, "PUT", `/coach-workspace/exercise-demo-videos/${exercise}`, { video_url: "https://youtu.be/bbbbbbbbbbb" }, { cookie: coach.cookie })).status, 200);
    assert.equal((await request(baseUrl, "PUT", `/coach-workspace/exercise-demo-videos/${exercise}`, { video_url: "https://youtu.be/bbbbbbbbbbb" }, auth(lifter))).status, 403);

    const saved = await request(baseUrl, "PUT", `/coach-workspace/exercise-demo-videos/${exercise}`, { video_url: "https://www.youtube.com/watch?v=bbbbbbbbbbb" }, auth(coach));
    assert.equal(saved.status, 200, saved.text);

    assert.deepEqual(await seen(lifter), { video_url: "https://www.youtube.com/watch?v=bbbbbbbbbbb", embed_url: "https://www.youtube-nocookie.com/embed/bbbbbbbbbbb?rel=0&playsinline=1", provider: "youtube", source: "coach_entered" });
    assert.equal((await seen(coach)).source, "coach_entered", "the coach sees their own");
    assert.equal((await seen(otherLifter)).embed_url, "https://www.youtube-nocookie.com/embed/aaaaaaaaaaa?rel=0&playsinline=1", "another coach's athlete sees the default");
    assert.equal((await seen(otherLifter)).source, "admin_entered");
    assert.equal((await seen(otherCoach)).source, "admin_entered");

    const list = await request(baseUrl, "GET", "/coach-workspace/exercise-demo-videos", undefined, auth(coach));
    assert.deepEqual(list.json.demo_videos.map((d) => [d.exercise_id, d.video_id]), [[exercise, "bbbbbbbbbbb"]]);

    assert.equal((await request(baseUrl, "DELETE", `/coach-workspace/exercise-demo-videos/${exercise}`, undefined, auth(coach))).status, 200);
    assert.equal((await seen(lifter)).source, "admin_entered", "back to the default");

    await removeExerciseDemoVideo(exercise, null);
    assert.equal(await seen(lifter), null, "no demo at all");

    // The admin routes need an admin session.
    assert.equal((await request(baseUrl, "GET", "/admin/exercise-demo-videos")).status, 401);
    assert.equal((await request(baseUrl, "PUT", `/admin/exercise-demo-videos/${exercise}`, { video_url: "https://youtu.be/ccccccccccc" }, auth(coach))).status, 401);
  }
  finally {
    await removeExerciseDemoVideo(exercise, null).catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    await pool.end().catch(() => {});
  }
});
