// DEV NOTE: BETA-16 product/application composition surface.
// This module binds existing product auth, acknowledgement and Phase 1
// declaration records to compile admission. It does not persist records,
// call engine phases, infer training decisions or create Phase 7/8 UI.

import crypto from "node:crypto";

type JsonRecord = Record<string, unknown>;

type Beta16HttpResult = Readonly<{
  status: number;
  body: Readonly<JsonRecord>;
}>;

export const beta16AppPathContract = Object.freeze({
  surface_id: "beta16_app_path_phase1_6",
  version: "1.0.0",
  slice_id: "BETA-16",
  phase_range: "1-6",
  auth_boundary: "existing_product_auth_record",
  compile_route: "/blocks/compile",
  execution_routes: Object.freeze([
    "/sessions/:session_id/start",
    "/sessions/:session_id/events",
    "/sessions/:session_id/state",
    "/sessions/:session_id/events"
  ]),
  execution_only_ui: true,
  factual_counts_only: true,
  extended_phase_ui: false,
  aggregate_reporting: false
});

export const BETA16_APP_PATH_COPY_IDS = Object.freeze({
  authRecorded: "BETA16_COPY_AUTH_RECORDED",
  acknowledgementRecorded:
    "BETA16_COPY_ACKNOWLEDGEMENT_RECORDED",
  declarationRecorded:
    "BETA16_COPY_DECLARATION_RECORDED",
  compileRecorded: "BETA16_COPY_COMPILE_RECORDED",
  error: "BETA16_COPY_STATUS_ERROR"
});

const supportedActivities = new Set([
  "powerlifting",
  "rugby_union",
  "general_strength"
]);

const authInputKeys = new Set([
  "user_id",
  "email",
  "display_name",
  "account_role",
  "account_state",
  "accepted_terms_version",
  "created_at_iso8601"
]);

const acknowledgementInputKeys = new Set([
  "acknowledgement_id",
  "user_id",
  "beta_id",
  "accepted",
  "jurisdiction_acknowledged",
  "accepted_at_iso8601",
  "copy_acknowledgement_id"
]);

const declarationInputKeys = new Set([
  "declaration_id",
  "user_id",
  "phase1_input",
  "jurisdiction_acknowledged",
  "declared_at_iso8601",
  "accepted_terms_version",
  "copy_acknowledgement_id"
]);

const phase1RequiredKeys = new Set([
  "consent_granted",
  "engine_version",
  "enum_bundle_version",
  "phase1_schema_version",
  "actor_type",
  "execution_scope",
  "activity_id",
  "nd_mode",
  "instruction_density",
  "exposure_prompt_density",
  "bias_mode"
]);

const phase1AllowedKeys = new Set([
  ...phase1RequiredKeys,
  "governing_authority_id",
  "sport_role_id",
  "constraints"
]);

const forbiddenKeys = new Set([
  "readiness",
  "recommendation",
  "performance_score",
  "safety_score",
  "risk_score",
  "coach_override",
  "engine_override",
  "billing_state"
]);

export class Beta16AppPathError extends Error {
  readonly code: string;
  readonly reason: string;
  readonly failure_token: string;

  constructor(reason: string) {
    super(`beta16_app_path_${reason}`);
    this.name = "Beta16AppPathError";
    this.code = `beta16_app_path_${reason}`;
    this.reason = reason;
    this.failure_token = "beta16_app_path_invalid";
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function hasOwn(
  value: JsonRecord,
  key: string
): boolean {
  return Object.prototype.hasOwnProperty.call(
    value,
    key
  );
}

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isIso8601(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const parsed = Date.parse(value);

  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString() === value
  );
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (
    value === null ||
    (typeof value !== "object" &&
      typeof value !== "function")
  ) {
    return value;
  }

  if (Object.isFrozen(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
  }
  else {
    for (
      const item of Object.values(
        value as JsonRecord
      )
    ) {
      deepFreeze(item);
    }
  }

  return Object.freeze(value);
}

function assertNoForbiddenKeys(
  value: unknown,
  path: string[] = []
): void {
  if (Array.isArray(value)) {
    value.forEach(
      (item, index) =>
        assertNoForbiddenKeys(
          item,
          [...path, String(index)]
        )
    );

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const key of Object.keys(value)) {
    if (forbiddenKeys.has(key)) {
      throw new Beta16AppPathError(
        `forbidden_field_${[
          ...path,
          key
        ].join("_")}`
      );
    }

    assertNoForbiddenKeys(
      value[key],
      [...path, key]
    );
  }
}

function assertExactKeys(
  value: JsonRecord,
  allowed: Set<string>,
  reason: string
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Beta16AppPathError(
        `${reason}_unknown_field`
      );
    }
  }

