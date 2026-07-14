// DEV NOTE: BETA-17 product/application coach-managed composition surface.
// It records coach identity, relationship, assignment trigger, factual artefact
// view and non-binding notes. It must not import engine code, mutate athlete
// declarations, alter registries or override deterministic engine decisions.

import crypto from "node:crypto";

type JsonRecord = Record<string, unknown>;

type Beta17HttpResult = Readonly<{
  status: number;
  body: Readonly<JsonRecord>;
}>;

export const beta17CoachManagedContract =
  Object.freeze({
    surface_id:
      "beta17_coach_managed_path",
    version: "1.0.0",
    slice_id: "BETA-17",
    execution_scope: "coach_managed",
    product_permission_state_only: true,
    coach_state_engine_visible: false,
    assignment_mutates_engine_truth: false,
    notes_non_binding: true,
    artefacts_read_only: true
  });

export const BETA17_COACH_COPY_IDS =
  Object.freeze({
    profileRecorded:
      "BETA17_COPY_PROFILE_RECORDED",
    relationshipInvited:
      "BETA17_COPY_RELATIONSHIP_INVITED",
    relationshipAccepted:
      "BETA17_COPY_RELATIONSHIP_ACCEPTED",
    relationshipRevoked:
      "BETA17_COPY_RELATIONSHIP_REVOKED",
    assignmentRecorded:
      "BETA17_COPY_ASSIGNMENT_RECORDED",
    artefactLoaded:
      "BETA17_COPY_ARTEFACT_LOADED",
    noteRecorded:
      "BETA17_COPY_NOTE_RECORDED",
    accessDenied:
      "BETA17_COPY_ACCESS_DENIED",
    error:
      "BETA17_COPY_STATUS_ERROR"
  });

const supportedActivities = new Set([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

const forbiddenKeys = new Set([
  "engine_input",
  "canonical_engine_input",
  "deterministic_compile_input",
  "compile_input",
  "compile_output",
  "engine_truth",
  "engine_override",
  "decision_override",
  "coach_override",
  "phase1_input",
  "phase1_payload",
  "phase1_declaration",
  "declaration_payload",
  "declaration_record",
  "registry",
  "registries",
  "registry_bundle",
  "registry_index",
  "registry_authority",
  "can_alter_engine_truth",
  "changes_engine_truth",
  "changes_compile_output"
]);

const profileInputKeys = new Set([
  "coach_user_id",
  "email",
  "display_name",
  "account_role",
  "account_state",
  "accepted_terms_version",
  "created_at_iso8601"
]);

const relationshipInputKeys = new Set([
  "relationship_id",
  "coach_user_id",
  "athlete_user_id",
  "relationship_state",
  "relationship_scope",
  "accepted_at_iso8601",
  "created_at_iso8601",
  "updated_at_iso8601",
  "revoked_at_iso8601",
  "expires_at_iso8601"
]);

const assignmentInputKeys = new Set([
  "request_id",
  "requested_at_iso8601",
  "coach_profile",
  "relationship",
  "athlete_user_id",
  "template_id",
  "activity_id"
]);

const artefactViewInputKeys = new Set([
  "coach_profile",
  "relationship",
  "athlete_user_id",
  "artefacts"
]);

const noteInputKeys = new Set([
  "coach_profile",
  "relationship",
  "athlete_user_id",
  "session_id",
  "artefact_id",
  "note_text",
  "visibility"
]);

export class Beta17CoachManagedError
  extends Error {
  readonly reason: string;
  readonly failure_token: string;

  constructor(reason: string) {
    super(`beta17_coach_managed_${reason}`);
    this.name =
      "Beta17CoachManagedError";
    this.reason = reason;
    this.failure_token =
      "beta17_coach_managed_invalid";
  }
}

function isRecord(
  value: unknown
): value is JsonRecord {
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

function cleanString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isIso8601(
  value: unknown
): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const parsed = Date.parse(value);

  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString() === value
  );
}

function isIsoOrNull(
  value: unknown
): value is string | null {
  return (
    value === null ||
    isIso8601(value)
  );
}

function cloneJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value)
  ) as T;
}

