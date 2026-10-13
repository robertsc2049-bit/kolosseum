// A coach films their own demo and uploads it: their athlete can play and
// seek it in the app, another coach's athlete can't fetch it at all, a file
// that isn't a video is refused, and replacing it with a link deletes the
// clip from disk. Real database and server.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";
import { STORAGE_ROOT } from "../dist/src/api/exercise_demo_video_storage.js";

async function request(baseUrl, method, route, body, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (body !== undefined && !(body instanceof FormData)) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;
  const response = await fetch(`${baseUrl}${route}`, { method, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  const buffer = Buffer.from(await response.arrayBuffer());
  let json = null;
  try { json = JSON.parse(buffer.toString("utf8")); } catch {}
  return { status: response.status, json, buffer, headers: response.headers, text: buffer.toString("utf8").slice(0, 300), response };
}

async function register(baseUrl, actorType, label, nonce) {
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: actorType, display_name: label,
    email: `upload_${label.toLowerCase()}_${nonce}@example.com`, password: "DemoUploads!2026",
    activity_id: "rugby_union", accepted_terms: true, accepted_consent: true,
    accepted_terms_version: "terms_v1", date_of_birth: "1993-03-11", accepted_consent_version: "consent_v1"
  });
  assert.equal(result.status, 201, result.text);
  const cookie = result.response.headers.getSetCookie().find((v) => v.startsWith("kolosseum_session=")).split(";")[0];
  return { userId: result.json.account.user_id, cookie, csrf: result.json.csrf_token };
}

async function relate(baseUrl, coach, athlete, nonce) {
  const now = new Date().toISOString();
  const result = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: `rel_upload_${nonce}_${athlete.userId.slice(-6)}`, coach_user_id: coach.userId, athlete_user_id: athlete.userId,
    relationship_state: "accepted", relationship_scope: "individual_coach_athlete", accepted_at_iso8601: now,
    created_at_iso8601: now, updated_at_iso8601: now, revoked_at_iso8601: null, expires_at_iso8601: null
  });
  assert.ok(result.status < 300, result.text);
}

// The first bytes of an MP4 (an ISO-BMFF ftyp box) and some payload - enough
// for the server's content sniffing; no real frames, so no poster.
function fakeMp4(size = 4096) {
  const header = Buffer.from([0, 0, 0, 0x18, ...Buffer.from("ftypmp42"), 0, 0, 0, 0, ...Buffer.from("isommp42")]);
  return Buffer.concat([header, crypto.randomBytes(size - header.length)]);
}

const form = (bytes, name = "squat.mp4", type = "video/mp4") => {
  const data = new FormData();
  data.append("video", new Blob([bytes], { type }), name);
  return data;
};