  for (const key of allowed) {
    if (!hasOwn(value, key)) {
      throw new Beta16AppPathError(
        `${reason}_${key}_required`
      );
    }
  }
}

function assertPhase1Input(
  value: unknown
): asserts value is JsonRecord {
  if (!isRecord(value)) {
    throw new Beta16AppPathError(
      "phase1_input_invalid"
    );
  }

  assertNoForbiddenKeys(value);

  for (const key of Object.keys(value)) {
    if (!phase1AllowedKeys.has(key)) {
      throw new Beta16AppPathError(
        "phase1_input_unknown_field"
      );
    }
  }

  for (const key of phase1RequiredKeys) {
    if (!hasOwn(value, key)) {
      throw new Beta16AppPathError(
        `phase1_input_${key}_required`
      );
    }
  }

  if (value.actor_type !== "athlete") {
    throw new Beta16AppPathError(
      "phase1_actor_not_athlete"
    );
  }

  if (value.execution_scope !== "individual") {
    throw new Beta16AppPathError(
      "phase1_scope_not_individual"
    );
  }

  if (
    typeof value.activity_id !== "string" ||
    !supportedActivities.has(value.activity_id)
  ) {
    throw new Beta16AppPathError(
      "phase1_activity_invalid"
    );
  }

  if (value.consent_granted !== true) {
    throw new Beta16AppPathError(
      "phase1_consent_not_granted"
    );
  }

  if (
    value.engine_version !== "EB2-1.0.0" ||
    value.enum_bundle_version !== "EB2-1.0.0" ||
    value.phase1_schema_version !== "1.0.0"
  ) {
    throw new Beta16AppPathError(
      "phase1_version_mismatch"
    );
  }
}

/**
 * FUNCTION NOTE:
 * Purpose: Creates stable sorted JSON for BETA-16 product records.
 * Boundary: No persistence, clocks or engine calls.
 */
export function stableBeta16AppPathJson(
  value: unknown
): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return (
      "[" +
      value
        .map(stableBeta16AppPathJson)
        .join(",") +
      "]"
    );
  }

  if (typeof value === "object") {
    return (
      "{" +
      Object.keys(value as JsonRecord)
        .sort()
        .map(
          (key) =>
            JSON.stringify(key) +
            ":" +
            stableBeta16AppPathJson(
              (value as JsonRecord)[key]
            )
        )
        .join(",") +
      "}"
    );
  }

  return JSON.stringify(value) ?? "null";
}

function sha256(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(
      stableBeta16AppPathJson(value),
      "utf8"
    )
    .digest("hex");
}

function recordPayload(
  record: JsonRecord
): JsonRecord {
  const payload: JsonRecord = {};

  for (
    const key of Object.keys(record).sort()
  ) {
    if (key === "record_sha256") {
      continue;
    }

    payload[key] = record[key];
  }

  return payload;
}

function withRecordHash<T extends JsonRecord>(
  record: T
): Readonly<T & {
  record_sha256: string;
}> {
  const payload = cloneJson(record);

  return deepFreeze({
    ...payload,
    record_sha256: sha256(payload)
  });
}

function assertRecordIntegrity(
  record: unknown,
  recordType: string
): asserts record is JsonRecord {
  if (
    !isRecord(record) ||
    record.record_type !== recordType
  ) {
    throw new Beta16AppPathError(
      `${recordType}_record_invalid`
    );
  }

  if (
    typeof record.record_sha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(
      record.record_sha256
    )
  ) {
    throw new Beta16AppPathError(
      `${recordType}_hash_invalid`
    );
  }

  if (
    record.record_sha256 !==
    sha256(recordPayload(record))
  ) {
    throw new Beta16AppPathError(
      `${recordType}_hash_mismatch`
    );
  }
}

function rejection(
  error: unknown
): Beta16HttpResult {
  const reason =
    error instanceof Beta16AppPathError
      ? error.reason
      : "unexpected_failure";

  return deepFreeze({
    status: 400,
    body: {
      ok: false,
      surface_id:
        beta16AppPathContract.surface_id,
      failure_token:
        "beta16_app_path_invalid",
      reason,
      copy_id:
        BETA16_APP_PATH_COPY_IDS.error
    }
  });
}