function deepFreeze<T>(value: T): T {
  if (
    value === null ||
    (
      typeof value !== "object" &&
      typeof value !== "function"
    )
  ) {
    return value;
  }

  if (Object.isFrozen(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
  }
  else {
    Object.values(
      value as JsonRecord
    ).forEach(deepFreeze);
  }

  return Object.freeze(value);
}

function stableValue(
  value: unknown
): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  const output: JsonRecord = {};

  for (
    const key of Object.keys(value).sort()
  ) {
    output[key] =
      stableValue(value[key]);
  }

  return output;
}

export function stableBeta17CoachManagedJson(
  value: unknown
): string {
  return JSON.stringify(
    stableValue(value)
  );
}

function sha256(
  value: unknown
): string {
  return crypto
    .createHash("sha256")
    .update(
      stableBeta17CoachManagedJson(value),
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
    if (key !== "record_sha256") {
      payload[key] = record[key];
    }
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
    throw new Beta17CoachManagedError(
      `${recordType}_record_invalid`
    );
  }

  if (
    typeof record.record_sha256 !==
      "string" ||
    !/^[a-f0-9]{64}$/u.test(
      record.record_sha256
    )
  ) {
    throw new Beta17CoachManagedError(
      `${recordType}_hash_invalid`
    );
  }

  if (
    record.record_sha256 !==
    sha256(recordPayload(record))
  ) {
    throw new Beta17CoachManagedError(
      `${recordType}_hash_mismatch`
    );
  }
}

