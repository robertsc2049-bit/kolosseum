// DEV NOTE: FULL-UI-04C persistent coach onboarding boundary.
// Coach profile, terms and completion are product-account state only.
// They cannot enter compile inputs, alter engine output or grant engine authority.

import {
  randomUUID
} from "node:crypto";

import {
  pool
} from "../db/pool.js";

import {
  createBeta17CoachProfileRecord
} from "./beta17_coach_managed_service.js";

import {
  loadLatestBetaProductRecord,
  persistBetaProductRecord
} from "./beta_product_record_store.js";

import {
  CURRENT_TERMS_VERSION,
  ProductAccountError,
  resolveProductSession,
  updateProductAccountProfile
} from "./product_account_service.js";

type JsonRecord =
  Record<string, unknown>;

type CoachOnboardingEventType =
  | "coach_onboarding_profile_saved"
  | "coach_terms_accepted"
  | "coach_onboarding_completed";

type CoachIdentity = Readonly<{
  user_id: string;
  account: Readonly<JsonRecord>;
}>;

const COACH_ONBOARDING_EVENT_TYPES =
  Object.freeze([
    "coach_onboarding_profile_saved",
    "coach_terms_accepted",
    "coach_onboarding_completed"
  ] as const);

const ENGINE_INERT_STATE =
  Object.freeze({
    calls_engine: false,
    engine_visible: false,
    engine_decision: false,
    engine_legality: "not_mutated",
    compile_input: "not_read_or_written",
    compile_output: "not_mutated",
    session_state: "not_read_or_written",
    registry_law: "not_mutated"
  });

export class CoachOnboardingError
  extends Error {
  readonly code: string;
  readonly status: number;
  readonly field_errors:
    Readonly<Record<string, string>>;

  constructor(
    code: string,
    status = 400,
    fieldErrors:
      Record<string, string> = {}
  ) {
    super(code);
    this.name = "CoachOnboardingError";
    this.code = code;
    this.status = status;
    this.field_errors =
      Object.freeze({
        ...fieldErrors
      });
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

function cleanString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function assertExactKeys(
  input: unknown,
  requiredKeys: readonly string[]
): JsonRecord {
  if (!isRecord(input)) {
    throw new CoachOnboardingError(
      "coach_onboarding_input_invalid",
      422
    );
  }

  const required =
    new Set(requiredKeys);

  for (const key of Object.keys(input)) {
    if (!required.has(key)) {
      throw new CoachOnboardingError(
        "coach_onboarding_unknown_field",
        422,
        {
          [key]:
            "This field is not part of coach onboarding."
        }
      );
    }
  }

  for (const key of required) {
    if (
      !Object.prototype.hasOwnProperty.call(
        input,
        key
      )
    ) {
      throw new CoachOnboardingError(
        "coach_onboarding_field_required",
        422,
        {
          [key]: "This field is required."
        }
      );
    }
  }

  return input;
}

export function
validateCoachOnboardingProfileInput(
  inputValue: unknown
): Readonly<{
  display_name: string;
  email: string;
}> {
  const input = assertExactKeys(
    inputValue,
    [
      "display_name",
      "email"
    ]
  );

  const displayName =
    cleanString(input.display_name);

  const email =
    cleanString(input.email)
      .toLowerCase();

  const fieldErrors:
    Record<string, string> = {};

  if (
    displayName.length < 2 ||
    displayName.length > 100
  ) {
    fieldErrors.display_name =
      "Display name must contain 2 to 100 characters.";
  }

  if (
    !email ||
    email.length > 320 ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(
      email
    )
  ) {
    fieldErrors.email =
      "Enter a valid email address.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new CoachOnboardingError(
      "coach_onboarding_profile_invalid",
      422,
      fieldErrors
    );
  }

  return Object.freeze({
    display_name: displayName,
    email
  });
}

export function validateCoachTermsInput(
  inputValue: unknown
): Readonly<{
  accepted: true;
  terms_version: string;
}> {
  const input = assertExactKeys(
    inputValue,
    [
      "accepted",
      "terms_version"
    ]
  );

  const termsVersion =
    cleanString(input.terms_version);

  const fieldErrors:
    Record<string, string> = {};

  if (input.accepted !== true) {
    fieldErrors.accepted =
      "Coach terms must be explicitly accepted.";
  }

  if (
    termsVersion !==
    CURRENT_TERMS_VERSION
  ) {
    fieldErrors.terms_version =
      "The current coach terms version must be accepted.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new CoachOnboardingError(
      "coach_terms_invalid",
      422,
      fieldErrors
    );
  }

  return Object.freeze({
    accepted: true,
    terms_version:
      CURRENT_TERMS_VERSION
  });
}

export function
validateCoachCompletionInput(
  inputValue: unknown
): true {
  const input = assertExactKeys(
    inputValue,
    [
      "completion_confirmed"
    ]
  );

  if (
    input.completion_confirmed !==
    true
  ) {
    throw new CoachOnboardingError(
      "coach_onboarding_completion_invalid",
      422,
      {
        completion_confirmed:
          "Review and confirm coach onboarding."
      }
    );
  }

  return true;
}

