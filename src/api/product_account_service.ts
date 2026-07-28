// DEV NOTE: FULL-UI-02 persistent product identity and account access.
// Account metadata cannot alter deterministic engine inputs, outputs or registry law.

import crypto from "node:crypto";

import { pool } from "../db/pool.js";
import {
  createBeta16AcknowledgementRecord,
  createBeta16AuthRecord,
  createBeta16Phase1DeclarationRecord
} from "./beta16_app_path_service.js";
import {
  createBeta17CoachProfileRecord
} from "./beta17_coach_managed_service.js";
import {
  persistBetaProductRecord
} from "./beta_product_record_store.js";

type JsonRecord = Record<string, unknown>;
type ActorType = "athlete" | "coach";
type AccountState = "active" | "suspended" | "closed" | "deleted";
type ChallengeType = "email_verification" | "password_reset";

type AccountRow = Readonly<{
  user_id: string;
  email_canonical: string;
  display_name: string;
  actor_type: ActorType;
  account_state: AccountState;
  password_salt: string;
  password_hash: string;
  email_verified_at: string | null;
  accepted_terms_version: string;
  accepted_consent_version: string;
  failed_sign_in_count: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}>;

export type ProductAccountSession = Readonly<{
  account: Readonly<JsonRecord>;
  bootstrap: Readonly<JsonRecord>;
  raw_session_token: string;
  csrf_token: string;
  expires_at_iso8601: string;
}>;

export class ProductAccountError extends Error {
  readonly code: string;
  readonly status: number;
  readonly account_state?: AccountState;

  constructor(
    code: string,
    status = 400,
    accountState?: AccountState
  ) {
    super(code);
    this.name = "ProductAccountError";
    this.code = code;
    this.status = status;
    this.account_state = accountState;
  }
}

export const PRODUCT_SESSION_COOKIE = "kolosseum_session";
export const PRODUCT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const CURRENT_TERMS_VERSION = "terms_v1";
export const CURRENT_CONSENT_VERSION = "consent_v1";

export function getCurrentProductTerms(): Readonly<JsonRecord> {
  return Object.freeze({
    current_terms_version:
      CURRENT_TERMS_VERSION,
    current_consent_version:
      CURRENT_CONSENT_VERSION,
    source: "server_authoritative_product_configuration",
    acceptance_required: true
  });
}

const PASSWORD_MIN_LENGTH = 12;
const SESSION_TTL_MS = PRODUCT_SESSION_MAX_AGE_SECONDS * 1000;
const CHALLENGE_TTL_MS = 30 * 60 * 1000;
const LOCKOUT_TTL_MS = 15 * 60 * 1000;
const MAX_FAILED_SIGN_INS = 5;

function isRecord(value: unknown): value is JsonRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validateEmail(value: unknown): string {
  const email = cleanString(value).toLowerCase();

  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
  ) {
    throw new ProductAccountError("account_email_invalid");
  }

  return email;
}

function validateDisplayName(value: unknown): string {
  const name = cleanString(value);

  if (!name || name.length > 80) {
    throw new ProductAccountError("account_display_name_invalid");
  }

  return name;
}

function validatePassword(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < PASSWORD_MIN_LENGTH
  ) {
    throw new ProductAccountError("account_password_too_short");
  }

  if (value.length > 200) {
    throw new ProductAccountError("account_password_too_long");
  }

  return value;
}

function validateActorType(value: unknown): ActorType {
  if (value !== "athlete" && value !== "coach") {
    throw new ProductAccountError("account_actor_type_invalid");
  }

  return value;
}

