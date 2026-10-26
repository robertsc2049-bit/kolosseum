// An athlete who forgot her password gets the reset code by email, and can
// set a new password with it; a new account's verification code is emailed
// too. Resend is stubbed: the test sees exactly what would be sent. A reset
// for an address with no account sends nothing, and with no Resend key the
// requests still succeed (nothing is sent).
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";
import { accountCodeEmail, sendAccountCodeEmail } from "../dist/src/api/account_code_email.js";

const realFetch = globalThis.fetch;
const sent = [];
function stubResend() {
  globalThis.fetch = async (url, init) => {
    if (String(url) === "https://api.resend.com/emails") {
      sent.push({ auth: init.headers.Authorization, ...JSON.parse(init.body) });
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
    }
    return realFetch(url, init);
  };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

test("the email says what the code is for, how long it lasts, and what to do if it wasn't you", () => {
  const reset = accountCodeEmail("password_reset", "042917", 30);
  assert.equal(reset.subject, "Your Kolosseum password reset code");
  assert.match(reset.text, /042917/u);
  assert.match(reset.text, /expires in 30 minutes/u);
  assert.match(reset.text, /didn't ask to reset your password/u);
  assert.equal(accountCodeEmail("email_verification", "1", 30).subject, "Your Kolosseum verification code");
});

test("no Resend key: nothing is sent and nothing throws", async () => {
  const before = { key: process.env.RESEND_API_KEY };
  delete process.env.RESEND_API_KEY;
  assert.equal(await sendAccountCodeEmail("a@example.com", "password_reset", "123456", 30), false);
  if (before.key) process.env.RESEND_API_KEY = before.key;
});

test("a forgotten password: the code arrives by email and resets the password", { timeout: 60000 }, async (t) => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.KOLOSSEUM_EMAIL_FROM = "Kolosseum <no-reply@mail.kolosseum.tools>";
  stubResend();
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const email = `code_email_${nonce}@example.com`;
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  let userId = "";
  t.after(async () => {
    globalThis.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.KOLOSSEUM_EMAIL_FROM;
    await new Promise((resolve) => server.close(resolve));
    if (userId) for (const table of ["product_account_events", "product_auth_sessions", "product_auth_challenges", "product_accounts"]) await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]).catch(() => {});
    await pool.end();
  });
  const post = (route, body) => realFetch(base + route, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify(body) });

  const registered = await post("/account/register", {
    actor_type: "athlete", display_name: "Sam", email, password: "CodeEmailTest!2026", date_of_birth: "1994-06-06",
    accepted_terms: true, accepted_consent: true, accepted_terms_version: "terms_v1", accepted_consent_version: "consent_v1", activity_id: "powerlifting"
  });
  assert.equal(registered.status, 201, await registered.text());
  userId = (await pool.query("SELECT user_id FROM product_accounts WHERE email_canonical = $1", [email])).rows[0].user_id;
  await settle();
  const verification = sent.find((m) => m.to[0] === email && m.subject === "Your Kolosseum verification code");
  assert.ok(verification, "the new account's verification code is emailed");
  assert.equal(verification.auth, "Bearer re_test_key");
  assert.equal(verification.from, "Kolosseum <no-reply@mail.kolosseum.tools>");

  sent.length = 0;
  assert.equal((await post("/account/password/reset/request", { email: email.toUpperCase() })).status, 202);
  await settle();
  const reset = sent.find((m) => m.subject === "Your Kolosseum password reset code");
  assert.deepEqual(reset.to, [email]);
  const code = reset.text.match(/\b(\d{6})\b/u)[1];
  const done = await post("/account/password/reset/complete", { email, code, new_password: "NewCodeEmailTest!2026" });
  assert.ok(done.status < 300, await done.text());
  const signedIn = await post("/account/sign-in", { email, password: "NewCodeEmailTest!2026" });
  assert.ok(signedIn.status < 300, "signs in with the new password");

  sent.length = 0;
  assert.equal((await post("/account/password/reset/request", { email: `nobody_${nonce}@example.com` })).status, 202, "same answer for an unknown address");
  await settle();
  assert.equal(sent.length, 0, "and nothing is sent");
});