test("a rugby coach's own sled push demo: their athlete plays it, another coach's athlete can't fetch it", { timeout: 120_000 }, async () => {
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const nonce = crypto.randomUUID().slice(0, 8);
  const exercise = "sled_push";
  const stagingBefore = fs.readdirSync(path.join(STORAGE_ROOT, "tmp")).length;
  try {
    const coach = await register(baseUrl, "coach", "Coach", nonce);
    const otherCoach = await register(baseUrl, "coach", "OtherCoach", nonce);
    const winger = await register(baseUrl, "athlete", "Winger", nonce);
    const prop = await register(baseUrl, "athlete", "Prop", nonce);
    await relate(baseUrl, coach, winger, nonce);
    await relate(baseUrl, otherCoach, prop, nonce);
    const auth = (who) => ({ cookie: who.cookie, csrf: who.csrf });
    const route = `/coach-workspace/exercise-demo-videos/${exercise}/upload`;

    // No CSRF: refused before the upload is accepted, nothing left staged.
    const noCsrf = await request(baseUrl, "POST", route, form(fakeMp4()), { cookie: coach.cookie });
    assert.notEqual(noCsrf.status, 201);
    // An athlete can't upload a coach demo.
    assert.equal((await request(baseUrl, "POST", route, form(fakeMp4()), auth(winger))).status, 403);
    // A file that isn't a video (claiming to be one) is refused by its bytes.
    const notVideo = await request(baseUrl, "POST", route, form(Buffer.from("not a video at all"), "squat.mp4"), auth(coach));
    assert.equal(notVideo.status, 400, notVideo.text);
    assert.match(notVideo.text, /demo_video_type_unsupported/u);
    // An exercise that doesn't exist.
    assert.equal((await request(baseUrl, "POST", "/coach-workspace/exercise-demo-videos/not_an_exercise/upload", form(fakeMp4()), auth(coach))).status, 404);
    assert.equal(fs.readdirSync(path.join(STORAGE_ROOT, "tmp")).length, stagingBefore, "no staged file left behind");

    const clip = fakeMp4(8192);
    const uploaded = await request(baseUrl, "POST", route, form(clip), auth(coach));
    assert.equal(uploaded.status, 201, uploaded.text);
    const uploadId = uploaded.json.demo_video.video_id;
    const fileUrl = `/exercises/${exercise}/demo-uploads/${uploadId}`;
    assert.equal(uploaded.json.demo_video.video_url, fileUrl);

    // The winger's how-to shows their coach's clip.
    const media = (await request(baseUrl, "GET", `/exercises/${exercise}/reference-media`, undefined, auth(winger))).json.reference_media;
    assert.deepEqual({ provider: media.provider, source: media.source, video_url: media.video_url }, { provider: "upload", source: "coach_entered", video_url: fileUrl });

    // They can play it - and seek, which an iPhone needs.
    const full = await request(baseUrl, "GET", fileUrl, undefined, auth(winger));
    assert.equal(full.status, 200);
    assert.equal(full.headers.get("content-type"), "video/mp4");
    assert.ok(full.buffer.equals(clip), "the clip as uploaded");
    const part = await request(baseUrl, "GET", fileUrl, undefined, { ...auth(winger), headers: { range: "bytes=0-99" } });
    assert.equal(part.status, 206);
    assert.equal(part.buffer.length, 100);
    // The coach can play their own.
    assert.equal((await request(baseUrl, "GET", fileUrl, undefined, auth(coach))).status, 200);

    // Another coach's athlete, another coach, or nobody signed in: no access.
    assert.equal((await request(baseUrl, "GET", fileUrl, undefined, auth(prop))).status, 404);
    assert.equal((await request(baseUrl, "GET", fileUrl, undefined, auth(otherCoach))).status, 404);
    assert.equal((await request(baseUrl, "GET", fileUrl)).status, 401);
    assert.equal((await request(baseUrl, "GET", `/exercises/${exercise}/demo-uploads/../../etc/passwd`, undefined, auth(winger))).status, 404);

    // Replacing it with a link deletes the clip from disk.
    const clipDir = path.join(STORAGE_ROOT, uploadId);
    assert.ok(fs.existsSync(clipDir));
    assert.equal((await request(baseUrl, "PUT", `/coach-workspace/exercise-demo-videos/${exercise}`, { video_url: "https://youtu.be/uizUibaEPHM" }, auth(coach))).status, 200);
    assert.equal(fs.existsSync(clipDir), false, "replaced clip removed");
    assert.equal((await request(baseUrl, "GET", fileUrl, undefined, auth(winger))).status, 404);

    // Upload again, then remove the demo: the clip goes too.
    const again = await request(baseUrl, "POST", route, form(fakeMp4()), auth(coach));
    assert.equal(again.status, 201, again.text);
    const againDir = path.join(STORAGE_ROOT, again.json.demo_video.video_id);
    assert.equal((await request(baseUrl, "DELETE", `/coach-workspace/exercise-demo-videos/${exercise}`, undefined, auth(coach))).status, 200);
    assert.equal(fs.existsSync(againDir), false, "removed clip deleted");
  }
  finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end().catch(() => {});
  }
});