function validateActivity(
  value: unknown
): string {
  const activity = cleanString(value);

  if (
    activity !== "powerlifting" &&
    activity !== "general_strength" &&
    activity !== "rugby_union"
  ) {
    throw new ProductAccountError(
      "account_activity_invalid"
    );
  }

  return activity;
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/gu, "")}`;
}

function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

function sha256(value: string): string {
  return crypto
    .createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");

  if (leftBytes.length !== rightBytes.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBytes, rightBytes);
}

function derivePassword(
  password: string,
  salt: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      64,
      {
        N: 16384,
        r: 8,
        p: 1,
        maxmem: 64 * 1024 * 1024
      },
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

async function newPasswordRecord(
  password: string
): Promise<Readonly<{ salt: string; hash: string }>> {
  const salt = randomToken(24);

  return Object.freeze({
    salt,
    hash: await derivePassword(password, salt)
  });
}

function mapAccountRow(value: unknown): AccountRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const actor = value.actor_type;
  const state = value.account_state;

  if (
    (actor !== "athlete" && actor !== "coach") ||
    (
      state !== "active" &&
      state !== "suspended" &&
      state !== "closed" &&
      state !== "deleted"
    )
  ) {
    return null;
  }

  return Object.freeze({
    user_id: String(value.user_id ?? ""),
    email_canonical: String(value.email_canonical ?? ""),
    display_name: String(value.display_name ?? ""),
    actor_type: actor,
    account_state: state,
    password_salt: String(value.password_salt ?? ""),
    password_hash: String(value.password_hash ?? ""),
    email_verified_at:
      value.email_verified_at === null ||
      typeof value.email_verified_at === "undefined"
        ? null
        : String(value.email_verified_at),
    accepted_terms_version:
      String(value.accepted_terms_version ?? ""),
    accepted_consent_version:
      String(value.accepted_consent_version ?? ""),
    failed_sign_in_count:
      Number(value.failed_sign_in_count ?? 0),
    locked_until:
      value.locked_until === null ||
      typeof value.locked_until === "undefined"
        ? null
        : String(value.locked_until),
    created_at: String(value.created_at ?? ""),
    updated_at: String(value.updated_at ?? "")
  });
}

function publicAccount(row: AccountRow): Readonly<JsonRecord> {
  return Object.freeze({
    user_id: row.user_id,
    email: row.email_canonical,
    display_name: row.display_name,
    actor_type: row.actor_type,
    actor_home_route:
      row.actor_type === "coach"
        ? "#/coach/overview"
        : "#/athlete/today",
    account_state: row.account_state,
    email_verified: Boolean(row.email_verified_at),
    email_verified_at_iso8601: row.email_verified_at,
    accepted_terms_version: row.accepted_terms_version,
    accepted_consent_version: row.accepted_consent_version,
    current_terms_version: CURRENT_TERMS_VERSION,
    current_consent_version: CURRENT_CONSENT_VERSION,
    created_at_iso8601: row.created_at,
    updated_at_iso8601: row.updated_at
  });
}

async function accountBy(
  column: "user_id" | "email_canonical",
  value: string
): Promise<AccountRow | null> {
  const result = await pool.query(
    `
    SELECT
      user_id,
      email_canonical,
      display_name,
      actor_type,
      account_state,
      password_salt,
      password_hash,
      email_verified_at,
      accepted_terms_version,
      accepted_consent_version,
      failed_sign_in_count,
      locked_until,
      created_at,
      updated_at
    FROM product_accounts
    WHERE ${column} = $1
    LIMIT 1
    `,
    [value]
  );

  return mapAccountRow(result.rows?.[0]);
}

async function recordAccountEvent(
  userId: string,
  eventType: string,
  payload: JsonRecord = {}
): Promise<void> {
  await pool.query(
    `
    INSERT INTO product_account_events (
      event_id,
      user_id,
      event_type,
      event_payload,
      occurred_at
    )
    VALUES ($1, $2, $3, $4::jsonb, now())
    `,
    [
      randomId("account_event"),
      userId,
      eventType,
      JSON.stringify(payload)
    ]
  );
}

async function createChallenge(
  userId: string,
  challengeType: ChallengeType
): Promise<Readonly<{
  code: string;
  expires_at_iso8601: string;
}>> {
  const code = String(
    crypto.randomInt(0, 1000000)
  ).padStart(6, "0");

  const expiresAt = new Date(
    Date.now() + CHALLENGE_TTL_MS
  ).toISOString();

  await pool.query(
    `
    UPDATE product_auth_challenges
    SET consumed_at = now()
    WHERE
      user_id = $1
      AND challenge_type = $2
      AND consumed_at IS NULL
    `,
    [userId, challengeType]
  );

  await pool.query(
    `
    INSERT INTO product_auth_challenges (
      challenge_id,
      user_id,
      challenge_type,
      token_hash,
      created_at,
      expires_at,
      consumed_at
    )
    VALUES ($1, $2, $3, $4, now(), $5::timestamptz, NULL)
    `,
    [
      randomId("challenge"),
      userId,
      challengeType,
      sha256(code),
      expiresAt
    ]
  );

  return Object.freeze({
    code,
    expires_at_iso8601: expiresAt
  });
}

async function consumeChallenge(
  userId: string,
  challengeType: ChallengeType,
  suppliedCode: unknown
): Promise<void> {
  const code = cleanString(suppliedCode);

  if (!/^\d{6}$/u.test(code)) {
    throw new ProductAccountError("account_challenge_invalid");
  }

  const result = await pool.query(
    `
    SELECT challenge_id, token_hash
    FROM product_auth_challenges
    WHERE
      user_id = $1
      AND challenge_type = $2
      AND consumed_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [userId, challengeType]
  );

  const challenge = result.rows?.[0];

  if (
    !challenge ||
    !safeEqual(
      sha256(code),
      String(challenge.token_hash ?? "")
    )
  ) {
    throw new ProductAccountError("account_challenge_invalid");
  }

  await pool.query(
    `
    UPDATE product_auth_challenges
    SET consumed_at = now()
    WHERE challenge_id = $1
    `,
    [challenge.challenge_id]
  );
}

