// DEV NOTE: FULL-UI-21 founder/admin identity and session surface. Wholly
// separate from product_account_service.ts - a founder/admin account is
// never created through /account/register, never resolved through
// resolveProductSession, and never shares a session cookie with an
// athlete or coach. This module never imports engine, session-runtime, or
// relationship/assignment code, and it never will - that is the whole
// point of keeping this identity surface physically separate.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";

type JsonRecord = Record<string, unknown>;

export const ADMIN_SESSION_COOKIE = "kolosseum_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const SESSION_TTL_MS = ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
const MAX_FAILED_SIGN_INS = 8;
const LOCKOUT_MINUTES = 15;

export class AdminAuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/gu, "")}`;
}

function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  if (leftBytes.length !== rightBytes.length) return false;
  return crypto.timingSafeEqual(leftBytes, rightBytes);
}

function derivePassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      64,
      { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(Buffer.from(key).toString("base64url"));
      }
    );
  });
}

function validateEmail(value: unknown): string {
  const email = cleanString(value).toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new AdminAuthError("admin_email_invalid", 400);
  }
  return email;
}

function validatePassword(value: unknown): string {
  const password = typeof value === "string" ? value : "";
  if (password.length < 16 || password.length > 200) {
    throw new AdminAuthError("admin_password_invalid", 400);
  }
  return password;
}

export type AdminAccountRow = Readonly<{
  user_id: string;
  email_canonical: string;
  display_name: string;
  password_salt: string;
  password_hash: string;
  account_state: "active" | "suspended";
  failed_sign_in_count: number;
  locked_until: string | null;
}>;

function mapAdminAccountRow(value: unknown): AdminAccountRow | null {
  if (!isRecord(value)) return null;
  const state = value.account_state;
  if (state !== "active" && state !== "suspended") return null;

  return Object.freeze({
    user_id: cleanString(value.user_id),
    email_canonical: cleanString(value.email_canonical),
    display_name: cleanString(value.display_name),
    password_salt: cleanString(value.password_salt),
    password_hash: cleanString(value.password_hash),
    account_state: state,
    failed_sign_in_count: Number(value.failed_sign_in_count ?? 0),
    locked_until: value.locked_until instanceof Date ? value.locked_until.toISOString() : null
  });
}

async function adminAccountByEmail(email: string): Promise<AdminAccountRow | null> {
  const result = await pool.query(
    `SELECT * FROM product_admin_accounts WHERE email_canonical = $1 LIMIT 1`,
    [email]
  );
  return mapAdminAccountRow(result.rows[0]);
}

export async function adminAccountByUserId(userId: string): Promise<AdminAccountRow | null> {
  const result = await pool.query(
    `SELECT * FROM product_admin_accounts WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return mapAdminAccountRow(result.rows[0]);
}

// Never exposed over HTTP. Intended to be called exactly once, from
// scripts/bootstrap_admin_account.mjs, itself gated behind an operator-set
// environment variable and run manually - never from a public route.
export async function createAdminAccount(
  email: string,
  displayName: string,
  password: string
): Promise<Readonly<{ user_id: string }>> {
  const cleanEmail = validateEmail(email);
  const cleanName = cleanString(displayName);
  const cleanPassword = validatePassword(password);

  if (!cleanName) {
    throw new AdminAuthError("admin_display_name_required", 400);
  }

  const existing = await adminAccountByEmail(cleanEmail);
  if (existing) {
    throw new AdminAuthError("admin_email_already_registered", 409);
  }

  const userId = randomId("admin");
  const salt = randomToken(24);
  const hash = await derivePassword(cleanPassword, salt);

  await pool.query(
    `
    INSERT INTO product_admin_accounts (
      user_id, email_canonical, display_name, password_salt, password_hash
    )
    VALUES ($1, $2, $3, $4, $5)
    `,
    [userId, cleanEmail, cleanName, salt, hash]
  );

  return Object.freeze({ user_id: userId });
}

export type AdminSession = Readonly<{
  raw_session_token: string;
  session_hash: string;
  csrf_token: string;
  expires_at_iso8601: string;
  admin: Readonly<{ user_id: string; email: string; display_name: string }>;
}>;

export function adminCsrfTokenForSession(rawSessionToken: string): string {
  return crypto
    .createHash("sha256")
    .update(`kolosseum-admin-csrf:${rawSessionToken}`, "utf8")
    .digest("base64url");
}