async function coachIdentity(
  rawSessionToken: string
): Promise<CoachIdentity> {
  const session =
    await resolveProductSession(
      rawSessionToken
    );

  const account =
    session.account;

  const actorType =
    cleanString(
      account.actor_type
    );

  const userId =
    cleanString(
      account.user_id
    );

  if (!userId) {
    throw new ProductAccountError(
      "account_session_invalid",
      401
    );
  }

  if (actorType !== "coach") {
    throw new CoachOnboardingError(
      "coach_onboarding_coach_required",
      403
    );
  }

  return Object.freeze({
    user_id: userId,
    account
  });
}

async function appendEvent(
  userId: string,
  eventType:
    CoachOnboardingEventType,
  payload: JsonRecord
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
    VALUES (
      $1,
      $2,
      $3,
      $4::jsonb,
      now()
    )
    `,
    [
      `account_event_${randomUUID()}`,
      userId,
      eventType,
      JSON.stringify(payload)
    ]
  );
}

async function onboardingEvents(
  userId: string
): Promise<readonly Readonly<JsonRecord>[]> {
  const result =
    await pool.query(
      `
      SELECT
        event_id,
        event_type,
        event_payload,
        occurred_at
          AS occurred_at_iso8601
      FROM product_account_events
      WHERE
        user_id = $1
        AND event_type = ANY($2::text[])
      ORDER BY
        occurred_at DESC,
        event_id DESC
      `,
      [
        userId,
        COACH_ONBOARDING_EVENT_TYPES
      ]
    );

  return Object.freeze(
    (result.rows ?? [])
      .filter(isRecord)
      .map(
        (row) =>
          Object.freeze({
            event_id:
              cleanString(row.event_id),
            event_type:
              cleanString(row.event_type),
            event_payload:
              isRecord(row.event_payload)
                ? Object.freeze({
                    ...row.event_payload
                  })
                : Object.freeze({}),
            occurred_at_iso8601:
              new Date(
                String(
                  row.occurred_at_iso8601
                )
              ).toISOString()
          })
      )
  );
}

function latestEvent(
  events:
    readonly Readonly<JsonRecord>[],
  eventType:
    CoachOnboardingEventType
): Readonly<JsonRecord> | null {
  return (
    events.find(
      (event) =>
        event.event_type ===
        eventType
    ) ??
    null
  );
}

function publicProfile(
  profile:
    Readonly<JsonRecord> | null,
  account:
    Readonly<JsonRecord>
): Readonly<JsonRecord> {
  return Object.freeze({
    coach_user_id:
      cleanString(
        profile?.coach_user_id
      ) ||
      cleanString(
        account.user_id
      ),
    display_name:
      cleanString(
        profile?.display_name
      ) ||
      cleanString(
        account.display_name
      ),
    email:
      cleanString(
        profile?.email
      ) ||
      cleanString(
        account.email
      ),
    account_role: "coach",
    account_state:
      cleanString(
        profile?.account_state
      ) ||
      cleanString(
        account.account_state
      ),
    accepted_account_terms_version:
      cleanString(
        profile
          ?.accepted_terms_version
      ) ||
      cleanString(
        account
          .accepted_terms_version
      ),
    profile_record_sha256:
      cleanString(
        profile?.record_sha256
      ) ||
      null,
    profile_effective_at_iso8601:
      cleanString(
        profile
          ?.created_at_iso8601
      ) ||
      null,
    product_account_state_only:
      true,
    engine_visible: false
  });
}

async function reconstructedState(
  identity: CoachIdentity
): Promise<Readonly<JsonRecord>> {
  const [
    events,
    profile
  ] = await Promise.all([
    onboardingEvents(
      identity.user_id
    ),
    loadLatestBetaProductRecord(
      "beta17_coach_profile",
      identity.user_id,
      identity.user_id
    )
  ]);

  const profileEvent =
    latestEvent(
      events,
      "coach_onboarding_profile_saved"
    );

  const termsEvent =
    events.find((event) => {
      if (
        event.event_type !==
        "coach_terms_accepted"
      ) {
        return false;
      }

      const payload =
        isRecord(
          event.event_payload
        )
          ? event.event_payload
          : {};

      return (
        payload.accepted === true &&
        payload.terms_version ===
          CURRENT_TERMS_VERSION
      );
    }) ?? null;

  const completionEvent =
    latestEvent(
      events,
      "coach_onboarding_completed"
    );

  const profileSaved =
    Boolean(
      profileEvent &&
      profile
    );

  const termsAccepted =
    Boolean(termsEvent);

  const completionPersisted =
    Boolean(completionEvent);

  const completed =
    profileSaved &&
    termsAccepted &&
    completionPersisted;

  const currentStage =
    completed
      ? "completed"
      : !profileSaved
        ? "profile"
        : !termsAccepted
          ? "terms"
          : "review";

  return Object.freeze({
    ok: true,
    slice_id: "FULL-UI-04C",
    actor_type: "coach",
    onboarding_status:
      completed
        ? "completed"
        : "incomplete",
    current_stage: currentStage,
    profile_saved:
      profileSaved,
    terms_accepted:
      termsAccepted,
    completion_persisted:
      completionPersisted,
    current_terms_version:
      CURRENT_TERMS_VERSION,
    accepted_terms_version:
      termsAccepted
        ? CURRENT_TERMS_VERSION
        : null,
    profile:
      publicProfile(
        profile,
        identity.account
      ),
    workspace_route:
      "#/coach/overview",
    account_route:
      "#/account",
    history:
      events.map((event) =>
        Object.freeze({
          event_id:
            event.event_id,
          event_type:
            event.event_type,
          occurred_at_iso8601:
            event
              .occurred_at_iso8601,
          event_payload:
            event.event_payload
        })
      ),
    factual_state_only: true,
    product_account_state_only:
      true,
    ...ENGINE_INERT_STATE
  });
}

export async function
getCoachOnboardingState(
  rawSessionToken: string
): Promise<Readonly<JsonRecord>> {
  const identity =
    await coachIdentity(
      rawSessionToken
    );

  return reconstructedState(
    identity
  );
}

export async function
saveCoachOnboardingProfile(
  rawSessionToken: string,
  inputValue: unknown
): Promise<Readonly<JsonRecord>> {
  const identity =
    await coachIdentity(
      rawSessionToken
    );

  const input =
    validateCoachOnboardingProfileInput(
      inputValue
    );

  const profileUpdate =
    await updateProductAccountProfile(
      rawSessionToken,
      input
    );

  const now =
    new Date().toISOString();

  const profileResult =
    createBeta17CoachProfileRecord({
      coach_user_id:
        identity.user_id,
      email: input.email,
      display_name:
        input.display_name,
      account_role: "coach",
      account_state: "active",
      accepted_terms_version:
        CURRENT_TERMS_VERSION,
      created_at_iso8601: now
    });

  if (profileResult.status !== 201) {
    throw new CoachOnboardingError(
      cleanString(
        profileResult.body.reason
      ) ||
      "coach_profile_persistence_failed",
      422
    );
  }

  const persistedProfile =
    await persistBetaProductRecord(
      profileResult.body
        .coach_profile
    );

  await appendEvent(
    identity.user_id,
    "coach_onboarding_profile_saved",
    {
      display_name:
        input.display_name,
      email: input.email,
      profile_record_sha256:
        cleanString(
          persistedProfile
            .record_sha256
        ),
      profile_effective_at_iso8601:
        now,
      product_account_state_only:
        true,
      engine_visible: false
    }
  );

  const state =
    await reconstructedState({
      user_id:
        identity.user_id,
      account:
        profileUpdate.account
    });

  return Object.freeze({
    ...state,
    verification:
      profileUpdate.verification
  });
}

export async function
acceptCoachOnboardingTerms(
  rawSessionToken: string,
  inputValue: unknown
): Promise<Readonly<JsonRecord>> {
  const identity =
    await coachIdentity(
      rawSessionToken
    );

  const input =
    validateCoachTermsInput(
      inputValue
    );

  const current =
    await reconstructedState(
      identity
    );

  if (
    current.profile_saved !==
    true
  ) {
    throw new CoachOnboardingError(
      "coach_onboarding_profile_required",
      422,
      {
        profile:
          "Save the coach profile before accepting coach terms."
      }
    );
  }

  if (
    current.terms_accepted !==
    true
  ) {
    await appendEvent(
      identity.user_id,
      "coach_terms_accepted",
      {
        accepted:
          input.accepted,
        terms_version:
          input.terms_version,
        acceptance_scope:
          "coach_product_access",
        product_account_state_only:
          true,
        engine_visible: false
      }
    );
  }

  return reconstructedState(
    identity
  );
}

export async function
completeCoachOnboarding(
  rawSessionToken: string,
  inputValue: unknown
): Promise<Readonly<JsonRecord>> {
  validateCoachCompletionInput(
    inputValue
  );

  const identity =
    await coachIdentity(
      rawSessionToken
    );

  const current =
    await reconstructedState(
      identity
    );

  const fieldErrors:
    Record<string, string> = {};

  if (
    current.profile_saved !==
    true
  ) {
    fieldErrors.profile =
      "Save the coach profile.";
  }

  if (
    current.terms_accepted !==
    true
  ) {
    fieldErrors.terms =
      "Accept the current coach terms.";
  }

  if (
    Object.keys(fieldErrors)
      .length > 0
  ) {
    throw new CoachOnboardingError(
      "coach_onboarding_incomplete",
      422,
      fieldErrors
    );
  }

  if (
    current.completion_persisted !==
    true
  ) {
    await appendEvent(
      identity.user_id,
      "coach_onboarding_completed",
      {
        completion_confirmed:
          true,
        terms_version:
          CURRENT_TERMS_VERSION,
        lawful_workspace_route:
          "#/coach/overview",
        product_account_state_only:
          true,
        engine_visible: false
      }
    );
  }

  return reconstructedState(
    identity
  );
}