export function csrfTokenForSession(
  rawSessionToken: string
): string {
  return crypto
    .createHash("sha256")
    .update(`kolosseum-csrf:${rawSessionToken}`, "utf8")
    .digest("base64url");
}

async function createSession(
  row: AccountRow,
  userAgent: string
): Promise<ProductAccountSession> {
  const rawToken = randomToken(48);
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_MS
  ).toISOString();

  await pool.query(
    `
    INSERT INTO product_auth_sessions (
      session_hash,
      user_id,
      created_at,
      last_seen_at,
      expires_at,
      revoked_at,
      user_agent_hash
    )
    VALUES ($1, $2, now(), now(), $3::timestamptz, NULL, $4)
    `,
    [
      sha256(rawToken),
      row.user_id,
      expiresAt,
      sha256(userAgent || "unknown")
    ]
  );

  await recordAccountEvent(
    row.user_id,
    "session_created",
    { expires_at_iso8601: expiresAt }
  );

  return Object.freeze({
    account: publicAccount(row),
    bootstrap:
      await loadProductBootstrap(
        row.user_id,
        row.actor_type
      ),
    raw_session_token: rawToken,
    csrf_token: csrfTokenForSession(rawToken),
    expires_at_iso8601: expiresAt
  });
}

async function existingBetaIdentity(
  email: string
): Promise<Readonly<{
  user_id: string;
  actor_type: ActorType;
}> | null> {
  const result = await pool.query(
    `
    SELECT record_type, record_payload
    FROM beta_product_records
    WHERE
      lower(record_payload ->> 'email') = $1
      AND record_type IN (
        'beta16_auth',
        'beta17_coach_profile'
      )
    ORDER BY effective_at DESC, created_at DESC
    LIMIT 1
    `,
    [email]
  );

  const record = result.rows?.[0];

  if (!isRecord(record?.record_payload)) {
    return null;
  }

  const payload = record.record_payload;

  if (record.record_type === "beta17_coach_profile") {
    const userId = cleanString(payload.coach_user_id);

    return userId
      ? Object.freeze({
          user_id: userId,
          actor_type: "coach"
        })
      : null;
  }

  const userId = cleanString(payload.user_id);

  return userId
    ? Object.freeze({
        user_id: userId,
        actor_type: "athlete"
      })
    : null;
}


async function loadProductBootstrap(
  userId: string,
  actor: ActorType
): Promise<Readonly<JsonRecord>> {
  const result = await pool.query(
    `
    SELECT DISTINCT ON (record_type)
      record_type,
      record_payload
    FROM beta_product_records
    WHERE
      subject_user_id = $1
      AND record_type IN (
        'beta16_auth',
        'beta16_acknowledgement',
        'beta16_phase1_declaration',
        'beta17_coach_profile'
      )
    ORDER BY
      record_type,
      effective_at DESC,
      created_at DESC
    `,
    [userId]
  );

  const byType =
    new Map<string, JsonRecord>();

  for (const row of result.rows ?? []) {
    if (isRecord(row?.record_payload)) {
      byType.set(
        String(row.record_type),
        row.record_payload
      );
    }
  }

  if (actor === "coach") {
    return Object.freeze({
      coach_profile:
        byType.get(
          "beta17_coach_profile"
        ) ?? null
    });
  }

  return Object.freeze({
    auth_record:
      byType.get("beta16_auth") ??
      null,
    acknowledgement_record:
      byType.get(
        "beta16_acknowledgement"
      ) ?? null,
    declaration_record:
      byType.get(
        "beta16_phase1_declaration"
      ) ?? null
  });
}

function phase1Input(
  activity: string
): Readonly<JsonRecord> {
  return Object.freeze({
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: activity,
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none"
  });
}