function publicAdmin(
  row: AdminAccountRow
): Readonly<{ user_id: string; email: string; display_name: string }> {
  return Object.freeze({
    user_id: row.user_id,
    email: row.email_canonical,
    display_name: row.display_name
  });
}

async function createAdminSession(row: AdminAccountRow): Promise<AdminSession> {
  const rawToken = randomToken(48);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await pool.query(
    `
    INSERT INTO product_admin_sessions (session_hash, user_id, expires_at)
    VALUES ($1, $2, $3::timestamptz)
    `,
    [sha256(rawToken), row.user_id, expiresAt]
  );

  return Object.freeze({
    raw_session_token: rawToken,
    session_hash: sha256(rawToken),
    csrf_token: adminCsrfTokenForSession(rawToken),
    expires_at_iso8601: expiresAt,
    admin: publicAdmin(row)
  });
}

export async function signInAdminAccount(inputValue: unknown): Promise<AdminSession> {
  if (!isRecord(inputValue)) {
    throw new AdminAuthError("admin_sign_in_failed", 401);
  }

  let email: string;
  let password: string;
  try {
    email = validateEmail(inputValue.email);
    password = validatePassword(inputValue.password);
  }
  catch {
    throw new AdminAuthError("admin_sign_in_failed", 401);
  }

  const row = await adminAccountByEmail(email);

  if (!row) {
    // Timing-safe: still do the scrypt derivation on a miss so a missing
    // account and a wrong password take the same amount of time.
    await derivePassword(password, "kolosseum-admin-missing-account");
    throw new AdminAuthError("admin_sign_in_failed", 401);
  }

  if (row.locked_until && Date.parse(row.locked_until) > Date.now()) {
    throw new AdminAuthError("admin_temporarily_locked", 429);
  }

  const actualHash = await derivePassword(password, row.password_salt);

  if (!safeEqual(actualHash, row.password_hash)) {
    const failedCount = row.failed_sign_in_count + 1;
    const shouldLock = failedCount >= MAX_FAILED_SIGN_INS;

    await pool.query(
      `
      UPDATE product_admin_accounts
      SET failed_sign_in_count = $2,
          locked_until = CASE WHEN $3 THEN now() + interval '${LOCKOUT_MINUTES} minutes' ELSE locked_until END
      WHERE user_id = $1
      `,
      [row.user_id, failedCount, shouldLock]
    );

    throw new AdminAuthError(
      shouldLock ? "admin_temporarily_locked" : "admin_sign_in_failed",
      shouldLock ? 429 : 401
    );
  }

  if (row.account_state !== "active") {
    throw new AdminAuthError("admin_account_unavailable", 423);
  }

  await pool.query(
    `UPDATE product_admin_accounts SET failed_sign_in_count = 0, locked_until = NULL WHERE user_id = $1`,
    [row.user_id]
  );

  return createAdminSession(row);
}

export async function resolveAdminSession(
  rawSessionToken: string
): Promise<Readonly<{ admin: Readonly<JsonRecord>; user_id: string }>> {
  if (!rawSessionToken) {
    throw new AdminAuthError("admin_session_missing", 401);
  }

  const sessionHash = sha256(rawSessionToken);

  const result = await pool.query(
    `
    SELECT
      s.expires_at AS session_expires_at,
      a.*
    FROM product_admin_sessions s
    JOIN product_admin_accounts a ON a.user_id = s.user_id
    WHERE s.session_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
    LIMIT 1
    `,
    [sessionHash]
  );

  const row = mapAdminAccountRow(result.rows[0]);

  if (!row) {
    throw new AdminAuthError("admin_session_invalid", 401);
  }

  if (row.account_state !== "active") {
    throw new AdminAuthError("admin_account_unavailable", 423);
  }

  await pool.query(
    `UPDATE product_admin_sessions SET last_seen_at = now() WHERE session_hash = $1`,
    [sessionHash]
  );

  return Object.freeze({ admin: publicAdmin(row), user_id: row.user_id });
}

export async function signOutAdminSession(rawSessionToken: string): Promise<void> {
  if (!rawSessionToken) return;
  await pool.query(
    `UPDATE product_admin_sessions SET revoked_at = now() WHERE session_hash = $1 AND revoked_at IS NULL`,
    [sha256(rawSessionToken)]
  );
}

export function assertAdminCsrf(rawSessionToken: string, suppliedToken: unknown): void {
  const expected = adminCsrfTokenForSession(rawSessionToken);
  const actual = cleanString(suppliedToken);
  if (!actual || !safeEqual(actual, expected)) {
    throw new AdminAuthError("admin_csrf_invalid", 403);
  }
}
