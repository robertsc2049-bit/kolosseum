// GDPR erasure end to end (real database, server and files): an athlete asks
// for their account to be deleted, the admin reviews it and presses Erase.
// Everything they were told would be deleted is gone - rows and files - and
// what they were told is kept (billing, terms acceptance) stays, linked to
// nobody. A coach's erasure keeps the programme they wrote for others.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";
import { STORAGE_ROOT as MESSAGE_ROOT } from "../dist/src/api/message_attachment_storage.js";
import { STORAGE_ROOT as PHOTO_ROOT } from "../dist/src/api/progress_photo_storage.js";
import { STORAGE_ROOT as DEMO_ROOT } from "../dist/src/api/exercise_demo_video_storage.js";

async function request(baseUrl, method, route, body, options = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  if (options.csrf) headers["x-kolosseum-csrf"] = options.csrf;
  const response = await fetch(`${baseUrl}${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: response.status, json, text: text.slice(0, 400), response };
}

const cookieOf = (result, name) => result.response.headers.getSetCookie().find((v) => v.startsWith(`${name}=`)).split(";")[0];

async function register(baseUrl, actorType, label, nonce) {
  const email = `erase_${label.toLowerCase()}_${nonce}@example.com`;
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: actorType, display_name: `${label} Person`, email, password: "EraseMeCompletely!2026",
    activity_id: "rugby_union", accepted_terms: true, accepted_consent: true,
    accepted_terms_version: "terms_v1", date_of_birth: "1995-06-01", accepted_consent_version: "consent_v1"
  });
  assert.equal(result.status, 201, result.text);
  return { userId: result.json.account.user_id, email, cookie: cookieOf(result, "kolosseum_session"), csrf: result.json.csrf_token };
}

async function createAdmin(email, password) {
  const salt = crypto.randomBytes(24).toString("base64url");
  const hash = await new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? reject(e) : resolve(Buffer.from(k).toString("base64url")))));
  const userId = `admin_${crypto.randomUUID().replaceAll("-", "")}`;
  await pool.query(`INSERT INTO product_admin_accounts (user_id, email_canonical, display_name, password_salt, password_hash) VALUES ($1,$2,$3,$4,$5)`, [userId, email, "Erasure Admin", salt, hash]);
  return userId;
}

async function relate(baseUrl, coach, athlete, id) {
  const now = new Date().toISOString();
  const result = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
    relationship_id: id, coach_user_id: coach.userId, athlete_user_id: athlete.userId,
    relationship_state: "accepted", relationship_scope: "individual_coach_athlete", accepted_at_iso8601: now,
    created_at_iso8601: now, updated_at_iso8601: now, revoked_at_iso8601: null, expires_at_iso8601: null
  });
  assert.ok(result.status < 300, result.text);
}

async function record(type, subject, actor, payload = {}) {
  const id = `${type}_${crypto.randomUUID().slice(0, 12)}`;
  await pool.query(
    `INSERT INTO beta_product_records (record_type, record_id, subject_user_id, actor_user_id, effective_at, record_sha256, record_payload) VALUES ($1,$2,$3,$4,now(),$5,$6::jsonb)`,
    [type, id, subject, actor, crypto.createHash("sha256").update(id).digest("hex"), JSON.stringify(payload)]
  );
  return id;
}

const rows = async (sql, params) => (await pool.query(sql, params)).rowCount;

async function requestDeletion(baseUrl, who, nonce) {
  const confirmed = await request(baseUrl, "POST", "/account/data-rights/deletion", { confirmation: "DELETE", client_request_id: `erase_${nonce}_${who.userId.slice(-6)}` }, { cookie: who.cookie, csrf: who.csrf });
  assert.ok(confirmed.status < 300, confirmed.text);
  const status = await request(baseUrl, "GET", "/account/data-rights/deletion", undefined, { cookie: who.cookie });
  return status.json?.requests?.[0]?.deletion_request_id ?? status.json?.[0]?.deletion_request_id ?? confirmed.json?.deletion_request_id;
}

test("GDPR erasure: an athlete's data and files are deleted, billing and terms records are kept unlinked; a coach's programme for others survives their erasure", { timeout: 180_000 }, async () => {
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const nonce = crypto.randomUUID().slice(0, 8);
  const adminIds = [];
  try {
    const coach = await register(baseUrl, "coach", "Coach", nonce);
    const athlete = await register(baseUrl, "athlete", "Wing", nonce);
    const teammate = await register(baseUrl, "athlete", "Prop", nonce);
    await relate(baseUrl, coach, athlete, `rel_erase_${nonce}`);
    await relate(baseUrl, coach, teammate, `rel_erase2_${nonce}`);

    // The athlete's data: a body-metric entry, a pain report, a push
    // subscription, a progress photo on disk, a conversation with their
    // coach including a photo they sent.
    await record("body_metric_entry", athlete.userId, athlete.userId, { bodyweight_kg: 92.4 });
    await pool.query(`INSERT INTO product_account_events (event_id, user_id, event_type, event_payload) VALUES ($1,$2,'pain_flag_reported',$3::jsonb)`, [`evt_${nonce}`, athlete.userId, JSON.stringify({ area: "left_knee", severity: 6 })]);
    await pool.query(`INSERT INTO product_push_subscriptions (endpoint, user_id, p256dh, auth) VALUES ($1,$2,'p','a')`, [`https://fcm.googleapis.com/fcm/send/erase-${nonce}`, athlete.userId]);
    const photoDir = path.join(PHOTO_ROOT, athlete.userId, "photo1");
    fs.mkdirSync(photoDir, { recursive: true });
    fs.writeFileSync(path.join(photoDir, "original.jpg"), "jpeg");
    const threadId = `thread_erase_${nonce}`;
    await pool.query(`INSERT INTO product_message_threads (thread_id, thread_type, coach_user_id, athlete_user_id) VALUES ($1,'coach_athlete',$2,$3)`, [threadId, coach.userId, athlete.userId]);
    const athleteMessage = `msg_a_${nonce}`;
    await pool.query(
      `INSERT INTO product_messages (message_id, thread_id, sender_user_id, sender_role, attachment_media_type, attachment_mime_type, attachment_byte_size, attachment_storage_key, client_request_id)
       VALUES ($1,$2,$3,'athlete','image','image/jpeg',4,$4,$5)`,
      [athleteMessage, threadId, athlete.userId, `${athleteMessage}/original.jpg`, `cr_a_${nonce}`]
    );
    fs.mkdirSync(path.join(MESSAGE_ROOT, athleteMessage), { recursive: true });
    fs.writeFileSync(path.join(MESSAGE_ROOT, athleteMessage, "original.jpg"), "jpeg");
    await pool.query(`INSERT INTO product_messages (message_id, thread_id, sender_user_id, sender_role, body_text, client_request_id) VALUES ($1,$2,$3,'coach','Great session',$4)`, [`msg_c_${nonce}`, threadId, coach.userId, `cr_c_${nonce}`]);
    // What the athlete was told is kept: a terms acknowledgement and a billing record.
    await record("beta16_acknowledgement", athlete.userId, athlete.userId, { acknowledgement_id: `ack_${nonce}` });
    await pool.query(`INSERT INTO product_commercial_records (commercial_record_id, user_id, request_id, record_type, effective_at, record_sha256, record_payload) VALUES ($1,$2,$3,'commercial_checkout_requested',now(),$4,'{}'::jsonb)`, [`com_${nonce}`, athlete.userId, `req_${nonce}`, crypto.createHash("sha256").update(`com_${nonce}`).digest("hex")]);

    // The coach's data: a programme they wrote (others train from it), and their own demo clip.
    const templateId = await record("beta18_programme_template", coach.userId, coach.userId, { name: "Rugby pre-season" });
    const clipId = crypto.randomUUID();
    fs.mkdirSync(path.join(DEMO_ROOT, clipId), { recursive: true });
    fs.writeFileSync(path.join(DEMO_ROOT, clipId, "original.mp4"), "mp4");
    await pool.query(`INSERT INTO product_exercise_demo_videos (demo_key, exercise_id, coach_user_id, provider, video_id, storage_key, set_by_user_id) VALUES ($1,'sled_push',$2,'upload',$3,$4,$2)`, [`sled_push|${coach.userId}`, coach.userId, clipId, `${clipId}/original.mp4`]);

    const athleteRequest = await requestDeletion(baseUrl, athlete, nonce);
    assert.ok(athleteRequest, "the athlete's deletion request is queued");

    const adminEmail = `erase_admin_${nonce}@example.com`;
    adminIds.push(await createAdmin(adminEmail, "EraseAdminPassword1234"));
    const signIn = await request(baseUrl, "POST", "/admin/sign-in", { email: adminEmail, password: "EraseAdminPassword1234" });
    assert.equal(signIn.status, 200, signIn.text);
    const admin = { cookie: cookieOf(signIn, "kolosseum_admin_session"), csrf: signIn.json.csrf_token };
    const erase = (id, correlation, auth = admin) => request(baseUrl, "POST", `/admin/data-rights/deletions/${id}/erase`, { correlation_id: correlation }, auth);

    // Only an admin, with CSRF, can erase.
    assert.equal((await erase(athleteRequest, `c1_${nonce}`, { cookie: athlete.cookie, csrf: athlete.csrf })).status, 401);
    assert.notEqual((await erase(athleteRequest, `c1_${nonce}`, { cookie: admin.cookie })).status, 200);
    assert.equal((await erase("deletion_request_nope", `c0_${nonce}`)).status, 404);

    const erased = await erase(athleteRequest, `c1_${nonce}`);
    assert.equal(erased.status, 200, erased.text);
    assert.equal(erased.json.audit.action_type, "data_deletion_executed");
    assert.equal(erased.json.audit.files_removed.failed, 0);
    // The same click again (network retry) replays; a fresh attempt is refused.
    assert.equal((await erase(athleteRequest, `c1_${nonce}`)).json.audit.idempotent_replay, true);
    assert.equal((await erase(athleteRequest, `c2_${nonce}`)).status, 409);

    // The account is a tombstone: nothing identifying, no way in.
    const account = (await pool.query(`SELECT email_canonical, display_name, account_state FROM product_accounts WHERE user_id = $1`, [athlete.userId])).rows[0];
    assert.deepEqual(account, { email_canonical: `erased+${athlete.userId}@erased.invalid`, display_name: "Erased account", account_state: "deleted" });
    assert.notEqual((await request(baseUrl, "POST", "/account/sign-in", { email: athlete.email, password: "EraseMeCompletely!2026" })).status, 200);
    assert.notEqual((await request(baseUrl, "GET", "/account/detail", undefined, { cookie: athlete.cookie })).status, 200, "their old session is gone");

    // Deleted: their data and files.
    assert.equal(await rows(`SELECT 1 FROM beta_product_records WHERE subject_user_id = $1 AND record_type <> 'beta16_acknowledgement'`, [athlete.userId]), 0, "body metrics, declarations, relationships");
    assert.equal(await rows(`SELECT 1 FROM product_account_events WHERE user_id = $1`, [athlete.userId]), 0, "pain report and account events");
    assert.equal(await rows(`SELECT 1 FROM product_push_subscriptions WHERE user_id = $1`, [athlete.userId]), 0);
    assert.equal(await rows(`SELECT 1 FROM product_messages WHERE sender_user_id = $1`, [athlete.userId]), 0, "messages they sent");
    assert.equal(fs.existsSync(path.join(MESSAGE_ROOT, athleteMessage)), false, "their message photo");
    assert.equal(fs.existsSync(path.join(PHOTO_ROOT, athlete.userId)), false, "their progress photos");
    assert.equal(await rows(`SELECT 1 FROM beta_product_records WHERE record_type = 'beta17_coach_relationship' AND subject_user_id = $1`, [athlete.userId]), 0);

    // Kept, as they were told: terms acknowledgement and billing - and the
    // coach's own side of the conversation.
    assert.ok(await rows(`SELECT 1 FROM beta_product_records WHERE subject_user_id = $1 AND record_type = 'beta16_acknowledgement'`, [athlete.userId]) >= 2, "their terms acknowledgements (from sign-up, and the seeded one)");
    assert.equal(await rows(`SELECT 1 FROM product_commercial_records WHERE user_id = $1`, [athlete.userId]), 1);
    assert.equal(await rows(`SELECT 1 FROM product_messages WHERE sender_user_id = $1`, [coach.userId]), 1);
    assert.equal(await rows(`SELECT 1 FROM data_deletion_requests WHERE deletion_request_id = $1 AND queue_status = 'completed'`, [athleteRequest]), 1);
    // The teammate is untouched.
    assert.equal(await rows(`SELECT 1 FROM beta_product_records WHERE record_type = 'beta17_coach_relationship' AND subject_user_id = $1`, [teammate.userId]), 1);

    // The coach asks too: their programme stays for the athletes who train
    // from it; their demo clip and relationships go.
    const coachRequest = await requestDeletion(baseUrl, coach, nonce);
    const coachErased = await erase(coachRequest, `c3_${nonce}`);
    assert.equal(coachErased.status, 200, coachErased.text);
    assert.equal(await rows(`SELECT 1 FROM beta_product_records WHERE record_id = $1`, [templateId]), 1, "the programme they wrote survives");
    assert.equal(await rows(`SELECT 1 FROM product_exercise_demo_videos WHERE coach_user_id = $1`, [coach.userId]), 0);
    assert.equal(fs.existsSync(path.join(DEMO_ROOT, clipId)), false, "their demo clip");
    assert.equal(await rows(`SELECT 1 FROM beta_product_records WHERE record_type = 'beta17_coach_relationship' AND actor_user_id = $1`, [coach.userId]), 0, "their relationships end");
    assert.equal((await pool.query(`SELECT display_name FROM product_accounts WHERE user_id = $1`, [coach.userId])).rows[0].display_name, "Erased account");
  }
  finally {
    await pool.query("DELETE FROM product_admin_audit_records WHERE actor_user_id = ANY($1::text[])", [adminIds]).catch(() => {});
    await pool.query("DELETE FROM product_admin_sessions WHERE user_id = ANY($1::text[])", [adminIds]).catch(() => {});
    await pool.query("DELETE FROM product_admin_accounts WHERE user_id = ANY($1::text[])", [adminIds]).catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    await pool.end().catch(() => {});
  }
});
