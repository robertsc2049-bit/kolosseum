// Two-step sign-in for the admin console. The admin account can erase
// anyone's data, read reported messages and restrict accounts, so a password
// alone isn't enough: after the password, the admin enters a 6-digit code
// from an authenticator app (RFC 6238 TOTP: HMAC-SHA1, 30-second steps, one
// step of clock drift either way), or one of 8 single-use backup codes.
//
// - The authenticator secret is stored encrypted (AES-256-GCM) with a key
//   from KOLOSSEUM_ADMIN_TWO_STEP_KEY, so a copy of the database alone
//   doesn't give it away. Without that key two-step sign-in is unavailable.
// - Backup codes are stored hashed and work once.
// - A code is accepted once: totp_last_step rejects a replay of the same
//   (or an earlier) code.
// - In production (NODE_ENV=production, key set), an admin without it set
//   up can only reach the set-up routes (product_admin_auth.ts).
// - A locked-out admin is reset by the operator over SSH:
//   scripts/bootstrap_admin_account.mjs --reset-two-step.
import crypto from "node:crypto";

import qrcode from "qrcode-generator";

import { pool } from "../db/pool.js";

export const BACKUP_CODE_COUNT = 8;
const STEP_SECONDS = 30;
const DIGITS = 6;
const DRIFT_STEPS = 1;
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const MAX_CHALLENGE_ATTEMPTS = 5;
const ISSUER = "Kolosseum admin";

export type SecurityEventType = "two_step_turned_on" | "backup_code_used" | "backup_codes_replaced" | "two_step_reset";

// --- Configuration -------------------------------------------------------

function twoStepKey(): Buffer | null {
  const raw = process.env.KOLOSSEUM_ADMIN_TWO_STEP_KEY ?? "";
  if (raw.trim().length < 32) return null;
  return crypto.createHash("sha256").update(`kolosseum-admin-two-step:${raw.trim()}`, "utf8").digest();
}

export function twoStepAvailable(): boolean {
  return twoStepKey() !== null;
}

// Required for every admin in production once the server has a key.
export function twoStepRequired(): boolean {
  return process.env.NODE_ENV === "production" && twoStepAvailable();
}

// --- Encryption at rest --------------------------------------------------

export function encryptSecret(secret: Buffer): string {
  const key = twoStepKey();
  if (!key) throw new Error("admin_two_step_unavailable");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(secret), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(":");
}

export function decryptSecret(stored: string): Buffer {
  const key = twoStepKey();
  const [version, iv, tag, body] = stored.split(":");
  if (!key || version !== "v1" || !iv || !tag || !body) throw new TwoStepError("admin_two_step_unavailable", 503);
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]);
  }
  catch {
    // A different key from the one it was set up with.
    throw new TwoStepError("admin_two_step_unavailable", 503);
  }
}

// --- TOTP ----------------------------------------------------------------

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function hotp(secret: Buffer, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", secret).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(binary).padStart(DIGITS, "0");
}

export const timeStep = (nowMs: number) => Math.floor(nowMs / 1000 / STEP_SECONDS);

// The matching step, or null. Only steps after lastStep count, so a code
// that was already used can't be used again.
export function matchTotp(secret: Buffer, code: string, nowMs: number, lastStep: number | null): number | null {
  if (!/^\d{6}$/u.test(code)) return null;
  const current = timeStep(nowMs);
  let found: number | null = null;
  for (let step = current - DRIFT_STEPS; step <= current + DRIFT_STEPS; step += 1) {
    if (lastStep !== null && step <= lastStep) continue;
    const expected = Buffer.from(hotp(secret, step));
    if (crypto.timingSafeEqual(expected, Buffer.from(code)) && found === null) found = step;
  }
  return found;
}