/**
 * FUNCTION NOTE:
 * Purpose: Records the existing beta athlete product/auth boundary.
 * Boundary: Does not authenticate credentials or create provider sessions.
 */
export function createBeta16AuthRecord(
  input: unknown
): Beta16HttpResult {
  try {
    if (!isRecord(input)) {
      throw new Beta16AppPathError(
        "auth_input_invalid"
      );
    }

    assertNoForbiddenKeys(input);
    assertExactKeys(
      input,
      authInputKeys,
      "auth"
    );

    const userId = cleanString(input.user_id);
    const email = cleanString(input.email);
    const displayName =
      cleanString(input.display_name);
    const termsVersion =
      cleanString(
        input.accepted_terms_version
      );

    if (!userId) {
      throw new Beta16AppPathError(
        "auth_user_id_required"
      );
    }

    if (
      !email ||
      !email.includes("@")
    ) {
      throw new Beta16AppPathError(
        "auth_email_invalid"
      );
    }

    if (!displayName) {
      throw new Beta16AppPathError(
        "auth_display_name_required"
      );
    }

    if (input.account_role !== "athlete") {
      throw new Beta16AppPathError(
        "auth_role_not_athlete"
      );
    }

    if (input.account_state !== "active") {
      throw new Beta16AppPathError(
        "auth_state_not_active"
      );
    }

    if (!termsVersion) {
      throw new Beta16AppPathError(
        "auth_terms_version_required"
      );
    }

    if (!isIso8601(input.created_at_iso8601)) {
      throw new Beta16AppPathError(
        "auth_created_at_invalid"
      );
    }

    const authRecord = withRecordHash({
      record_type: "beta16_auth",
      user_id: userId,
      email,
      display_name: displayName,
      account_role: "athlete",
      account_state: "active",
      accepted_terms_version:
        termsVersion,
      created_at_iso8601:
        input.created_at_iso8601,
      product_auth_state_only: true,
      engine_visible: false,
      copy_id:
        BETA16_APP_PATH_COPY_IDS.authRecorded
    });

    return deepFreeze({
      status: 201,
      body: {
        ok: true,
        surface_id:
          beta16AppPathContract.surface_id,
        auth_record: authRecord
      }
    });
  }
  catch (error) {
    return rejection(error);
  }
}

/**
 * FUNCTION NOTE:
 * Purpose: Records explicit controlled-beta acknowledgement.
 * Boundary: No readiness, safety or decision authority is created.
 */
export function createBeta16AcknowledgementRecord(
  input: unknown
): Beta16HttpResult {
  try {
    if (!isRecord(input)) {
      throw new Beta16AppPathError(
        "acknowledgement_input_invalid"
      );
    }

    assertNoForbiddenKeys(input);
    assertExactKeys(
      input,
      acknowledgementInputKeys,
      "acknowledgement"
    );

    const acknowledgementId =
      cleanString(
        input.acknowledgement_id
      );

    const userId =
      cleanString(input.user_id);

    if (!acknowledgementId) {
      throw new Beta16AppPathError(
        "acknowledgement_id_required"
      );
    }

    if (!userId) {
      throw new Beta16AppPathError(
        "acknowledgement_user_id_required"
      );
    }

    if (
      input.beta_id !==
      "september_beta_2026"
    ) {
      throw new Beta16AppPathError(
        "acknowledgement_beta_id_invalid"
      );
    }

    if (input.accepted !== true) {
      throw new Beta16AppPathError(
        "acknowledgement_not_accepted"
      );
    }

    if (
      input.jurisdiction_acknowledged !==
      true
    ) {
      throw new Beta16AppPathError(
        "jurisdiction_not_acknowledged"
      );
    }

    if (
      !isIso8601(
        input.accepted_at_iso8601
      )
    ) {
      throw new Beta16AppPathError(
        "acknowledgement_timestamp_invalid"
      );
    }

    if (
      input.copy_acknowledgement_id !==
      "BETA16_COPY_ACKNOWLEDGEMENT_LABEL"
    ) {
      throw new Beta16AppPathError(
        "acknowledgement_copy_id_invalid"
      );
    }

    const acknowledgementRecord =
      withRecordHash({
        record_type:
          "beta16_acknowledgement",
        acknowledgement_id:
          acknowledgementId,
        user_id: userId,
        beta_id: "september_beta_2026",
        accepted: true,
        jurisdiction_acknowledged: true,
        accepted_at_iso8601:
          input.accepted_at_iso8601,
        copy_acknowledgement_id:
          input.copy_acknowledgement_id,
        product_state_only: true,
        engine_visible: false,
        copy_id:
          BETA16_APP_PATH_COPY_IDS
            .acknowledgementRecorded
      });

    return deepFreeze({
      status: 201,
      body: {
        ok: true,
        surface_id:
          beta16AppPathContract.surface_id,
        acknowledgement_record:
          acknowledgementRecord
      }
    });
  }
  catch (error) {
    return rejection(error);
  }
}