function assertNoForbiddenKeys(
  value: unknown,
  path: string[] = []
): void {
  if (Array.isArray(value)) {
    value.forEach(
      (entry, index) =>
        assertNoForbiddenKeys(
          entry,
          [...path, String(index)]
        )
    );

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (
    const [key, child]
    of Object.entries(value)
  ) {
    if (forbiddenKeys.has(key)) {
      throw new Beta17CoachManagedError(
        `forbidden_field_${[
          ...path,
          key
        ].join("_")}`
      );
    }

    assertNoForbiddenKeys(
      child,
      [...path, key]
    );
  }
}

function assertExactKeys(
  value: JsonRecord,
  keys: Set<string>,
  reason: string
): void {
  for (
    const key of Object.keys(value)
  ) {
    if (!keys.has(key)) {
      throw new Beta17CoachManagedError(
        `${reason}_unknown_field`
      );
    }
  }

  for (const key of keys) {
    if (!hasOwn(value, key)) {
      throw new Beta17CoachManagedError(
        `${reason}_${key}_required`
      );
    }
  }
}

function rejection(
  error: unknown,
  denied = false
): Beta17HttpResult {
  const reason =
    error instanceof
      Beta17CoachManagedError
      ? error.reason
      : "unexpected_failure";

  return deepFreeze({
    status: denied ? 403 : 400,
    body: {
      ok: false,
      surface_id:
        beta17CoachManagedContract
          .surface_id,
      failure_token:
        "beta17_coach_managed_invalid",
      reason,
      product_permission_state_only:
        true,
      engine_visible: false,
      copy_id: denied
        ? BETA17_COACH_COPY_IDS
            .accessDenied
        : BETA17_COACH_COPY_IDS.error
    }
  });
}

function assertCoachProfileActive(
  profile: unknown
): asserts profile is JsonRecord {
  assertRecordIntegrity(
    profile,
    "beta17_coach_profile"
  );

  if (
    profile.account_role !== "coach" ||
    profile.account_state !== "active" ||
    profile.product_auth_state_only !==
      true ||
    profile.engine_visible !== false
  ) {
    throw new Beta17CoachManagedError(
      "coach_profile_not_active"
    );
  }
}

function assertAcceptedRelationship(
  relationship: unknown,
  coachUserId: string,
  athleteUserId: string
): asserts relationship is JsonRecord {
  assertRecordIntegrity(
    relationship,
    "beta17_coach_relationship"
  );

  if (
    relationship.coach_user_id !==
      coachUserId ||
    relationship.athlete_user_id !==
      athleteUserId
  ) {
    throw new Beta17CoachManagedError(
      "relationship_identity_mismatch"
    );
  }

  if (
    relationship.relationship_scope !==
      "individual_coach_athlete" ||
    relationship.relationship_state !==
      "accepted" ||
    relationship.revoked_at_iso8601 !==
      null ||
    relationship.expires_at_iso8601 !==
      null
  ) {
    throw new Beta17CoachManagedError(
      "relationship_access_denied"
    );
  }

  if (
    relationship
      .product_permission_state_only !==
      true ||
    relationship.engine_visible !== false
  ) {
    throw new Beta17CoachManagedError(
      "relationship_boundary_invalid"
    );
  }
}

function permissionContext(
  profile: unknown,
  relationship: unknown,
  athleteUserId: unknown
): Readonly<JsonRecord> {
  assertCoachProfileActive(profile);

  const profileRecord =
    profile as JsonRecord;

  const coachUserId =
    cleanString(
      profileRecord.coach_user_id
    );

  const targetAthleteUserId =
    cleanString(athleteUserId);

  if (!targetAthleteUserId) {
    throw new Beta17CoachManagedError(
      "athlete_user_id_required"
    );
  }

  assertAcceptedRelationship(
    relationship,
    coachUserId,
    targetAthleteUserId
  );

  const relationshipRecord =
    relationship as JsonRecord;

  return deepFreeze({
    coach_user_id: coachUserId,
    athlete_user_id:
      targetAthleteUserId,
    relationship_id:
      relationshipRecord
        .relationship_id,
    product_permission_state_only:
      true,
    engine_visible: false
  });
}

export function createBeta17CoachProfileRecord(
  input: unknown
): Beta17HttpResult {
  try {
    if (!isRecord(input)) {
      throw new Beta17CoachManagedError(
        "coach_profile_input_invalid"
      );
    }

    assertNoForbiddenKeys(input);
    assertExactKeys(
      input,
      profileInputKeys,
      "coach_profile"
    );

    const coachUserId =
      cleanString(input.coach_user_id);
    const email =
      cleanString(input.email)
        .toLowerCase();
    const displayName =
      cleanString(input.display_name);
    const terms =
      cleanString(
        input.accepted_terms_version
      );

    if (!coachUserId) {
      throw new Beta17CoachManagedError(
        "coach_user_id_required"
      );
    }

    if (
      !email ||
      !email.includes("@")
    ) {
      throw new Beta17CoachManagedError(
        "coach_email_invalid"
      );
    }

    if (!displayName) {
      throw new Beta17CoachManagedError(
        "coach_display_name_required"
      );
    }

    if (input.account_role !== "coach") {
      throw new Beta17CoachManagedError(
        "coach_role_invalid"
      );
    }

    if (
      input.account_state !== "active" &&
      input.account_state !== "invited"
    ) {
      throw new Beta17CoachManagedError(
        "coach_state_invalid"
      );
    }

    if (!terms) {
      throw new Beta17CoachManagedError(
        "coach_terms_required"
      );
    }

    if (
      !isIso8601(
        input.created_at_iso8601
      )
    ) {
      throw new Beta17CoachManagedError(
        "coach_created_at_invalid"
      );
    }

    const coachProfile =
      withRecordHash({
        record_type:
          "beta17_coach_profile",
        coach_user_id: coachUserId,
        email,
        display_name: displayName,
        account_role: "coach",
        account_state:
          input.account_state,
        accepted_terms_version: terms,
        created_at_iso8601:
          input.created_at_iso8601,
        product_auth_state_only: true,
        engine_visible: false,
        can_edit_athlete_declaration:
          false,
        can_alter_registries: false,
        can_override_engine_decisions:
          false,
        copy_id:
          BETA17_COACH_COPY_IDS
            .profileRecorded
      });

    return deepFreeze({
      status: 201,
      body: {
        ok: true,
        surface_id:
          beta17CoachManagedContract
            .surface_id,
        coach_profile: coachProfile
      }
    });
  }
  catch (error) {
    return rejection(error);
  }
}

export function createBeta17RelationshipRecord(
  input: unknown
): Beta17HttpResult {
  try {
    if (!isRecord(input)) {
      throw new Beta17CoachManagedError(
        "relationship_input_invalid"
      );
    }

    assertNoForbiddenKeys(input);
    assertExactKeys(
      input,
      relationshipInputKeys,
      "relationship"
    );

    const relationshipId =
      cleanString(
        input.relationship_id
      );

    const coachUserId =
      cleanString(
        input.coach_user_id
      );

    const athleteUserId =
      cleanString(
        input.athlete_user_id
      );

    if (
      !relationshipId ||
      !coachUserId ||
      !athleteUserId
    ) {
      throw new Beta17CoachManagedError(
        "relationship_identity_required"
      );
    }

    if (
      input.relationship_scope !==
      "individual_coach_athlete"
    ) {
      throw new Beta17CoachManagedError(
        "relationship_scope_invalid"
      );
    }

    if (
      input.relationship_state !==
        "invited" &&
      input.relationship_state !==
        "accepted" &&
      input.relationship_state !==
        "revoked"
    ) {
      throw new Beta17CoachManagedError(
        "relationship_state_invalid"
      );
    }

    if (
      !isIso8601(
        input.created_at_iso8601
      ) ||
      !isIso8601(
        input.updated_at_iso8601
      ) ||
      !isIsoOrNull(
        input.accepted_at_iso8601
      ) ||
      !isIsoOrNull(
        input.revoked_at_iso8601
      ) ||
      !isIsoOrNull(
        input.expires_at_iso8601
      )
    ) {
      throw new Beta17CoachManagedError(
        "relationship_timestamp_invalid"
      );
    }

    if (
      input.relationship_state ===
        "accepted" &&
      input.accepted_at_iso8601 ===
        null
    ) {
      throw new Beta17CoachManagedError(
        "relationship_acceptance_required"
      );
    }

    if (
      input.relationship_state ===
        "revoked" &&
      input.revoked_at_iso8601 ===
        null
    ) {
      throw new Beta17CoachManagedError(
        "relationship_revocation_required"
      );
    }

    if (
      input.relationship_state !==
        "revoked" &&
      input.revoked_at_iso8601 !==
        null
    ) {
      throw new Beta17CoachManagedError(
        "relationship_revocation_invalid"
      );
    }

    const copyId =
      input.relationship_state ===
        "invited"
        ? BETA17_COACH_COPY_IDS
            .relationshipInvited
        : input.relationship_state ===
            "accepted"
          ? BETA17_COACH_COPY_IDS
              .relationshipAccepted
          : BETA17_COACH_COPY_IDS
              .relationshipRevoked;

    const relationship =
      withRecordHash({
        record_type:
          "beta17_coach_relationship",
        relationship_id:
          relationshipId,
        coach_user_id: coachUserId,
        athlete_user_id:
          athleteUserId,
        relationship_state:
          input.relationship_state,
        relationship_scope:
          "individual_coach_athlete",
        accepted_at_iso8601:
          input.accepted_at_iso8601,
        created_at_iso8601:
          input.created_at_iso8601,
        updated_at_iso8601:
          input.updated_at_iso8601,
        revoked_at_iso8601:
          input.revoked_at_iso8601,
        expires_at_iso8601:
          input.expires_at_iso8601,
        scope: deepFreeze({
          coach_notes: true,
          session_artefacts: true,
          coach_factual_artefact_view:
            true
        }),
        product_permission_state_only:
          true,
        engine_visible: false,
        copy_id: copyId
      });

    return deepFreeze({
      status: 201,
      body: {
        ok: true,
        surface_id:
          beta17CoachManagedContract
            .surface_id,
        relationship
      }
    });
  }
  catch (error) {
    return rejection(error);
  }
}

export function createBeta17AssignmentRecord(
  input: unknown
): Beta17HttpResult {
  try {
    if (!isRecord(input)) {
      throw new Beta17CoachManagedError(
        "assignment_input_invalid"
      );
    }

    assertNoForbiddenKeys(input);
    assertExactKeys(
      input,
      assignmentInputKeys,
      "assignment"
    );

    const access =
      permissionContext(
        input.coach_profile,
        input.relationship,
        input.athlete_user_id
      );

    const requestId =
      cleanString(input.request_id);

    const templateId =
      cleanString(input.template_id);

    const activityId =
      cleanString(input.activity_id);

    if (!requestId || !templateId) {
      throw new Beta17CoachManagedError(
        "assignment_identity_required"
      );
    }

    if (
      !isIso8601(
        input.requested_at_iso8601
      )
    ) {
      throw new Beta17CoachManagedError(
        "assignment_timestamp_invalid"
      );
    }

    if (
      !supportedActivities.has(
        activityId
      )
    ) {
      throw new Beta17CoachManagedError(
        "assignment_activity_invalid"
      );
    }

    const hashInput = {
      request_id: requestId,
      requested_at_iso8601:
        input.requested_at_iso8601,
      coach_user_id:
        access.coach_user_id,
      athlete_user_id:
        access.athlete_user_id,
      relationship_id:
        access.relationship_id,
      template_id: templateId,
      activity_id: activityId
    };

    const assignmentHash =
      sha256(hashInput);

    const assignment =
      withRecordHash({
        record_type:
          "beta17_assignment_trigger",
        assignment_id:
          `beta17_assignment_${assignmentHash.slice(
            0,
            24
          )}`,
        assignment_hash:
          assignmentHash,
        upstream_contract:
          "S-V1-28",
        request_id: requestId,
        requested_at_iso8601:
          input.requested_at_iso8601,
        assigned_by_coach_id:
          access.coach_user_id,
        assigned_athlete_id:
          access.athlete_user_id,
        relationship_id:
          access.relationship_id,
        template_id: templateId,
        activity_id: activityId,
        assignment_status:
          "assigned",
        assignment_scope:
          "coach_athlete_assigned_execution",
        compile_input_status:
          "not_consumed_until_athlete_declared_compile_input",
        engine_visible: false,
        assignment_mutates_engine_truth:
          false,
        athlete_declaration_mutated:
          false,
        registries_mutated: false,
        engine_decision_overridden:
          false,
        copy_id:
          BETA17_COACH_COPY_IDS
            .assignmentRecorded
      });

    return deepFreeze({
      status: 201,
      body: {
        ok: true,
        surface_id:
          beta17CoachManagedContract
            .surface_id,
        assignment
      }
    });
  }
  catch (error) {
    const denied =
      error instanceof
        Beta17CoachManagedError &&
      error.reason.includes(
        "relationship"
      );

    return rejection(error, denied);
  }
}

function factualEvent(
  event: unknown,
  index: number
): Readonly<JsonRecord> {
  if (!isRecord(event)) {
    throw new Beta17CoachManagedError(
      "artefact_event_invalid"
    );
  }

  const eventType =
    cleanString(
      event.event_type ??
      event.type
    );

  if (!eventType) {
    throw new Beta17CoachManagedError(
      "artefact_event_type_required"
    );
  }

  return deepFreeze({
    event_id:
      cleanString(
        event.event_id
      ) || null,
    event_type: eventType,
    seq:
      Number.isSafeInteger(event.seq)
        ? event.seq
        : index + 1,
    recorded_at:
      cleanString(
        event.recorded_at ??
        event.created_at
      ) || null,
    work_item_id:
      cleanString(
        event.work_item_id ??
        event.item_id
      ) || null
  });
}

function factualArtefact(
  artefact: unknown,
  athleteUserId: string,
  index: number
): Readonly<JsonRecord> | null {
  if (!isRecord(artefact)) {
    throw new Beta17CoachManagedError(
      "artefact_invalid"
    );
  }

  const artefactAthleteId =
    cleanString(
      artefact.athlete_user_id
    );

  if (
    artefactAthleteId !==
      athleteUserId
  ) {
    return null;
  }

  const artefactId =
    cleanString(
      artefact.artefact_id
    );

  const sessionId =
    cleanString(
      artefact.session_id
    );

  if (!artefactId || !sessionId) {
    throw new Beta17CoachManagedError(
      "artefact_identity_required"
    );
  }

  const events =
    Array.isArray(
      artefact.runtime_events
    )
      ? artefact.runtime_events
      : [];

  const factualEvents =
    events
      .map(factualEvent)
      .sort(
        (left, right) =>
          Number(left.seq) -
          Number(right.seq)
      );

  return deepFreeze({
    artefact_id: artefactId,
    session_id: sessionId,
    athlete_user_id:
      artefactAthleteId,
    artefact_type:
      cleanString(
        artefact.artefact_type
      ) ||
      "session_runtime_artefact",
    session_status:
      cleanString(
        artefact.session_status
      ) || null,
    recorded_at:
      cleanString(
        artefact.recorded_at
      ) || null,
    runtime_event_count:
      factualEvents.length,
    runtime_events:
      factualEvents
  });
}

export function buildBeta17CoachArtefactView(
  input: unknown
): Beta17HttpResult {
  try {
    if (!isRecord(input)) {
      throw new Beta17CoachManagedError(
        "artefact_view_input_invalid"
      );
    }

    assertNoForbiddenKeys(input);
    assertExactKeys(
      input,
      artefactViewInputKeys,
      "artefact_view"
    );

    const access =
      permissionContext(
        input.coach_profile,
        input.relationship,
        input.athlete_user_id
      );

    if (!Array.isArray(input.artefacts)) {
      throw new Beta17CoachManagedError(
        "artefacts_array_required"
      );
    }

    const artefacts =
      input.artefacts
        .map(
          (artefact, index) =>
            factualArtefact(
              artefact,
              String(
                access.athlete_user_id
              ),
              index
            )
        )
        .filter(
          (
            artefact
          ): artefact is Readonly<JsonRecord> =>
            artefact !== null
        )
        .sort(
          (left, right) =>
            String(
              left.session_id
            ).localeCompare(
              String(
                right.session_id
              )
            )
        );

    const viewWithoutHash = {
      record_type:
        "beta17_coach_artefact_view",
      coach_user_id:
        access.coach_user_id,
      athlete_user_id:
        access.athlete_user_id,
      relationship_id:
        access.relationship_id,
      artefact_count:
        artefacts.length,
      artefacts,
      factual_records_only: true,
      coach_notes_stored_separately:
        true,
      read_only: true,
      calls_engine: false,
      mutates_session_state: false,
      engine_visible: false,
      copy_id:
        BETA17_COACH_COPY_IDS
          .artefactLoaded
    };

    const artefactView =
      deepFreeze({
        ...viewWithoutHash,
        read_model_sha256:
          sha256(viewWithoutHash)
      });

    return deepFreeze({
      status: 200,
      body: {
        ok: true,
        surface_id:
          beta17CoachManagedContract
            .surface_id,
        artefact_view: artefactView
      }
    });
  }
  catch (error) {
    const denied =
      error instanceof
        Beta17CoachManagedError &&
      error.reason.includes(
        "relationship"
      );

    return rejection(error, denied);
  }
}

export function createBeta17CoachNoteRecord(
  input: unknown
): Beta17HttpResult {
  try {
    if (!isRecord(input)) {
      throw new Beta17CoachManagedError(
        "coach_note_input_invalid"
      );
    }

    assertNoForbiddenKeys(input);
    assertExactKeys(
      input,
      noteInputKeys,
      "coach_note"
    );

    const access =
      permissionContext(
        input.coach_profile,
        input.relationship,
        input.athlete_user_id
      );

    const sessionId =
      cleanString(input.session_id);

    const artefactId =
      cleanString(input.artefact_id);

    const noteText =
      typeof input.note_text ===
        "string"
        ? input.note_text
        : "";

    if (
      !sessionId ||
      !artefactId ||
      !noteText.trim()
    ) {
      throw new Beta17CoachManagedError(
        "coach_note_fields_required"
      );
    }

    if (
      input.visibility !==
        "coach_private" &&
      input.visibility !==
        "athlete_visible"
    ) {
      throw new Beta17CoachManagedError(
        "coach_note_visibility_invalid"
      );
    }

    const notePayload = {
      coach_user_id:
        access.coach_user_id,
      athlete_user_id:
        access.athlete_user_id,
      relationship_id:
        access.relationship_id,
      session_id: sessionId,
      artefact_id: artefactId,
      note_text: noteText,
      visibility: input.visibility
    };

    const noteHash =
      sha256(notePayload);

    const coachNote =
      withRecordHash({
        record_type:
          "beta17_coach_note",
        note_id:
          `beta17_note_${noteHash.slice(
            0,
            24
          )}`,
        ...notePayload,
        non_binding: true,
        product_record_only: true,
        stored_separately_from_artefact:
          true,
        included_in_engine_input:
          false,
        included_in_compile_hash:
          false,
        changes_engine_output:
          false,
        engine_visible: false,
        copy_id:
          BETA17_COACH_COPY_IDS
            .noteRecorded
      });

    return deepFreeze({
      status: 201,
      body: {
        ok: true,
        surface_id:
          beta17CoachManagedContract
            .surface_id,
        coach_note: coachNote
      }
    });
  }
  catch (error) {
    const denied =
      error instanceof
        Beta17CoachManagedError &&
      error.reason.includes(
        "relationship"
      );

    return rejection(error, denied);
  }
}
