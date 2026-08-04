// DEV NOTE: Organisation/team billing commercial expansion (part B) - org
// owner identity and session surface. Wholly separate from
// product_account_service.ts and product_admin_account_service.ts: an org
// owner is never created through /account/register, never resolved through
// resolveProductSession or resolveAdminSession, and never shares a session
// cookie with an athlete, coach, or platform admin. This module never
// imports engine, session-runtime, or relationship/assignment code, and it
// never will - an org owner has no schema path to any athlete-scoped data,
// by construction, not by policy.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";

type JsonRecord = Record<string, unknown>;

export const ORG_OWNER_SESSION_COOKIE = "kolosseum_org_owner_session";
export const ORG_OWNER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_TTL_MS = ORG_OWNER_SESSION_MAX_AGE_SECONDS * 1000;
const MAX_FAILED_SIGN_INS = 8;
const LOCKOUT_MINUTES = 15;

export class OrgOwnerAuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "OrgOwnerAuthError";
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
    throw new OrgOwnerAuthError("org_owner_email_invalid", 400);
  }
  return email;
}

function validatePassword(value: unknown): string {
  const password = typeof value === "string" ? value : "";
  if (password.length < 12 || password.length > 200) {
    throw new OrgOwnerAuthError("org_owner_password_invalid", 400);
  }
  return password;
}

export type OrgOwnerAccountRow = Readonly<{
  user_id: string;
  email_canonical: string;
  display_name: string;
  password_salt: string;
  password_hash: string;
  account_state: "active" | "suspended" | "closed";
  failed_sign_in_count: number;
  locked_until: string | null;
}>;

