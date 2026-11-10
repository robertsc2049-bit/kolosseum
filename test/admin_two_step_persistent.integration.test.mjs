// Two-step sign-in for the admin console (admin_two_step.ts). The admin can
// erase anyone's data, so a password alone isn't enough: after it, a code
// from an authenticator app (RFC 6238) or a single-use backup code. In
// production, an admin without it set up can only set it up.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import test from "node:test";
import { promisify } from "node:util";

import { app } from "../dist/src/server.js";
import { pool } from "../dist/src/db/pool.js";
import { createAdminAccount, signInAdminAccount } from "../dist/src/api/product_admin_account_service.js";
import { base32Encode, decryptSecret, encryptSecret, hotp, matchTotp, timeStep } from "../dist/src/api/admin_two_step.js";

const KEY = "test-only-two-step-key-0123456789abcdef";

test.after(() => pool.end());

function base32Decode(text) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of text.replace(/\s/gu, "")) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

test("authenticator codes follow RFC 6238, allow one step of clock drift, and are never accepted twice", () => {
  const rfcSecret = Buffer.from("12345678901234567890");
  assert.equal(base32Encode(rfcSecret), "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  // RFC 6238 appendix B (SHA-1), last 6 digits.
  assert.equal(hotp(rfcSecret, timeStep(59_000)), "287082");
  assert.equal(hotp(rfcSecret, timeStep(1_111_111_109_000)), "081804");
  assert.equal(hotp(rfcSecret, timeStep(2_000_000_000_000)), "279037");

  const now = 1_800_000_000_000;
  const step = timeStep(now);
  assert.equal(matchTotp(rfcSecret, hotp(rfcSecret, step), now, null), step);
  assert.equal(matchTotp(rfcSecret, hotp(rfcSecret, step - 1), now, null), step - 1, "30 seconds slow");
  assert.equal(matchTotp(rfcSecret, hotp(rfcSecret, step + 1), now, null), step + 1, "30 seconds fast");
  assert.equal(matchTotp(rfcSecret, hotp(rfcSecret, step - 2), now, null), null, "a minute old");
  assert.equal(matchTotp(rfcSecret, hotp(rfcSecret, step + 2), now, null), null);
  assert.equal(matchTotp(rfcSecret, hotp(rfcSecret, step), now, step), null, "already used");
  assert.equal(matchTotp(rfcSecret, hotp(rfcSecret, step), now, step + 1), null, "older than the last one used");
  assert.equal(matchTotp(rfcSecret, "12345", now, null), null);
  assert.equal(matchTotp(rfcSecret, "abcdef", now, null), null);
});

test("the authenticator secret is encrypted with the server key, and tampering is detected", () => {
  const saved = process.env.KOLOSSEUM_ADMIN_TWO_STEP_KEY;
  try {
    process.env.KOLOSSEUM_ADMIN_TWO_STEP_KEY = KEY;
    const secret = crypto.randomBytes(20);
    const stored = encryptSecret(secret);
    assert.doesNotMatch(stored, new RegExp(secret.toString("base64url"), "u"));
    assert.deepEqual(decryptSecret(stored), secret);
    const parts = stored.split(":");
    parts[3] = Buffer.from(parts[3], "base64url").map((b, i) => (i === 0 ? b ^ 1 : b)).toString("base64url");
    assert.throws(() => decryptSecret(parts.join(":")));
    process.env.KOLOSSEUM_ADMIN_TWO_STEP_KEY = "another-key-of-at-least-32-characters!!";
    assert.throws(() => decryptSecret(stored), "a different key can't read it");
    process.env.KOLOSSEUM_ADMIN_TWO_STEP_KEY = "short";
    assert.throws(() => encryptSecret(secret), /admin_two_step_unavailable/u);
  }
  finally {
    if (saved === undefined) delete process.env.KOLOSSEUM_ADMIN_TWO_STEP_KEY;
    else process.env.KOLOSSEUM_ADMIN_TWO_STEP_KEY = saved;
  }
});

test("an admin sets up two-step sign-in, then needs a code after their password", { timeout: 180000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const savedEnv = { key: process.env.KOLOSSEUM_ADMIN_TWO_STEP_KEY, nodeEnv: process.env.NODE_ENV };
  process.env.KOLOSSEUM_ADMIN_TWO_STEP_KEY = KEY;
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const admins = [];

  t.after(async () => {
    if (savedEnv.key === undefined) delete process.env.KOLOSSEUM_ADMIN_TWO_STEP_KEY;
    else process.env.KOLOSSEUM_ADMIN_TWO_STEP_KEY = savedEnv.key;
    if (savedEnv.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedEnv.nodeEnv;
    await new Promise((resolve) => server.close(resolve));
    for (const table of ["product_admin_security_events", "product_admin_sign_in_challenges", "product_admin_backup_codes", "product_admin_sessions"]) {
      await pool.query(`DELETE FROM ${table} WHERE user_id = ANY($1::text[])`, [admins]).catch(() => {});
    }
    await pool.query(`DELETE FROM product_admin_accounts WHERE user_id = ANY($1::text[])`, [admins]).catch(() => {});
  });

  async function call(method, route, body, session) {
    const headers = { origin: base };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (session) { headers.cookie = session.cookie; headers["x-kolosseum-csrf"] = session.csrf; }
    const response = await fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = null; }
    const cookie = (response.headers.getSetCookie?.() ?? []).find((c) => c.startsWith("kolosseum_admin_session=") && !c.startsWith("kolosseum_admin_session=;"));
    return { status: response.status, json, text, cookie: cookie ? cookie.split(";")[0] : null };
  }
  const sessionFrom = (res) => ({ cookie: res.cookie, csrf: res.json.csrf_token });
  const errorOf = (res) => res.json?.error ?? res.json?.details?.failure_token ?? res.json?.failure_token ?? res.text;

  const email = `two_step_${nonce}@example.com`;
  const password = `TwoStepAdmin-${nonce}`;
  admins.push((await createAdminAccount(email, "Two Step Admin", password)).user_id);
  const adminId = admins[0];

  // Without it set up (and not production): signed straight in, offered it.
  const first = await call("POST", "/admin/sign-in", { email, password });
  assert.equal(first.status, 200, first.text);
  assert.ok(first.cookie);
  assert.deepEqual(
    { available: first.json.two_step.available, required: first.json.two_step.required, enabled: first.json.two_step.enabled },
    { available: true, required: false, enabled: false }
  );
  const session = sessionFrom(first);
  const otherSession = sessionFrom(await call("POST", "/admin/sign-in", { email, password }));

  // Set up: scan, then prove the app has it.
  const setup = await call("POST", "/admin/two-step/setup", {}, session);
  assert.equal(setup.status, 200, setup.text);
  assert.ok(
    setup.json.otpauth_uri.startsWith(`otpauth://totp/Kolosseum%20admin%3A${encodeURIComponent(email)}?secret=${setup.json.secret_base32}&issuer=Kolosseum%20admin`),
    setup.json.otpauth_uri
  );
  assert.match(setup.json.qr_svg, /^<svg [^>]*aria-label="QR code for your authenticator app"/u);
  const secret = base32Decode(setup.json.secret_base32);
  assert.equal(secret.length, 20);
  const stored = (await pool.query(`SELECT totp_pending_secret_encrypted, totp_secret_encrypted FROM product_admin_accounts WHERE user_id = $1`, [adminId])).rows[0];
  assert.ok(stored.totp_pending_secret_encrypted.startsWith("v1:"), "kept encrypted");
  assert.ok(!stored.totp_pending_secret_encrypted.includes(setup.json.secret_base32));
  assert.equal(stored.totp_secret_encrypted, null, "not on until confirmed");

  const nowStep = () => timeStep(Date.now());
  const wrongConfirm = await call("POST", "/admin/two-step/setup/confirm", { code: hotp(secret, nowStep() + 5) }, session);
  assert.equal(wrongConfirm.status, 400);
  assert.equal(errorOf(wrongConfirm), "admin_two_step_code_invalid");

  const confirmed = await call("POST", "/admin/two-step/setup/confirm", { code: hotp(secret, nowStep()) }, session);
  assert.equal(confirmed.status, 200, confirmed.text);
  const backupCodes = confirmed.json.backup_codes;
  assert.equal(backupCodes.length, 8);
  assert.equal(new Set(backupCodes).size, 8);
  for (const code of backupCodes) assert.match(code, /^[a-hjkmnp-z2-9]{5}-[a-hjkmnp-z2-9]{5}$/u);
  assert.equal(confirmed.json.two_step.enabled, true);
  assert.equal(confirmed.json.two_step.backup_codes_left, 8);
  const hashes = (await pool.query(`SELECT code_hash FROM product_admin_backup_codes WHERE user_id = $1`, [adminId])).rows.map((r) => r.code_hash);
  assert.equal(hashes.length, 8);
  for (const code of backupCodes) assert.ok(!hashes.includes(code) && !hashes.some((h) => h.includes(code.replace("-", ""))), "stored hashed");

  // Turning it on signs out every other session, not this one.
  assert.equal((await call("GET", "/admin/accounts?query=x", undefined, otherSession)).status, 401);
  assert.equal((await call("GET", "/admin/accounts?query=x", undefined, session)).status, 200);
  assert.equal((await call("POST", "/admin/two-step/setup", {}, session)).status, 409, "already on");

  // Password alone: no session, just the code step.
  const passwordOnly = await call("POST", "/admin/sign-in", { email, password });
  assert.equal(passwordOnly.status, 200, passwordOnly.text);
  assert.equal(passwordOnly.json.two_step_required, true);
  assert.equal(passwordOnly.cookie, null, "no session from a password alone");
  assert.equal(passwordOnly.json.csrf_token, undefined);

  const wrongCode = await call("POST", "/admin/sign-in/two-step", { challenge_token: passwordOnly.json.challenge_token, code: hotp(secret, nowStep() + 5) });
  assert.equal(wrongCode.status, 401);
  assert.equal(errorOf(wrongCode), "admin_two_step_code_invalid");
  assert.equal(wrongCode.cookie, null);

  const codeUsed = hotp(secret, nowStep() + 1);
  const withCode = await call("POST", "/admin/sign-in/two-step", { challenge_token: passwordOnly.json.challenge_token, code: codeUsed.slice(0, 3) + " " + codeUsed.slice(3) });
  assert.equal(withCode.status, 200, withCode.text);
  assert.ok(withCode.cookie);
  assert.equal(withCode.json.used_backup_code, false);
  assert.equal((await call("GET", "/admin/accounts?query=x", undefined, sessionFrom(withCode))).status, 200);
  assert.equal((await pool.query(`SELECT failed_sign_in_count FROM product_admin_accounts WHERE user_id = $1`, [adminId])).rows[0].failed_sign_in_count, 0, "a full sign-in clears failed tries");

  // The same challenge can't be used twice, and the same code can't either.
  assert.equal(errorOf(await call("POST", "/admin/sign-in/two-step", { challenge_token: passwordOnly.json.challenge_token, code: hotp(secret, nowStep()) })), "admin_two_step_expired");
  const again = await call("POST", "/admin/sign-in", { email, password });
  const replay = await call("POST", "/admin/sign-in/two-step", { challenge_token: again.json.challenge_token, code: codeUsed });
  assert.equal(replay.status, 401, "a code that was already used");

  // A backup code works once.
  const viaBackup = await call("POST", "/admin/sign-in/two-step", { challenge_token: again.json.challenge_token, code: backupCodes[0].toUpperCase() });
  assert.equal(viaBackup.status, 200, viaBackup.text);
  assert.equal(viaBackup.json.used_backup_code, true);
  assert.equal(viaBackup.json.two_step.backup_codes_left, 7);
  assert.equal(viaBackup.json.two_step.recent_events[0].event_type, "backup_code_used");
  const third = await call("POST", "/admin/sign-in", { email, password });
  assert.equal((await call("POST", "/admin/sign-in/two-step", { challenge_token: third.json.challenge_token, code: backupCodes[0] })).status, 401, "a used backup code");

  // A challenge stops working after 5 wrong codes, even with the right one.
  for (let i = 0; i < 4; i += 1) {
    assert.equal((await call("POST", "/admin/sign-in/two-step", { challenge_token: third.json.challenge_token, code: "000000" })).status, 401);
  }
  assert.equal(errorOf(await call("POST", "/admin/sign-in/two-step", { challenge_token: third.json.challenge_token, code: backupCodes[1] })), "admin_two_step_expired");

  // Wrong codes count towards the same lockout as wrong passwords (8 since
  // the last full sign-in: 5 so far).
  const fourth = await call("POST", "/admin/sign-in", { email, password });
  assert.equal((await call("POST", "/admin/sign-in/two-step", { challenge_token: fourth.json.challenge_token, code: "000000" })).status, 401);
  assert.equal((await call("POST", "/admin/sign-in/two-step", { challenge_token: fourth.json.challenge_token, code: "000000" })).status, 401);
  const lockedOut = await call("POST", "/admin/sign-in/two-step", { challenge_token: fourth.json.challenge_token, code: "000000" });
  assert.equal(lockedOut.status, 429);
  assert.equal(errorOf(lockedOut), "admin_temporarily_locked");
  assert.equal((await call("POST", "/admin/sign-in", { email, password })).status, 429);
  await pool.query(`UPDATE product_admin_accounts SET failed_sign_in_count = 0, locked_until = NULL WHERE user_id = $1`, [adminId]);

  // An expired challenge is refused.
  const fifth = await call("POST", "/admin/sign-in", { email, password });
  await pool.query(`UPDATE product_admin_sign_in_challenges SET expires_at = now() - interval '1 second' WHERE user_id = $1 AND used_at IS NULL`, [adminId]);
  assert.equal(errorOf(await call("POST", "/admin/sign-in/two-step", { challenge_token: fifth.json.challenge_token, code: backupCodes[1] })), "admin_two_step_expired");

  // New backup codes need an authenticator code (not a backup code); the old ones stop working.
  // (The steps around now have been used; let the test use the current one again.)
  await pool.query(`UPDATE product_admin_accounts SET totp_last_step = $2 WHERE user_id = $1`, [adminId, nowStep() - 2]);
  const signedIn = sessionFrom(withCode);
  assert.equal((await call("POST", "/admin/two-step/backup-codes", { code: backupCodes[1] }, signedIn)).status, 400);
  const replaced = await call("POST", "/admin/two-step/backup-codes", { code: hotp(secret, nowStep()) }, signedIn);
  assert.equal(replaced.status, 200, replaced.text);
  assert.equal(replaced.json.backup_codes.length, 8);
  assert.equal(replaced.json.two_step.backup_codes_left, 8);
  const sixth = await call("POST", "/admin/sign-in", { email, password });
  assert.equal((await call("POST", "/admin/sign-in/two-step", { challenge_token: sixth.json.challenge_token, code: backupCodes[1] })).status, 401, "old backup codes are gone");
  assert.equal((await call("POST", "/admin/sign-in/two-step", { challenge_token: sixth.json.challenge_token, code: replaced.json.backup_codes[0] })).status, 200);

  const events = (await pool.query(`SELECT event_type FROM product_admin_security_events WHERE user_id = $1 ORDER BY created_at`, [adminId])).rows.map((r) => r.event_type);
  assert.deepEqual(events, ["two_step_turned_on", "backup_code_used", "backup_codes_replaced", "backup_code_used"]);

  // The operator's reset (over SSH) turns it off and signs the admin out everywhere.
  const run = promisify(execFile);
  const reset = await run(process.execPath, ["scripts/bootstrap_admin_account.mjs", "--reset-two-step", "--email", email], { env: { ...process.env, ADMIN_BOOTSTRAP_TOKEN: "test" } });
  assert.match(reset.stdout, /Two-step sign-in reset for/u);
  assert.equal((await call("GET", "/admin/accounts?query=x", undefined, signedIn)).status, 401, "signed out");
  const afterReset = await call("POST", "/admin/sign-in", { email, password });
  assert.equal(afterReset.json.two_step_required, undefined);
  assert.equal(afterReset.json.two_step.enabled, false);
  assert.equal(afterReset.json.two_step.backup_codes_left, 0);
  assert.equal(afterReset.json.two_step.recent_events[0].event_type, "two_step_reset");
});

// Runs the bootstrap script with a fake terminal on stdin, so the hidden
// password prompt can be driven the way a person at a keyboard would.
async function runWithTerminal(args, keystrokes) {
  const harness = `
    const { PassThrough } = await import("node:stream");
    const { pathToFileURL } = await import("node:url");
    const fake = new PassThrough();
    fake.isTTY = true;
    fake.setRawMode = () => fake;
    Object.defineProperty(process, "stdin", { value: fake, configurable: true });
    process.argv = [process.argv[0], "scripts/bootstrap_admin_account.mjs", ...JSON.parse(process.env.HARNESS_ARGS)];
    let delay = 100;
    for (const chunk of JSON.parse(process.env.HARNESS_KEYS)) { setTimeout(() => fake.write(chunk), delay); delay += 100; }
    await import(pathToFileURL("scripts/bootstrap_admin_account.mjs").href);
  `;
  return promisify(execFile)(process.execPath, ["--input-type=module", "-e", harness], {
    env: { ...process.env, ADMIN_BOOTSTRAP_TOKEN: "test", HARNESS_ARGS: JSON.stringify(args), HARNESS_KEYS: JSON.stringify(keystrokes) }
  }).catch((error) => error);
}

test("the operator can set a new password for an admin who forgot theirs, typed hidden", { timeout: 120000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const email = `pw_reset_${nonce}@example.com`;
  const oldPassword = `OldAdminPassword-${nonce}`;
  const newPassword = `NewAdminPassword-${nonce}`;
  const adminId = (await createAdminAccount(email, "Forgetful Admin", oldPassword)).user_id;
  t.after(async () => {
    for (const table of ["product_admin_sign_in_challenges", "product_admin_sessions"]) {
      await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [adminId]).catch(() => {});
    }
    await pool.query(`DELETE FROM product_admin_accounts WHERE user_id = $1`, [adminId]).catch(() => {});
  });
  const before = await signInAdminAccount({ email, password: oldPassword });
  assert.ok(before.raw_session_token, "signed in with the old password");
  await pool.query(`UPDATE product_admin_accounts SET failed_sign_in_count = 5, locked_until = now() + interval '15 minutes' WHERE user_id = $1`, [adminId]);
  const hashOf = async () => (await pool.query(`SELECT password_hash FROM product_admin_accounts WHERE user_id = $1`, [adminId])).rows[0].password_hash;
  const originalHash = await hashOf();

  // Without a terminal it refuses rather than reading a password from a pipe.
  const piped = await promisify(execFile)(process.execPath, ["scripts/bootstrap_admin_account.mjs", "--reset-password", "--email", email], { env: { ...process.env, ADMIN_BOOTSTRAP_TOKEN: "test" } }).catch((error) => error);
  assert.equal(piped.code, 1);
  assert.match(piped.stderr, /interactive terminal/u);
  assert.equal(await hashOf(), originalHash);

  // Too short, and a mismatch, change nothing.
  const short = await runWithTerminal(["--reset-password", "--email", email], ["elevenchars\r"]);
  assert.match(short.stderr, /12 to 200 characters\. Nothing was changed\./u);
  const mismatch = await runWithTerminal(["--reset-password", "--email", email], [`${newPassword}\r`, `${newPassword}X\r`]);
  assert.match(mismatch.stderr, /didn't match\. Nothing was changed\./u);
  assert.equal(await hashOf(), originalHash);

  // Typed with a correction, then pasted with a Windows line ending.
  const done = await runWithTerminal(["--reset-password", "--email", email], [`${newPassword}z\u007f\r`, `${newPassword}\r\n`]);
  assert.match(done.stdout, /Password changed for/u, done.stderr);
  assert.ok(!done.stdout.includes(newPassword), "the password is never echoed");
  assert.notEqual(await hashOf(), originalHash);

  const state = (await pool.query(`SELECT failed_sign_in_count, locked_until FROM product_admin_accounts WHERE user_id = $1`, [adminId])).rows[0];
  assert.equal(state.failed_sign_in_count, 0, "lockout cleared");
  assert.equal(state.locked_until, null);
  const live = await pool.query(`SELECT 1 FROM product_admin_sessions WHERE user_id = $1 AND revoked_at IS NULL`, [adminId]);
  assert.equal(live.rowCount, 0, "signed out everywhere");
  await assert.rejects(signInAdminAccount({ email, password: oldPassword }), /admin_sign_in_failed/u);
  const after = await signInAdminAccount({ email, password: newPassword });
  assert.ok(after.raw_session_token, "signs in with the new password");

  const unknown = await runWithTerminal(["--reset-password", "--email", `nobody_${nonce}@example.com`], []);
  assert.match(unknown.stderr, /No admin account for/u);
});

test("in production, an admin without two-step sign-in can only set it up", { timeout: 120000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const saved = { key: process.env.KOLOSSEUM_ADMIN_TWO_STEP_KEY, nodeEnv: process.env.NODE_ENV };
  process.env.KOLOSSEUM_ADMIN_TWO_STEP_KEY = KEY;
  process.env.NODE_ENV = "production";
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const email = `two_step_prod_${nonce}@example.com`;
  const password = `TwoStepProd-${nonce}`;
  let adminId = "";

  t.after(async () => {
    if (saved.key === undefined) delete process.env.KOLOSSEUM_ADMIN_TWO_STEP_KEY;
    else process.env.KOLOSSEUM_ADMIN_TWO_STEP_KEY = saved.key;
    if (saved.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved.nodeEnv;
    await new Promise((resolve) => server.close(resolve));
    for (const table of ["product_admin_security_events", "product_admin_sign_in_challenges", "product_admin_backup_codes", "product_admin_sessions"]) {
      await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [adminId]).catch(() => {});
    }
    await pool.query(`DELETE FROM product_admin_accounts WHERE user_id = $1`, [adminId]).catch(() => {});
  });

  adminId = (await createAdminAccount(email, "Prod Admin", password)).user_id;
  const signIn = await fetch(`${base}/admin/sign-in`, { method: "POST", headers: { origin: base, "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const body = await signIn.json();
  assert.equal(signIn.status, 200);
  assert.deepEqual({ required: body.two_step.required, enabled: body.two_step.enabled }, { required: true, enabled: false });
  const cookie = signIn.headers.getSetCookie().find((c) => c.startsWith("kolosseum_admin_session=")).split(";")[0];
  const headers = { origin: base, cookie, "x-kolosseum-csrf": body.csrf_token, "content-type": "application/json" };

  const blocked = await fetch(`${base}/admin/accounts?query=x`, { headers });
  assert.equal(blocked.status, 403);
  assert.match(await blocked.text(), /admin_two_step_setup_required/u);
  const blockedErase = await fetch(`${base}/admin/data-rights/deletions/x/erase`, { method: "POST", headers, body: JSON.stringify({ correlation_id: "x" }) });
  assert.equal(blockedErase.status, 403);

  // A reload while set-up is still owed lands back on the set-up screen.
  const owed = await fetch(`${base}/admin/session`, { headers: { cookie } });
  assert.equal(owed.status, 200);
  assert.deepEqual(((b) => ({ required: b.two_step.required, enabled: b.two_step.enabled }))(await owed.json()), { required: true, enabled: false });

  assert.equal((await fetch(`${base}/admin/two-step`, { headers })).status, 200);
  const setup = await (await fetch(`${base}/admin/two-step/setup`, { method: "POST", headers, body: "{}" })).json();
  const secret = base32Decode(setup.secret_base32);
  const confirm = await fetch(`${base}/admin/two-step/setup/confirm`, { method: "POST", headers, body: JSON.stringify({ code: hotp(secret, timeStep(Date.now())) }) });
  assert.equal(confirm.status, 200);
  assert.equal((await fetch(`${base}/admin/accounts?query=x`, { headers })).status, 200, "set up: the console works");

  // Without a key on the server, it can't be required (or set up): the console says so.
  process.env.KOLOSSEUM_ADMIN_TWO_STEP_KEY = "";
  const status = await (await fetch(`${base}/admin/two-step`, { headers })).json();
  assert.deepEqual({ available: status.two_step.available, required: status.two_step.required }, { available: false, required: false });
});

test("a reload keeps the admin signed in: the console gets its session back, and only this site can read it", { timeout: 60000 }, async (t) => {
  const nonce = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const email = `session_restore_${nonce}@example.com`;
  const password = `SessionRestore-${nonce}`;
  const adminId = (await createAdminAccount(email, "Reload Admin", password)).user_id;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await pool.query(`DELETE FROM product_admin_sessions WHERE user_id = $1`, [adminId]).catch(() => {});
    await pool.query(`DELETE FROM product_admin_accounts WHERE user_id = $1`, [adminId]).catch(() => {});
  });

  const signIn = await fetch(`${base}/admin/sign-in`, { method: "POST", headers: { origin: base, "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const signedIn = await signIn.json();
  const cookie = signIn.headers.getSetCookie().find((c) => c.startsWith("kolosseum_admin_session=")).split(";")[0];

  const restored = await fetch(`${base}/admin/session`, { headers: { cookie, "sec-fetch-site": "same-origin" } });
  assert.equal(restored.status, 200);
  assert.equal(restored.headers.get("cache-control"), "no-store");
  const body = await restored.json();
  assert.equal(body.csrf_token, signedIn.csrf_token, "the same token as signing in gave");
  assert.equal(body.admin.display_name, "Reload Admin");
  assert.equal(body.session_expires_at_iso8601, signedIn.session_expires_at_iso8601);
  assert.equal(body.two_step.enabled, false);

  // The restored token works for changes.
  const headers = { origin: base, cookie, "x-kolosseum-csrf": body.csrf_token, "content-type": "application/json" };
  assert.equal((await fetch(`${base}/admin/accounts?query=x`, { headers })).status, 200);

  const crossSite = await fetch(`${base}/admin/session`, { headers: { cookie, "sec-fetch-site": "cross-site" } });
  assert.equal(crossSite.status, 403, "another site's page can't read it");
  assert.ok(!(await crossSite.text()).includes(body.csrf_token));
  assert.equal((await fetch(`${base}/admin/session`)).status, 401, "no cookie, no session");

  assert.equal((await fetch(`${base}/admin/sign-out`, { method: "POST", headers, body: "{}" })).status, 200);
  assert.equal((await fetch(`${base}/admin/session`, { headers: { cookie } })).status, 401, "signed out stays signed out");
});