export function otpauthUri(email: string, secretBase32: string): string {
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

export function qrSvg(text: string): string {
  const code = qrcode(0, "M");
  code.addData(text, "Byte");
  code.make();
  const modules = code.getModuleCount();
  const quiet = 4;
  const size = modules + quiet * 2;
  const path: string[] = [];
  for (let y = 0; y < modules; y += 1) {
    for (let x = 0; x < modules; x += 1) {
      if (code.isDark(y, x)) path.push(`M${x + quiet} ${y + quiet}h1v1h-1z`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size * 5}" height="${size * 5}" shape-rendering="crispEdges" role="img" aria-label="QR code for your authenticator app">`
    + `<rect width="${size}" height="${size}" fill="#fff"/><path fill="#000" d="${path.join("")}"/></svg>`;
}

// --- Backup codes --------------------------------------------------------

const BACKUP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function backupCode(): string {
  let out = "";
  for (let i = 0; i < 10; i += 1) out += BACKUP_ALPHABET[crypto.randomInt(BACKUP_ALPHABET.length)];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export const normaliseCode = (value: unknown) => (typeof value === "string" ? value.toLowerCase().replace(/[\s-]/gu, "") : "");

const codeHash = (normalised: string) => crypto.createHash("sha256").update(`kolosseum-admin-backup:${normalised}`, "utf8").digest("hex");

type Queryable = { query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }> };

async function replaceBackupCodes(client: Queryable, userId: string): Promise<string[]> {
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, backupCode);
  await client.query(`DELETE FROM product_admin_backup_codes WHERE user_id = $1`, [userId]);
  for (const code of codes) {
    await client.query(`INSERT INTO product_admin_backup_codes (user_id, code_hash) VALUES ($1, $2)`, [userId, codeHash(normaliseCode(code))]);
  }
  return codes;
}

async function logEvent(client: Queryable, userId: string, eventType: SecurityEventType): Promise<void> {
  await client.query(
    `INSERT INTO product_admin_security_events (event_id, user_id, event_type) VALUES ($1, $2, $3)`,
    [`admin_security_${crypto.randomUUID().replace(/-/gu, "")}`, userId, eventType]
  );
}

// --- Account state -------------------------------------------------------

type TwoStepRow = { secret: string | null; pending: string | null; enabled_at: Date | null; last_step: number | null; email: string };

async function twoStepRow(userId: string): Promise<TwoStepRow | null> {
  const result = await pool.query(
    `SELECT totp_secret_encrypted, totp_pending_secret_encrypted, totp_enabled_at, totp_last_step, email_canonical
       FROM product_admin_accounts WHERE user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    secret: row.totp_secret_encrypted ?? null,
    pending: row.totp_pending_secret_encrypted ?? null,
    enabled_at: row.totp_enabled_at ?? null,
    last_step: row.totp_last_step === null || row.totp_last_step === undefined ? null : Number(row.totp_last_step),
    email: String(row.email_canonical)
  };
}

export async function twoStepEnabled(userId: string): Promise<boolean> {
  const row = await twoStepRow(userId);
  return !!row?.enabled_at && !!row.secret;
}

export async function twoStepStatus(userId: string) {
  const row = await twoStepRow(userId);
  const codes = await pool.query(
    `SELECT count(*)::int AS left FROM product_admin_backup_codes WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );
  const events = await pool.query(
    `SELECT event_type, created_at FROM product_admin_security_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
    [userId]
  );
  return {
    available: twoStepAvailable(),
    required: twoStepRequired(),
    enabled: !!row?.enabled_at && !!row.secret,
    enabled_at_iso8601: row?.enabled_at ? new Date(row.enabled_at).toISOString() : null,
    backup_codes_left: Number(codes.rows[0]?.left ?? 0),
    recent_events: events.rows.map((e) => ({ event_type: String(e.event_type), at_iso8601: new Date(e.created_at as string).toISOString() }))
  };
}

export class TwoStepError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = "TwoStepError";
  }
}

// Step 1 of setting up: a new secret, kept as "pending" until the admin
// proves their app has it by entering a code.
export async function startTwoStepSetup(userId: string) {
  if (!twoStepAvailable()) throw new TwoStepError("admin_two_step_unavailable", 503);
  const row = await twoStepRow(userId);
  if (!row) throw new TwoStepError("admin_session_invalid", 401);
  if (row.enabled_at && row.secret) throw new TwoStepError("admin_two_step_already_on", 409);
  const secret = crypto.randomBytes(20);
  await pool.query(`UPDATE product_admin_accounts SET totp_pending_secret_encrypted = $2 WHERE user_id = $1`, [userId, encryptSecret(secret)]);
  const secretBase32 = base32Encode(secret);
  const uri = otpauthUri(row.email, secretBase32);
  return { secret_base32: secretBase32, otpauth_uri: uri, qr_svg: qrSvg(uri) };
}

// Step 2: the code matches, so two-step sign-in is on. Every other session
// for this admin is signed out, and the admin gets their backup codes (shown
// once).
export async function confirmTwoStepSetup(userId: string, currentSessionHash: string, codeValue: unknown, nowMs = Date.now()) {
  const row = await twoStepRow(userId);
  if (!row?.pending) throw new TwoStepError("admin_two_step_setup_not_started", 409);
  if (row.enabled_at && row.secret) throw new TwoStepError("admin_two_step_already_on", 409);
  const step = matchTotp(decryptSecret(row.pending), normaliseCode(codeValue), nowMs, null);
  if (step === null) throw new TwoStepError("admin_two_step_code_invalid", 400);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE product_admin_accounts
          SET totp_secret_encrypted = totp_pending_secret_encrypted, totp_pending_secret_encrypted = NULL,
              totp_enabled_at = now(), totp_last_step = $2
        WHERE user_id = $1 AND totp_pending_secret_encrypted = $3 AND totp_enabled_at IS NULL`,
      [userId, step, row.pending]
    );
    if ((updated.rowCount ?? 0) === 0) throw new TwoStepError("admin_two_step_already_on", 409);
    const codes = await replaceBackupCodes(client, userId);
    await client.query(
      `UPDATE product_admin_sessions SET revoked_at = now() WHERE user_id = $1 AND session_hash <> $2 AND revoked_at IS NULL`,
      [userId, currentSessionHash]
    );
    await logEvent(client, userId, "two_step_turned_on");
    await client.query("COMMIT");
    return { backup_codes: codes };
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
  finally {
    client.release();
  }
}

// Checks a sign-in code: an authenticator code (once only), or an unused
// backup code (then used up). Returns how it was proven, or null.
export async function verifySignInCode(userId: string, codeValue: unknown, nowMs = Date.now()): Promise<"authenticator" | "backup_code" | null> {
  const row = await twoStepRow(userId);
  if (!row?.secret || !row.enabled_at) return null;
  const code = normaliseCode(codeValue);
  if (/^\d{6}$/u.test(code)) {
    // The key was removed or changed after set-up: authenticator codes can't
    // be checked (backup codes still work; the operator can reset it).
    if (!twoStepAvailable()) throw new TwoStepError("admin_two_step_unavailable", 503);
    const step = matchTotp(decryptSecret(row.secret), code, nowMs, row.last_step);
    if (step === null) return null;
    const claimed = await pool.query(
      `UPDATE product_admin_accounts SET totp_last_step = $2 WHERE user_id = $1 AND (totp_last_step IS NULL OR totp_last_step < $2)`,
      [userId, step]
    );
    return (claimed.rowCount ?? 0) > 0 ? "authenticator" : null;
  }
  if (code.length !== 10) return null;
  const used = await pool.query(
    `UPDATE product_admin_backup_codes SET used_at = now() WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL`,
    [userId, codeHash(code)]
  );
  if ((used.rowCount ?? 0) === 0) return null;
  await logEvent(pool, userId, "backup_code_used");
  return "backup_code";
}

// New backup codes (the old ones stop working). Needs a current
// authenticator code, not a backup code.
export async function replaceBackupCodesWithCode(userId: string, codeValue: unknown, nowMs = Date.now()) {
  const code = normaliseCode(codeValue);
  if (!/^\d{6}$/u.test(code)) throw new TwoStepError("admin_two_step_code_invalid", 400);
  if ((await verifySignInCode(userId, code, nowMs)) !== "authenticator") throw new TwoStepError("admin_two_step_code_invalid", 400);
  const codes = await replaceBackupCodes(pool, userId);
  await logEvent(pool, userId, "backup_codes_replaced");
  return { backup_codes: codes };
}

// --- The pending sign-in between password and code ------------------------

const tokenHash = (token: string) => crypto.createHash("sha256").update(token, "utf8").digest("hex");

export async function createSignInChallenge(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO product_admin_sign_in_challenges (challenge_hash, user_id, expires_at) VALUES ($1, $2, $3::timestamptz)`,
    [tokenHash(token), userId, new Date(Date.now() + CHALLENGE_TTL_MS).toISOString()]
  );
  return token;
}

export async function openChallenge(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || !token) return null;
  const result = await pool.query(
    `SELECT user_id FROM product_admin_sign_in_challenges
      WHERE challenge_hash = $1 AND used_at IS NULL AND expires_at > now() AND failed_attempts < $2`,
    [tokenHash(token), MAX_CHALLENGE_ATTEMPTS]
  );
  return result.rows[0] ? String(result.rows[0].user_id) : null;
}

export async function failChallenge(token: string): Promise<void> {
  await pool.query(`UPDATE product_admin_sign_in_challenges SET failed_attempts = failed_attempts + 1 WHERE challenge_hash = $1`, [tokenHash(token)]);
}

// Used once: a second request with the same token gets nothing.
export async function useChallenge(token: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE product_admin_sign_in_challenges SET used_at = now() WHERE challenge_hash = $1 AND used_at IS NULL`,
    [tokenHash(token)]
  );
  return (result.rowCount ?? 0) > 0;
}