function mapOrgOwnerAccountRow(value: unknown): OrgOwnerAccountRow | null {
  if (!isRecord(value)) return null;
  const state = value.account_state;
  if (state !== "active" && state !== "suspended" && state !== "closed") return null;

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

async function orgOwnerAccountByEmail(email: string): Promise<OrgOwnerAccountRow | null> {
  const result = await pool.query(
    `SELECT * FROM product_org_owner_accounts WHERE email_canonical = $1 LIMIT 1`,
    [email]
  );
  return mapOrgOwnerAccountRow(result.rows[0]);
}

export async function orgOwnerAccountByUserId(userId: string): Promise<OrgOwnerAccountRow | null> {
  const result = await pool.query(
    `SELECT * FROM product_org_owner_accounts WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return mapOrgOwnerAccountRow(result.rows[0]);
}

// Self-service registration - unlike a platform admin account, an org owner
// is a paying customer and must be able to sign up through a public route.
export async function registerOrgOwnerAccount(
  inputValue: unknown
): Promise<Readonly<{ user_id: string }>> {
  if (!isRecord(inputValue)) {
    throw new OrgOwnerAuthError("org_owner_registration_invalid", 400);
  }

  const email = validateEmail(inputValue.email);
  const displayName = cleanString(inputValue.display_name);
  const password = validatePassword(inputValue.password);

  if (!displayName) {
    throw new OrgOwnerAuthError("org_owner_display_name_required", 400);
  }

  const existing = await orgOwnerAccountByEmail(email);
  if (existing) {
    throw new OrgOwnerAuthError("org_owner_email_already_registered", 409);
  }

  const userId = randomId("org_owner");
  const salt = randomToken(24);
  const hash = await derivePassword(password, salt);

  await pool.query(
    `
    INSERT INTO product_org_owner_accounts (
      user_id, email_canonical, display_name, password_salt, password_hash
    )
    VALUES ($1, $2, $3, $4, $5)
    `,
    [userId, email, displayName, salt, hash]
  );

  return Object.freeze({ user_id: userId });
}

export type OrgOwnerSession = Readonly<{
  raw_session_token: string;
  session_hash: string;
  csrf_token: string;
  expires_at_iso8601: string;
  org_owner: Readonly<{ user_id: string; email: string; display_name: string }>;
}>;

export function orgOwnerCsrfTokenForSession(rawSessionToken: string): string {
  return crypto
    .createHash("sha256")
    .update(`kolosseum-org-owner-csrf:${rawSessionToken}`, "utf8")
    .digest("base64url");
}

function publicOrgOwner(
  row: OrgOwnerAccountRow
): Readonly<{ user_id: string; email: string; display_name: string }> {
  return Object.freeze({
    user_id: row.user_id,
    email: row.email_canonical,
    display_name: row.display_name
  });
}

async function createOrgOwnerSession(row: OrgOwnerAccountRow): Promise<OrgOwnerSession> {
  const rawToken = randomToken(48);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await pool.query(
    `
    INSERT INTO product_org_owner_sessions (session_hash, user_id, expires_at)
    VALUES ($1, $2, $3::timestamptz)
    `,
    [sha256(rawToken), row.user_id, expiresAt]
  );

  return Object.freeze({
    raw_session_token: rawToken,
    session_hash: sha256(rawToken),
    csrf_token: orgOwnerCsrfTokenForSession(rawToken),
    expires_at_iso8601: expiresAt,
    org_owner: publicOrgOwner(row)
  });
}

export async function registerAndSignInOrgOwnerAccount(
  inputValue: unknown
): Promise<OrgOwnerSession> {
  const { user_id } = await registerOrgOwnerAccount(inputValue);
  const row = await orgOwnerAccountByUserId(user_id);
  if (!row) {
    throw new OrgOwnerAuthError("org_owner_registration_failed", 500);
  }
  return createOrgOwnerSession(row);
}

export async function signInOrgOwnerAccount(inputValue: unknown): Promise<OrgOwnerSession> {
  if (!isRecord(inputValue)) {
    throw new OrgOwnerAuthError("org_owner_sign_in_failed", 401);
  }

  let email: string;
  let password: string;
  try {
    email = validateEmail(inputValue.email);
    password = validatePassword(inputValue.password);
  }
  catch {
    throw new OrgOwnerAuthError("org_owner_sign_in_failed", 401);
  }

  const row = await orgOwnerAccountByEmail(email);

  if (!row) {
    // Timing-safe: still do the scrypt derivation on a miss so a missing
    // account and a wrong password take the same amount of time.
    await derivePassword(password, "kolosseum-org-owner-missing-account");
    throw new OrgOwnerAuthError("org_owner_sign_in_failed", 401);
  }

  if (row.locked_until && Date.parse(row.locked_until) > Date.now()) {
    throw new OrgOwnerAuthError("org_owner_temporarily_locked", 429);
  }

  const actualHash = await derivePassword(password, row.password_salt);

  if (!safeEqual(actualHash, row.password_hash)) {
    const failedCount = row.failed_sign_in_count + 1;
    const shouldLock = failedCount >= MAX_FAILED_SIGN_INS;

    await pool.query(
      `
      UPDATE product_org_owner_accounts
      SET failed_sign_in_count = $2,
          locked_until = CASE WHEN $3 THEN now() + interval '${LOCKOUT_MINUTES} minutes' ELSE locked_until END
      WHERE user_id = $1
      `,
      [row.user_id, failedCount, shouldLock]
    );

    throw new OrgOwnerAuthError(
      shouldLock ? "org_owner_temporarily_locked" : "org_owner_sign_in_failed",
      shouldLock ? 429 : 401
    );
  }

  if (row.account_state !== "active") {
    throw new OrgOwnerAuthError("org_owner_account_unavailable", 423);
  }

  await pool.query(
    `UPDATE product_org_owner_accounts SET failed_sign_in_count = 0, locked_until = NULL WHERE user_id = $1`,
    [row.user_id]
  );

  return createOrgOwnerSession(row);
}

export async function resolveOrgOwnerSession(
  rawSessionToken: string
): Promise<Readonly<{ org_owner: Readonly<JsonRecord>; user_id: string }>> {
  if (!rawSessionToken) {
    throw new OrgOwnerAuthError("org_owner_session_missing", 401);
  }

  const sessionHash = sha256(rawSessionToken);

  const result = await pool.query(
    `
    SELECT
      s.expires_at AS session_expires_at,
      a.*
    FROM product_org_owner_sessions s
    JOIN product_org_owner_accounts a ON a.user_id = s.user_id
    WHERE s.session_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
    LIMIT 1
    `,
    [sessionHash]
  );

  const row = mapOrgOwnerAccountRow(result.rows[0]);

  if (!row) {
    throw new OrgOwnerAuthError("org_owner_session_invalid", 401);
  }

  if (row.account_state !== "active") {
    throw new OrgOwnerAuthError("org_owner_account_unavailable", 423);
  }

  await pool.query(
    `UPDATE product_org_owner_sessions SET last_seen_at = now() WHERE session_hash = $1`,
    [sessionHash]
  );

  return Object.freeze({ org_owner: publicOrgOwner(row), user_id: row.user_id });
}

export async function signOutOrgOwnerSession(rawSessionToken: string): Promise<void> {
  if (!rawSessionToken) return;
  await pool.query(
    `UPDATE product_org_owner_sessions SET revoked_at = now() WHERE session_hash = $1 AND revoked_at IS NULL`,
    [sha256(rawSessionToken)]
  );
}

export function assertOrgOwnerCsrf(rawSessionToken: string, suppliedToken: unknown): void {
  const expected = orgOwnerCsrfTokenForSession(rawSessionToken);
  const actual = cleanString(suppliedToken);
  if (!actual || !safeEqual(actual, expected)) {
    throw new OrgOwnerAuthError("org_owner_csrf_invalid", 403);
  }
}