async function persistInitialProductRecords(
  userId: string,
  actor: ActorType,
  email: string,
  name: string,
  activity: string | null
): Promise<void> {
  const existing =
    await loadProductBootstrap(
      userId,
      actor
    );

  if (actor === "coach") {
    if (
      isRecord(
        existing.coach_profile
      )
    ) {
      return;
    }

    const result =
      createBeta17CoachProfileRecord({
        coach_user_id: userId,
        email,
        display_name: name,
        account_role: "coach",
        account_state: "active",
        accepted_terms_version:
          CURRENT_TERMS_VERSION,
        created_at_iso8601:
          new Date().toISOString()
      });

    if (result.status !== 201) {
      throw new ProductAccountError(
        String(
          result.body.reason ??
          "account_coach_profile_failed"
        )
      );
    }

    await persistBetaProductRecord(
      result.body.coach_profile
    );

    return;
  }

  const athleteActivity =
    validateActivity(activity);

  if (
    !isRecord(
      existing.auth_record
    )
  ) {
    const result =
      createBeta16AuthRecord({
        user_id: userId,
        email,
        display_name: name,
        account_role: "athlete",
        account_state: "active",
        accepted_terms_version:
          CURRENT_TERMS_VERSION,
        created_at_iso8601:
          new Date().toISOString()
      });

    if (result.status !== 201) {
      throw new ProductAccountError(
        String(
          result.body.reason ??
          "account_athlete_auth_failed"
        )
      );
    }

    await persistBetaProductRecord(
      result.body.auth_record
    );
  }

  if (
    !isRecord(
      existing.acknowledgement_record
    )
  ) {
    const result =
      createBeta16AcknowledgementRecord({
        acknowledgement_id:
          randomId("acknowledgement"),
        user_id: userId,
        beta_id:
          "september_beta_2026",
        accepted: true,
        jurisdiction_acknowledged: true,
        accepted_at_iso8601:
          new Date().toISOString(),
        copy_acknowledgement_id:
          "BETA16_COPY_ACKNOWLEDGEMENT_LABEL"
      });

    if (result.status !== 201) {
      throw new ProductAccountError(
        String(
          result.body.reason ??
          "account_acknowledgement_failed"
        )
      );
    }

    await persistBetaProductRecord(
      result.body
        .acknowledgement_record
    );
  }

  if (
    !isRecord(
      existing.declaration_record
    )
  ) {
    const result =
      createBeta16Phase1DeclarationRecord({
        declaration_id:
          randomId("declaration"),
        user_id: userId,
        phase1_input:
          phase1Input(
            athleteActivity
          ),
        jurisdiction_acknowledged: true,
        declared_at_iso8601:
          new Date().toISOString(),
        accepted_terms_version:
          CURRENT_TERMS_VERSION,
        copy_acknowledgement_id:
          "BETA16_COPY_DECLARATION_ACKNOWLEDGEMENT"
      });

    if (result.status !== 201) {
      throw new ProductAccountError(
        String(
          result.body.reason ??
          "account_declaration_failed"
        )
      );
    }

    await persistBetaProductRecord(
      result.body.declaration_record
    );
  }
}

