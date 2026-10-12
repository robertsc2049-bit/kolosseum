// Phone notifications without a paid service: Web Push signed and encrypted
// with Node's own crypto (src/api/web_push.ts), checked against the RFC 8291
// worked example so a real phone can decrypt what we send.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

import {
  encryptPushPayload,
  generateVapidKeys,
  isAllowedPushEndpoint,
  sendWebPush,
  vapidAuthorization,
  vapidConfigFromEnv
} from "../dist/src/api/web_push.js";
import { PUSH_TITLES, pushPayloadFor } from "../dist/src/api/product_push_service.js";

const b64 = (value) => Buffer.from(value, "base64url");

test("the encrypted payload matches RFC 8291's worked example byte for byte", () => {
  const ephemeral = crypto.createECDH("prime256v1");
  ephemeral.setPrivateKey(b64("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"));
  assert.equal(ephemeral.getPublicKey().toString("base64url"), "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
  const body = encryptPushPayload(
    Buffer.from("When I grow up, I want to be a watermelon"),
    { p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", auth: "BTBZMqHH6r4Tts7J_aSIgg" },
    ephemeral,
    b64("DGv6ra1nlYgDCS1FRnbzlw")
  );
  assert.equal(
    body.toString("base64url"),
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
  );
});

test("the VAPID token is an ES256 JWT for the push service's origin that verifies with our public key", () => {
  const keys = generateVapidKeys();
  assert.equal(b64(keys.publicKey).length, 65);
  assert.equal(b64(keys.privateKey).length, 32);
  const config = { ...keys, subject: "mailto:coach@example.com" };
  const header = vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", config, 1_800_000_000);
  const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/u.exec(header);
  assert.ok(match, header);
  const [, h, c, sig, k] = match;
  assert.equal(k, keys.publicKey);
  assert.deepEqual(JSON.parse(b64(c)), { aud: "https://fcm.googleapis.com", exp: 1_800_000_000 + 12 * 3600, sub: "mailto:coach@example.com" });
  const point = b64(keys.publicKey);
  const publicKey = crypto.createPublicKey({ key: { kty: "EC", crv: "P-256", x: point.subarray(1, 33).toString("base64url"), y: point.subarray(33).toString("base64url") }, format: "jwk" });
  assert.ok(crypto.verify("sha256", Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, b64(sig)));
});

test("we only ever send to the browsers' push services - never a URL a client made up", () => {
  for (const ok of [
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/QGv",
    "https://wns2-par02p.notify.windows.com/w/?token=abc"
  ]) assert.equal(isAllowedPushEndpoint(ok), true, ok);
  for (const bad of [
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com.evil.example/x",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/x",
    "https://user:pw@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "not a url"
  ]) assert.equal(isAllowedPushEndpoint(bad), false, bad);
});

test("push is off unless all three VAPID settings are present and well-formed", () => {
  const keys = generateVapidKeys();
  assert.equal(vapidConfigFromEnv({}), null);
  assert.equal(vapidConfigFromEnv({ VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey }), null, "no subject");
  assert.equal(vapidConfigFromEnv({ VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: "coach@example.com" }), null, "subject must be mailto: or https:");
  assert.equal(vapidConfigFromEnv({ VAPID_PUBLIC_KEY: "abc", VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: "mailto:a@b.c" }), null, "bad key");
  assert.equal(vapidConfigFromEnv({ VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: "mailto:a@b.c" })?.publicKey, keys.publicKey);
});

test("a send posts the encrypted payload with the Web Push headers; 404/410 means the phone is gone", async () => {
  const keys = generateVapidKeys();
  const config = { ...keys, subject: "mailto:a@b.c" };
  const phone = crypto.createECDH("prime256v1");
  phone.generateKeys();
  const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", p256dh: phone.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") };
  const calls = [];
  const ok = await sendWebPush(subscription, { title: "New message" }, config, async (url, init) => { calls.push({ url, init }); return { ok: true, status: 201 }; });
  assert.deepEqual(ok, { ok: true, status: 201, gone: false });
  assert.equal(calls[0].url, subscription.endpoint);
  assert.equal(calls[0].init.headers["Content-Encoding"], "aes128gcm");
  assert.match(calls[0].init.headers.Authorization, /^vapid t=/u);
  assert.equal(calls[0].init.redirect, "error", "a push service can't bounce us elsewhere");
  const gone = await sendWebPush(subscription, {}, config, async () => ({ ok: false, status: 410 }));
  assert.equal(gone.gone, true);
  const elsewhere = await sendWebPush({ ...subscription, endpoint: "https://evil.example/x" }, {}, config, async () => { throw new Error("must not be called"); });
  assert.equal(elsewhere.ok, false);
});

test("the lock screen shows what kind of notification it is - never a name or message text - and opens the app", () => {
  assert.deepEqual({ ...pushPayloadFor("coach_athlete_message_received") }, { title: "New message", body: "Open Kolosseum to see it.", url: "/app/", tag: "coach_athlete_message_received" });
  assert.equal(pushPayloadFor("something_new").title, "New notification");
});

test("push titles match the bell's labels", () => {
  const source = fs.readFileSync("public/app-src/api/notificationsClient.ts", "utf8");
  const block = source.slice(source.indexOf("NOTIFICATION_TYPE_LABELS"), source.indexOf("};", source.indexOf("NOTIFICATION_TYPE_LABELS")));
  const labels = Object.fromEntries([...block.matchAll(/^\s+([a-z_]+): "([^"]+)",?$/gmu)].map(([, k, v]) => [k, v]));
  assert.ok(Object.keys(labels).length > 20);
  assert.deepEqual({ ...PUSH_TITLES }, labels);
});