/**
 * FUNCTION NOTE:
 * Purpose: Records a hash-bound Phase 1 declaration for the app path.
 * Boundary: The declaration is product state and does not run compile.
 */
export function createBeta16Phase1DeclarationRecord(
  input: unknown
): Beta16HttpResult {
  try {
    if (!isRecord(input)) {
      throw new Beta16AppPathError(
        "declaration_input_invalid"
      );
    }

    assertNoForbiddenKeys(input);
    assertExactKeys(
      input,
      declarationInputKeys,
      "declaration"
    );

    const declarationId =
      cleanString(input.declaration_id);
    const userId =
      cleanString(input.user_id);
    const termsVersion =
      cleanString(
        input.accepted_terms_version
      );

    if (!declarationId) {
      throw new Beta16AppPathError(
        "declaration_id_required"
      );
    }

    if (!userId) {
      throw new Beta16AppPathError(
        "declaration_user_id_required"
      );
    }

    if (!termsVersion) {
      throw new Beta16AppPathError(
        "declaration_terms_version_required"
      );
    }

    if (
      input.jurisdiction_acknowledged !==
      true
    ) {
      throw new Beta16AppPathError(
        "declaration_jurisdiction_not_acknowledged"
      );
    }

    if (
      !isIso8601(
        input.declared_at_iso8601
      )
    ) {
      throw new Beta16AppPathError(
        "declaration_timestamp_invalid"
      );
    }

    if (
      input.copy_acknowledgement_id !==
      "BETA16_COPY_DECLARATION_ACKNOWLEDGEMENT"
    ) {
      throw new Beta16AppPathError(
        "declaration_copy_id_invalid"
      );
    }

    assertPhase1Input(input.phase1_input);

    const phase1Input =
      cloneJson(input.phase1_input);

    const declarationPayload =
      deepFreeze({
        actor_type: "individual_user",
        execution_scope: "individual",
        activity_id:
          phase1Input.activity_id,
        phase1_schema_version:
          phase1Input.phase1_schema_version,
        engine_compatibility:
          phase1Input.engine_version,
        enum_bundle_version:
          phase1Input.enum_bundle_version,
        consent_granted: true,
        jurisdiction_acknowledged: true
      });

    const declarationRecord =
      withRecordHash({
        record_type:
          "beta16_phase1_declaration",
        declaration_id: declarationId,
        declared_by_user_id: userId,
        subject_user_id: userId,
        declaration_source:
          "user_declared",
        declaration_scope:
          "phase1_compile_prerequisite",
        declaration_state: "accepted",
        declaration_payload:
          declarationPayload,
        declaration_payload_sha256:
          sha256(declarationPayload),
        engine_phase1_input:
          deepFreeze(phase1Input),
        engine_phase1_input_sha256:
          sha256(phase1Input),
        declared_at_iso8601:
          input.declared_at_iso8601,
        accepted_terms_version:
          termsVersion,
        copy_acknowledgement_id:
          input.copy_acknowledgement_id,
        user_declared_factual_state: true,
        product_declaration_state_only:
          true,
        engine_visible: false,
        immutable: true,
        superseded_at_iso8601: null,
        copy_id:
          BETA16_APP_PATH_COPY_IDS
            .declarationRecorded
      });

    return deepFreeze({
      status: 201,
      body: {
        ok: true,
        surface_id:
          beta16AppPathContract.surface_id,
        declaration_record:
          declarationRecord
      }
    });
  }
  catch (error) {
    return rejection(error);
  }
}

/**
 * FUNCTION NOTE:
 * Purpose: Verifies product records before the existing compile route runs.
 * Boundary: Does not change or add fields to the engine Phase 1 input.
 */