export async function registerProductAccount(
  input: unknown,
  userAgent: string
): Promise<Readonly<{
  session: ProductAccountSession;
  verification: Readonly<JsonRecord>;
  claimed_existing_identity: boolean;
}>> {
  if (!isRecord(input)) {
    throw new ProductAccountError("account_registration_invalid");
  }

  const email = validateEmail(input.email);
  const name = validateDisplayName(input.display_name);
  const actor = validateActorType(input.actor_type);
  const password = validatePassword(input.password);
  const activity =
    actor === "athlete"
      ? validateActivity(input.activity_id)
      : null;

  if (
    input.accepted_terms !== true ||
    input.accepted_consent !== true
  ) {
    throw new ProductAccountError("account_acceptance_required");
  }

  if (
    cleanString(
      input.accepted_terms_version
    ) !== CURRENT_TERMS_VERSION ||
    cleanString(
      input.accepted_consent_version
    ) !== CURRENT_CONSENT_VERSION
  ) {
    throw new ProductAccountError(
      "account_acceptance_version_mismatch",
      409
    );
  }

  if (await accountBy("email_canonical", email)) {
    throw new ProductAccountError(
      "account_email_already_registered",
      409
    );
  }

  const existingIdentity = await existingBetaIdentity(email);

  if (
    existingIdentity &&
    existingIdentity.actor_type !== actor
  ) {
    throw new ProductAccountError(
      "account_existing_role_mismatch",
      409
    );
  }

  const userId =
    existingIdentity?.user_id ??
    randomId(actor === "coach" ? "coach" : "athlete");

  const credentials = await newPasswordRecord(password);

  try {
    await pool.query(
      `
      INSERT INTO product_accounts (
        user_id,
        email_canonical,
        display_name,
        actor_type,
        account_state,
        password_salt,
        password_hash,
        email_verified_at,
        accepted_terms_version,
        accepted_consent_version,
        failed_sign_in_count,
        locked_until,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, 'active',
        $5, $6, NULL, $7, $8,
        0, NULL, now(), now()
      )
      `,
      [
        userId,
        email,
        name,
        actor,
        credentials.salt,
        credentials.hash,
        CURRENT_TERMS_VERSION,
        CURRENT_CONSENT_VERSION
      ]
    );

    await pool.query(
      `
      INSERT INTO beta_accounts (
        user_id,
        actor_type,
        account_state
      )
      VALUES ($1, $2, 'active')
      ON CONFLICT (user_id)
      DO UPDATE SET
        actor_type = EXCLUDED.actor_type,
        account_state = 'active'
      `,
      [
        userId,
        actor === "coach"
          ? "coach"
          : "individual_user"
      ]
    );

    await persistInitialProductRecords(
      userId,
      actor,
      email,
      name,
      activity
    );

    await recordAccountEvent(
      userId,
      "account_created",
      {
        actor_type: actor,
        claimed_existing_identity:
          Boolean(existingIdentity)
      }
    );

    await recordAccountEvent(
      userId,
      "terms_and_consent_accepted",
      {
        terms_version: CURRENT_TERMS_VERSION,
        consent_version: CURRENT_CONSENT_VERSION
      }
    );

    const verification = await createChallenge(
      userId,
      "email_verification"
    );

    const row = await accountBy("user_id", userId);

    if (!row) {
      throw new ProductAccountError(
        "account_creation_failed",
        500
      );
    }

    return Object.freeze({
      session: await createSession(row, userAgent),
      verification: Object.freeze({
        expires_at_iso8601:
          verification.expires_at_iso8601,
        development_code:
          process.env.NODE_ENV === "production"
            ? null
            : verification.code
      }),
      claimed_existing_identity:
        Boolean(existingIdentity)
    });
  }
  catch (error) {
    await pool.query(
      `DELETE FROM product_accounts WHERE user_id = $1`,
      [userId]
    );

    throw error;
  }
}

export async function signInProductAccount(
  input: unknown,
  userAgent: string
): Promise<ProductAccountSession> {
  if (!isRecord(input)) {
    throw new ProductAccountError(
      "account_sign_in_failed",
      401
    );
  }

  let email: string;
  let password: string;

  try {
    email = validateEmail(input.email);
    password = validatePassword(input.password);
  }
  catch {
    throw new ProductAccountError(
      "account_sign_in_failed",
      401
    );
  }

  const row = await accountBy("email_canonical", email);

  if (!row) {
    await derivePassword(
      password,
      "kolosseum-missing-account"
    );

    throw new ProductAccountError(
      "account_sign_in_failed",
      401
    );
  }

  if (
    row.locked_until &&
    Date.parse(row.locked_until) > Date.now()
  ) {
    throw new ProductAccountError(
      "account_temporarily_locked",
      429
    );
  }

  const actualHash = await derivePassword(
    password,
    row.password_salt
  );

  if (!safeEqual(actualHash, row.password_hash)) {
    const failedCount = row.failed_sign_in_count + 1;
    const shouldLock =
      failedCount >= MAX_FAILED_SIGN_INS;

    await pool.query(
      `
      UPDATE product_accounts
      SET
        failed_sign_in_count = $2,
        locked_until = $3::timestamptz,
        updated_at = now()
      WHERE user_id = $1
      `,
      [
        row.user_id,
        shouldLock ? 0 : failedCount,
        shouldLock
          ? new Date(
              Date.now() + LOCKOUT_TTL_MS
            ).toISOString()
          : null
      ]
    );

    await recordAccountEvent(
      row.user_id,
      "sign_in_failed",
      { temporarily_locked: shouldLock }
    );

    throw new ProductAccountError(
      "account_sign_in_failed",
      401
    );
  }

  if (row.account_state !== "active") {
    throw new ProductAccountError(
      "account_unavailable",
      423,
      row.account_state
    );
  }

  await pool.query(
    `
    UPDATE product_accounts
    SET
      failed_sign_in_count = 0,
      locked_until = NULL,
      updated_at = now()
    WHERE user_id = $1
    `,
    [row.user_id]
  );

  await recordAccountEvent(
    row.user_id,
    "sign_in_succeeded"
  );

  return createSession(
    Object.freeze({
      ...row,
      failed_sign_in_count: 0,
      locked_until: null
    }),
    userAgent
  );
}

