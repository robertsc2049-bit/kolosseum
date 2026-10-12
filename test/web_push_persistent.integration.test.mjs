// Phone notifications end to end against the real database: an athlete turns
// notifications on for their phone, a coach invites them, and the push sweep
// sends the invite once - not again on the next sweep. A phone the push
// service says is gone is dropped; a phone someone else signs in on moves to
// them. (Delivery itself is a fake sender - the wire format is web_push.test.mjs.)
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { generateVapidKeys } from "../dist/src/api/web_push.js";

const keys = generateVapidKeys();
process.env.VAPID_PUBLIC_KEY = keys.publicKey;
process.env.VAPID_PRIVATE_KEY = keys.privateKey;
process.env.VAPID_SUBJECT = "mailto:push-test@example.com";

const { app } = await import("../dist/src/server.js");
const { pool } = await import("../dist/src/db/pool.js");
const { runPushSweep } = await import("../dist/src/api/product_push_service.js");

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
  return { status: response.status, text, json, response };
}

async function register(baseUrl, actorType, label, nonce) {
  const result = await request(baseUrl, "POST", "/account/register", {
    actor_type: actorType,
    display_name: label,
    email: `push_${label.toLowerCase()}_${nonce}@example.com`,
    password: "WebPushPhone!2026",
    activity_id: "rugby_union",
    accepted_terms: true,
    accepted_consent: true,
    accepted_terms_version: "terms_v1",
    date_of_birth: "1996-04-02",
    accepted_consent_version: "consent_v1"
  });
  assert.equal(result.status, 201, result.text);
  const cookie = result.response.headers.getSetCookie().find((v) => v.startsWith("kolosseum_session=")).split(";")[0];
  return { userId: result.json.account.user_id, cookie, csrf: result.json.csrf_token };
}

function phone() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/test-${crypto.randomUUID()}`,
    keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") }
  };
}

test("a rugby player's phone gets the coach's invite pushed once; a dead phone is dropped; a borrowed phone moves to its new owner", { timeout: 120_000 }, async () => {
  const server = await listen();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const nonce = crypto.randomUUID().slice(0, 8);
  try {
    const coach = await register(baseUrl, "coach", "Coach", nonce);
    const athlete = await register(baseUrl, "athlete", "Wing", nonce);
    const teammate = await register(baseUrl, "athlete", "Prop", nonce);
    const auth = (who) => ({ cookie: who.cookie, csrf: who.csrf });

    const config = await request(baseUrl, "GET", "/account/notifications/push", undefined, auth(athlete));
    assert.equal(config.status, 200, config.text);
    assert.equal(config.json.enabled, true);
    assert.equal(config.json.public_key, keys.publicKey);
    assert.equal(config.json.subscription_count, 0);

    // A made-up endpoint (not a browser push service) is refused.
    const bogus = await request(baseUrl, "POST", "/account/notifications/push/subscribe", { endpoint: "https://evil.example/x", keys: phone().keys }, auth(athlete));
    assert.equal(bogus.status, 400, bogus.text);
    // CSRF is required.
    const noCsrf = await request(baseUrl, "POST", "/account/notifications/push/subscribe", phone(), { cookie: athlete.cookie });
    assert.notEqual(noCsrf.status, 200);

    const wingPhone = phone();
    assert.equal((await request(baseUrl, "POST", "/account/notifications/push/subscribe", wingPhone, auth(athlete))).status, 200);
    assert.equal((await request(baseUrl, "GET", "/account/notifications/push", undefined, auth(athlete))).json.subscription_count, 1);

    // The coach invites the wing.
    const now = new Date().toISOString();
    const invite = await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
      relationship_id: `rel_push_${nonce}`, coach_user_id: coach.userId, athlete_user_id: athlete.userId,
      relationship_state: "invited", relationship_scope: "individual_coach_athlete", accepted_at_iso8601: null,
      created_at_iso8601: now, updated_at_iso8601: now, revoked_at_iso8601: null, expires_at_iso8601: null
    });
    assert.ok(invite.status < 300, invite.text);

    const sent = [];
    const fakeSend = async (subscription, payload) => { sent.push({ endpoint: subscription.endpoint, payload }); return { ok: true, status: 201, gone: false }; };
    const config_ = { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: "mailto:push-test@example.com" };
    await runPushSweep(config_, fakeSend);
    const toWing = sent.filter((s) => s.endpoint === wingPhone.endpoint);
    assert.deepEqual(toWing.map((s) => s.payload.title), ["Relationship invited"]);
    assert.equal(JSON.stringify(toWing[0].payload).includes("Coach"), false, "no names on the lock screen");

    sent.length = 0;
    await runPushSweep(config_, fakeSend);
    assert.equal(sent.filter((s) => s.endpoint === wingPhone.endpoint).length, 0, "not pushed twice");

    // The teammate signs in on the wing's phone: it's theirs now, and the
    // wing's notifications stop going to it.
    assert.equal((await request(baseUrl, "POST", "/account/notifications/push/subscribe", wingPhone, auth(teammate))).status, 200);
    assert.equal((await request(baseUrl, "GET", "/account/notifications/push", undefined, auth(athlete))).json.subscription_count, 0);
    assert.equal((await request(baseUrl, "GET", "/account/notifications/push", undefined, auth(teammate))).json.subscription_count, 1);

    // The push service says the teammate's phone is gone (app removed) -
    // dropped on the next sweep that has something to send.
    const now2 = new Date().toISOString();
    await request(baseUrl, "POST", "/sessions/beta-coach-relationship", {
      relationship_id: `rel_push2_${nonce}`, coach_user_id: coach.userId, athlete_user_id: teammate.userId,
      relationship_state: "invited", relationship_scope: "individual_coach_athlete", accepted_at_iso8601: null,
      created_at_iso8601: now2, updated_at_iso8601: now2, revoked_at_iso8601: null, expires_at_iso8601: null
    });
    await runPushSweep(config_, async (subscription) => ({ ok: false, status: subscription.endpoint === wingPhone.endpoint ? 410 : 201, gone: subscription.endpoint === wingPhone.endpoint }));
    assert.equal((await request(baseUrl, "GET", "/account/notifications/push", undefined, auth(teammate))).json.subscription_count, 0);

    // Turning it off removes this phone only, and only for its owner.
    const propPhone = phone();
    await request(baseUrl, "POST", "/account/notifications/push/subscribe", propPhone, auth(teammate));
    await request(baseUrl, "POST", "/account/notifications/push/unsubscribe", { endpoint: propPhone.endpoint }, auth(athlete));
    assert.equal((await request(baseUrl, "GET", "/account/notifications/push", undefined, auth(teammate))).json.subscription_count, 1, "someone else can't remove it");
    await request(baseUrl, "POST", "/account/notifications/push/unsubscribe", { endpoint: propPhone.endpoint }, auth(teammate));
    assert.equal((await request(baseUrl, "GET", "/account/notifications/push", undefined, auth(teammate))).json.subscription_count, 0);
  }
  finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end().catch(() => {});
  }
});