export function assertBeta16CompileAdmission(
  context: unknown,
  phase1Input: unknown
): Readonly<JsonRecord> {
  if (!isRecord(context)) {
    throw new Beta16AppPathError(
      "compile_context_invalid"
    );
  }

  assertNoForbiddenKeys(context);

  assertExactKeys(
    context,
    new Set([
      "auth_record",
      "acknowledgement_record",
      "declaration_record"
    ]),
    "compile_context"
  );

  assertPhase1Input(phase1Input);

  assertRecordIntegrity(
    context.auth_record,
    "beta16_auth"
  );

  assertRecordIntegrity(
    context.acknowledgement_record,
    "beta16_acknowledgement"
  );

  assertRecordIntegrity(
    context.declaration_record,
    "beta16_phase1_declaration"
  );

  const authRecord =
    context.auth_record as JsonRecord;

  const acknowledgementRecord =
    context.acknowledgement_record as JsonRecord;

  const declarationRecord =
    context.declaration_record as JsonRecord;

  const userId =
    cleanString(authRecord.user_id);

  if (
    !userId ||
    acknowledgementRecord.user_id !== userId ||
    declarationRecord.declared_by_user_id !== userId ||
    declarationRecord.subject_user_id !== userId
  ) {
    throw new Beta16AppPathError(
      "compile_user_binding_mismatch"
    );
  }

  if (
    authRecord.account_role !== "athlete" ||
    authRecord.account_state !== "active" ||
    authRecord.product_auth_state_only !== true ||
    authRecord.engine_visible !== false
  ) {
    throw new Beta16AppPathError(
      "compile_auth_record_invalid"
    );
  }

  if (
    acknowledgementRecord.accepted !== true ||
    acknowledgementRecord
      .jurisdiction_acknowledged !== true ||
    acknowledgementRecord.beta_id !==
      "september_beta_2026"
  ) {
    throw new Beta16AppPathError(
      "compile_acknowledgement_invalid"
    );
  }

  if (
    declarationRecord.declaration_state !==
      "accepted" ||
    declarationRecord.immutable !== true ||
    declarationRecord
      .superseded_at_iso8601 !== null
  ) {
    throw new Beta16AppPathError(
      "compile_declaration_invalid"
    );
  }

  if (
    declarationRecord
      .declaration_payload_sha256 !==
    sha256(
      declarationRecord
        .declaration_payload
    )
  ) {
    throw new Beta16AppPathError(
      "compile_declaration_payload_hash_mismatch"
    );
  }

  if (
    declarationRecord
      .engine_phase1_input_sha256 !==
    sha256(
      declarationRecord
        .engine_phase1_input
    )
  ) {
    throw new Beta16AppPathError(
      "compile_phase1_hash_mismatch"
    );
  }

  if (
    stableBeta16AppPathJson(
      declarationRecord
        .engine_phase1_input
    ) !==
    stableBeta16AppPathJson(
      phase1Input
    )
  ) {
    throw new Beta16AppPathError(
      "compile_phase1_input_mismatch"
    );
  }

  const declarationPayload =
    declarationRecord
      .declaration_payload as JsonRecord;

  if (
    declarationPayload.activity_id !==
      phase1Input.activity_id ||
    declarationPayload.execution_scope !==
      "individual" ||
    declarationPayload.actor_type !==
      "individual_user"
  ) {
    throw new Beta16AppPathError(
      "compile_declaration_binding_mismatch"
    );
  }

  return deepFreeze({
    admitted: true,
    surface_id:
      beta16AppPathContract.surface_id,
    phase_range: "1-6",
    user_id: userId,
    auth_record_sha256:
      authRecord.record_sha256,
    acknowledgement_id:
      acknowledgementRecord
        .acknowledgement_id,
    acknowledgement_record_sha256:
      acknowledgementRecord
        .record_sha256,
    declaration_id:
      declarationRecord.declaration_id,
    declaration_record_sha256:
      declarationRecord.record_sha256,
    declared_input_sha256:
      declarationRecord
        .engine_phase1_input_sha256,
    copy_ids: Object.freeze([
      BETA16_APP_PATH_COPY_IDS
        .authRecorded,
      BETA16_APP_PATH_COPY_IDS
        .acknowledgementRecorded,
      BETA16_APP_PATH_COPY_IDS
        .declarationRecorded,
      BETA16_APP_PATH_COPY_IDS
        .compileRecorded
    ])
  });
}