export async function resolveProductSession(
  rawSessionToken: string
): Promise<Readonly<{
  account_row: AccountRow;
  account: Readonly<JsonRecord>;
  bootstrap: Readonly<JsonRecord>;
  session_hash: string;
  csrf_token: string;
  expires_at_iso8601: string;
}>> {
  if (!rawSessionToken) {
    throw new ProductAccountError(
      "account_session_missing",
      401
    );
  }

  const sessionHash = sha256(rawSessionToken);

  const result = await pool.query(
    `
    SELECT
      s.expires_at AS session_expires_at,
      a.user_id,
      a.email_canonical,
      a.display_name,
      a.actor_type,
      a.account_state,
      a.password_salt,
      a.password_hash,
      a.email_verified_at,
      a.accepted_terms_version,
      a.accepted_consent_version,
      a.failed_sign_in_count,
      a.locked_until,
      a.created_at,
      a.updated_at
    FROM product_auth_sessions s
    JOIN product_accounts a
      ON a.user_id = s.user_id
    WHERE
      s.session_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
    LIMIT 1
    `,
    [sessionHash]
  );

  const row = mapAccountRow(result.rows?.[0]);

  if (!row) {
    throw new ProductAccountError(
      "account_session_invalid",
      401
    );
  }

  if (row.account_state !== "active") {
    throw new ProductAccountError(
      "account_unavailable",
      423,
      row.account_state
    );
  }

  await pool.query(
    `
    UPDATE product_auth_sessions
    SET last_seen_at = now()
    WHERE session_hash = $1
    `,
    [sessionHash]
  );

  return Object.freeze({
    account_row: row,
    account: publicAccount(row),
    bootstrap:
      await loadProductBootstrap(
        row.user_id,
        row.actor_type
      ),
    session_hash: sessionHash,
    csrf_token:
      csrfTokenForSession(rawSessionToken),
    expires_at_iso8601:
      String(result.rows[0].session_expires_at)
  });
}

export function assertProductCsrf(
  rawSessionToken: string,
  suppliedToken: unknown
): void {
  const supplied = cleanString(suppliedToken);
  const expected =
    csrfTokenForSession(rawSessionToken);

  if (!supplied || !safeEqual(supplied, expected)) {
    throw new ProductAccountError(
      "account_csrf_invalid",
      403
    );
  }
}

export async function signOutProductAccount(
  rawSessionToken: string
): Promise<void> {
  if (!rawSessionToken) {
    return;
  }

  const result = await pool.query(
    `
    UPDATE product_auth_sessions
    SET revoked_at = COALESCE(revoked_at, now())
    WHERE session_hash = $1
    RETURNING user_id
    `,
    [sha256(rawSessionToken)]
  );

  const userId = cleanString(
    result.rows?.[0]?.user_id
  );

  if (userId) {
    await recordAccountEvent(
      userId,
      "session_revoked"
    );
  }
}

export async function getProductAccountDetail(
  rawSessionToken: string
): Promise<Readonly<JsonRecord>> {
  const session = await resolveProductSession(
    rawSessionToken
  );

  const events = await pool.query(
    `
    SELECT event_type, event_payload, occurred_at
    FROM product_account_events
    WHERE user_id = $1
    ORDER BY occurred_at DESC, event_id DESC
    LIMIT 100
    `,
    [session.account_row.user_id]
  );

  const closure = await pool.query(
    `
    SELECT
      closure_request_id,
      request_state,
      requested_at,
      completed_at
    FROM product_account_closure_requests
    WHERE user_id = $1
    ORDER BY requested_at DESC
    LIMIT 1
    `,
    [session.account_row.user_id]
  );

  const history = (events.rows ?? []).map(
    (event) => ({
      event_type: event.event_type,
      event_payload: event.event_payload,
      occurred_at_iso8601: event.occurred_at
    })
  );

  return Object.freeze({
    account: session.account,
    bootstrap: session.bootstrap,
    terms: getCurrentProductTerms(),
    account_history: history,
    consent_history: history.filter(
      (event) =>
        String(event.event_type).includes("terms") ||
        String(event.event_type).includes("consent") ||
        String(event.event_type).includes("verification")
    ),
    closure_request: closure.rows?.[0] ?? null
  });
}

export async function updateProductAccountProfile(
  rawSessionToken: string,
  input: unknown
): Promise<Readonly<{
  account: Readonly<JsonRecord>;
  verification: Readonly<JsonRecord> | null;
}>> {
  const session = await resolveProductSession(
    rawSessionToken
  );

  if (!isRecord(input)) {
    throw new ProductAccountError(
      "account_profile_invalid"
    );
  }

  const name = validateDisplayName(
    input.display_name
  );

  const email = validateEmail(input.email);

  const duplicate = await pool.query(
    `
    SELECT user_id
    FROM product_accounts
    WHERE
      email_canonical = $1
      AND user_id <> $2
    LIMIT 1
    `,
    [email, session.account_row.user_id]
  );

  if (duplicate.rows?.[0]) {
    throw new ProductAccountError(
      "account_email_already_registered",
      409
    );
  }

  const emailChanged =
    email !== session.account_row.email_canonical;

  const result = await pool.query(
    `
    UPDATE product_accounts
    SET
      display_name = $2,
      email_canonical = $3,
      email_verified_at =
        CASE
          WHEN email_canonical <> $3
            THEN NULL
          ELSE email_verified_at
        END,
      updated_at = now()
    WHERE user_id = $1
    RETURNING
      user_id,
      email_canonical,
      display_name,
      actor_type,
      account_state,
      password_salt,
      password_hash,
      email_verified_at,
      accepted_terms_version,
      accepted_consent_version,
      failed_sign_in_count,
      locked_until,
      created_at,
      updated_at
    `,
    [
      session.account_row.user_id,
      name,
      email
    ]
  );

  const row = mapAccountRow(result.rows?.[0]);

  if (!row) {
    throw new ProductAccountError(
      "account_profile_update_failed",
      500
    );
  }

  await recordAccountEvent(
    row.user_id,
    "profile_updated",
    { email_changed: emailChanged }
  );

  let verification:
    | Readonly<JsonRecord>
    | null = null;

  if (emailChanged) {
    const challenge = await createChallenge(
      row.user_id,
      "email_verification"
    );

    verification = Object.freeze({
      expires_at_iso8601:
        challenge.expires_at_iso8601,
      development_code:
        process.env.NODE_ENV === "production"
          ? null
          : challenge.code
    });
  }

  return Object.freeze({
    account: publicAccount(row),
    verification
  });
}

export async function changeProductPassword(
  rawSessionToken: string,
  input: unknown
): Promise<void> {
  const session = await resolveProductSession(
    rawSessionToken
  );

  if (!isRecord(input)) {
    throw new ProductAccountError(
      "account_password_change_invalid"
    );
  }

  const currentPassword = validatePassword(
    input.current_password
  );

  const newPassword = validatePassword(
    input.new_password
  );

  const currentHash = await derivePassword(
    currentPassword,
    session.account_row.password_salt
  );

  if (
    !safeEqual(
      currentHash,
      session.account_row.password_hash
    )
  ) {
    throw new ProductAccountError(
      "account_current_password_invalid",
      403
    );
  }

  const credentials = await newPasswordRecord(
    newPassword
  );

  await pool.query(
    `
    UPDATE product_accounts
    SET
      password_salt = $2,
      password_hash = $3,
      updated_at = now()
    WHERE user_id = $1
    `,
    [
      session.account_row.user_id,
      credentials.salt,
      credentials.hash
    ]
  );

  await pool.query(
    `
    UPDATE product_auth_sessions
    SET revoked_at = now()
    WHERE
      user_id = $1
      AND session_hash <> $2
      AND revoked_at IS NULL
    `,
    [
      session.account_row.user_id,
      session.session_hash
    ]
  );

  await recordAccountEvent(
    session.account_row.user_id,
    "password_changed",
    { other_sessions_revoked: true }
  );
}

export async function requestProductPasswordReset(
  input: unknown
): Promise<Readonly<JsonRecord>> {
  if (!isRecord(input)) {
    return Object.freeze({ accepted: true });
  }

  let email: string;

  try {
    email = validateEmail(input.email);
  }
  catch {
    return Object.freeze({ accepted: true });
  }

  const row = await accountBy(
    "email_canonical",
    email
  );

  if (!row || row.account_state === "deleted") {
    return Object.freeze({ accepted: true });
  }

  const challenge = await createChallenge(
    row.user_id,
    "password_reset"
  );

  await recordAccountEvent(
    row.user_id,
    "password_reset_requested"
  );

  return Object.freeze({
    accepted: true,
    expires_at_iso8601:
      challenge.expires_at_iso8601,
    development_code:
      process.env.NODE_ENV === "production"
        ? null
        : challenge.code
  });
}

export async function completeProductPasswordReset(
  input: unknown
): Promise<void> {
  if (!isRecord(input)) {
    throw new ProductAccountError(
      "account_password_reset_invalid"
    );
  }

  const email = validateEmail(input.email);
  const password = validatePassword(
    input.new_password
  );

  const row = await accountBy(
    "email_canonical",
    email
  );

  if (!row) {
    throw new ProductAccountError(
      "account_challenge_invalid"
    );
  }

  await consumeChallenge(
    row.user_id,
    "password_reset",
    input.code
  );

  const credentials = await newPasswordRecord(
    password
  );

  await pool.query(
    `
    UPDATE product_accounts
    SET
      password_salt = $2,
      password_hash = $3,
      failed_sign_in_count = 0,
      locked_until = NULL,
      updated_at = now()
    WHERE user_id = $1
    `,
    [
      row.user_id,
      credentials.salt,
      credentials.hash
    ]
  );

  await pool.query(
    `
    UPDATE product_auth_sessions
    SET revoked_at = now()
    WHERE
      user_id = $1
      AND revoked_at IS NULL
    `,
    [row.user_id]
  );

  await recordAccountEvent(
    row.user_id,
    "password_reset_completed"
  );
}

export async function requestProductEmailVerification(
  rawSessionToken: string
): Promise<Readonly<JsonRecord>> {
  const session = await resolveProductSession(
    rawSessionToken
  );

  if (session.account_row.email_verified_at) {
    return Object.freeze({
      already_verified: true,
      development_code: null
    });
  }

  const challenge = await createChallenge(
    session.account_row.user_id,
    "email_verification"
  );

  await recordAccountEvent(
    session.account_row.user_id,
    "email_verification_requested"
  );

  return Object.freeze({
    already_verified: false,
    expires_at_iso8601:
      challenge.expires_at_iso8601,
    development_code:
      process.env.NODE_ENV === "production"
        ? null
        : challenge.code
  });
}

export async function completeProductEmailVerification(
  rawSessionToken: string,
  input: unknown
): Promise<Readonly<JsonRecord>> {
  const session = await resolveProductSession(
    rawSessionToken
  );

  if (!isRecord(input)) {
    throw new ProductAccountError(
      "account_challenge_invalid"
    );
  }

  await consumeChallenge(
    session.account_row.user_id,
    "email_verification",
    input.code
  );

  const result = await pool.query(
    `
    UPDATE product_accounts
    SET
      email_verified_at = now(),
      updated_at = now()
    WHERE user_id = $1
    RETURNING
      user_id,
      email_canonical,
      display_name,
      actor_type,
      account_state,
      password_salt,
      password_hash,
      email_verified_at,
      accepted_terms_version,
      accepted_consent_version,
      failed_sign_in_count,
      locked_until,
      created_at,
      updated_at
    `,
    [session.account_row.user_id]
  );

  const row = mapAccountRow(result.rows?.[0]);

  if (!row) {
    throw new ProductAccountError(
      "account_email_verification_failed",
      500
    );
  }

  await recordAccountEvent(
    row.user_id,
    "email_verified"
  );

  return publicAccount(row);
}

export async function requestProductAccountClosure(
  rawSessionToken: string,
  input: unknown
): Promise<Readonly<JsonRecord>> {
  const session = await resolveProductSession(
    rawSessionToken
  );

  if (
    !isRecord(input) ||
    input.confirmation !== "CLOSE"
  ) {
    throw new ProductAccountError(
      "account_closure_confirmation_required"
    );
  }

  const closureRequestId =
    randomId("closure_request");

  await pool.query(
    `
    INSERT INTO product_account_closure_requests (
      closure_request_id,
      user_id,
      request_state,
      requested_at,
      completed_at
    )
    VALUES ($1, $2, 'requested', now(), NULL)
    `,
    [
      closureRequestId,
      session.account_row.user_id
    ]
  );

  await pool.query(
    `
    UPDATE product_accounts
    SET
      account_state = 'closed',
      updated_at = now()
    WHERE user_id = $1
    `,
    [session.account_row.user_id]
  );

  await pool.query(
    `
    UPDATE product_auth_sessions
    SET revoked_at = now()
    WHERE
      user_id = $1
      AND revoked_at IS NULL
    `,
    [session.account_row.user_id]
  );

  await recordAccountEvent(
    session.account_row.user_id,
    "account_closure_requested",
    { closure_request_id: closureRequestId }
  );

  return Object.freeze({
    closure_request_id: closureRequestId,
    request_state: "requested"
  });
}