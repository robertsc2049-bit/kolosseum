// DEV NOTE: FULL-UI-08 controlled-launch commercial product state.
// Billing, checkout, portal and seat records are product state only. This service
// never imports engine code and cannot change compile, substitution, replay,
// proof, factual history or coach-athlete relationship truth.

import { createHash, randomUUID } from "node:crypto";

import Stripe from "stripe";

import { pool } from "../db/pool.js";

type JsonRecord = Record<string, unknown>;
type ActorType = "athlete" | "coach";
type CommercialRecordType =
  | "commercial_checkout_requested"
  | "commercial_payment_return_recorded"
  | "commercial_billing_access_updated"
  | "commercial_portal_requested";

type CommercialConfig = Readonly<{
  actor_type: ActorType;
  configuration_state: "ready" | "missing" | "not_applicable";
  missing_configuration: readonly string[];
  provider: "stripe_checkout" | "equivalent_checkout";
  portal_provider:
    | "stripe_customer_portal"
    | "equivalent_customer_portal";
  plan_id: string | null;
  provider_price_id: string | null;
  seat_limit: number | null;
  application_url: string | null;
  checkout_url: string | null;
  portal_url: string | null;
}>;

type StoredCommercialRecord = Readonly<{
  commercial_record_id: string;
  user_id: string;
  request_id: string;
  record_type: CommercialRecordType;
  effective_at_iso8601: string;
  record_payload: JsonRecord;
  record_sha256: string;
  created_at_iso8601: string;
}>;

const ENGINE_INERT_STATE = Object.freeze({
  calls_engine: false,
  engine_visible: false,
  engine_decision: false,
  engine_legality: "not_mutated",
  compile_output: "not_mutated",
  substitution_selection: "not_mutated",
  replay_record: "not_mutated",
  proof_record: "not_mutated",
  factual_history_record: "not_mutated",
  coach_athlete_relationship_truth:
    "not_read_not_written_not_inferred",
  relationship_truth_mutation: "not_performed"
});

const ALLOWED_RECORD_TYPES =
  new Set<CommercialRecordType>([
    "commercial_checkout_requested",
    "commercial_payment_return_recorded",
    "commercial_billing_access_updated",
    "commercial_portal_requested"
  ]);

export class ProductCommercialError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Readonly<JsonRecord>;

  constructor(
    code: string,
    status = 400,
    details: JsonRecord = {}
  ) {
    super(code);
    this.name = "ProductCommercialError";
    this.code = code;
    this.status = status;
    this.details = Object.freeze({ ...details });
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function assertExactKeys(
  input: unknown,
  allowedKeys: readonly string[]
): JsonRecord {
  if (!isRecord(input)) {
    throw new ProductCommercialError(
      "commercial_input_required"
    );
  }

  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      throw new ProductCommercialError(
        "commercial_unknown_field",
        400,
        { field: key }
      );
    }
  }

  return input;
}

function requestId(value: unknown): string {
  const candidate = cleanString(value);

  if (
    !candidate ||
    candidate.length > 120 ||
    !/^[A-Za-z0-9_.:-]+$/u.test(candidate)
  ) {
    throw new ProductCommercialError(
      "commercial_request_id_invalid"
    );
  }

  return candidate;
}

function actorType(value: unknown): ActorType {
  if (value !== "athlete" && value !== "coach") {
    throw new ProductCommercialError(
      "commercial_actor_type_invalid",
      403
    );
  }

  return value;
}

function positiveInteger(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : Number(cleanString(value));

  return Number.isInteger(numeric) && numeric > 0
    ? numeric
    : null;
}

function configuredUrl(
  value: unknown,
  allowLocalDevelopment = false
): string | null {
  const candidate = cleanString(value);

  if (!candidate) {
    return null;
  }

  try {
    const parsed = new URL(candidate);
    const secure = parsed.protocol === "https:";
    const local =
      allowLocalDevelopment &&
      process.env.NODE_ENV !== "production" &&
      parsed.protocol === "http:" &&
      (
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "localhost"
      );

    return secure || local
      ? parsed.toString()
      : null;
  }
  catch {
    return null;
  }
}

// Lazily constructed and cached for the lifetime of the process - never
// logged, never persisted. The optional STRIPE_TEST_API_BASE_URL override
// exists solely so the persistent integration test can point the SDK at an
// in-process fixture server instead of the real Stripe network; it is not a
// documented production configuration surface.
let cachedStripeClient: Stripe | null = null;

function stripeClient(): Stripe {
  if (cachedStripeClient) {
    return cachedStripeClient;
  }

  const secretKey = cleanString(
    process.env.STRIPE_SECRET_KEY
  );

  const testApiBaseUrl = cleanString(
    process.env.STRIPE_TEST_API_BASE_URL
  );

  const overrides: Stripe.StripeConfig = testApiBaseUrl
    ? (() => {
        const parsed = new URL(testApiBaseUrl);
        return {
          host: parsed.hostname,
          port: parsed.port
            ? Number(parsed.port)
            : undefined,
          protocol:
            parsed.protocol === "https:"
              ? "https"
              : "http"
        };
      })()
    : {};

  cachedStripeClient = new Stripe(secretKey, overrides);

  return cachedStripeClient;
}

function commercialConfig(
  accountActorType: ActorType
): CommercialConfig {
  if (accountActorType !== "coach") {
    return Object.freeze({
      actor_type: accountActorType,
      configuration_state: "not_applicable",
      missing_configuration: Object.freeze([]),
      provider: "stripe_checkout",
      portal_provider: "stripe_customer_portal",
      plan_id: null,
      provider_price_id: null,
      seat_limit: null,
      application_url: null,
      checkout_url: null,
      portal_url: null
    });
  }

  const provider =
    process.env.KOLOSSEUM_CONTROLLED_LAUNCH_PROVIDER ===
    "equivalent_checkout"
      ? "equivalent_checkout"
      : "stripe_checkout";

  const portalProvider =
    process.env.KOLOSSEUM_CONTROLLED_LAUNCH_PORTAL_PROVIDER ===
    "equivalent_customer_portal"
      ? "equivalent_customer_portal"
      : "stripe_customer_portal";

  const planId = cleanString(
    process.env.KOLOSSEUM_CONTROLLED_LAUNCH_PLAN_ID
  );

  const providerPriceId = cleanString(
    process.env.KOLOSSEUM_CONTROLLED_LAUNCH_PRICE_ID
  );

  const seatLimit = positiveInteger(
    process.env.KOLOSSEUM_CONTROLLED_LAUNCH_SEAT_LIMIT
  );

  const applicationUrl =
    configuredUrl(
      process.env.KOLOSSEUM_PUBLIC_APP_URL,
      true
    ) ??
    (
      process.env.NODE_ENV !== "production"
        ? "http://127.0.0.1:3000/app/"
        : null
    );

  const checkoutUrl = configuredUrl(
    process.env.KOLOSSEUM_CONTROLLED_LAUNCH_CHECKOUT_URL,
    true
  );

  const portalUrl = configuredUrl(
    process.env.KOLOSSEUM_CONTROLLED_LAUNCH_PORTAL_URL,
    true
  );

  const missing: string[] = [];

  if (!planId) {
    missing.push(
      "KOLOSSEUM_CONTROLLED_LAUNCH_PLAN_ID"
    );
  }

  if (!providerPriceId) {
    missing.push(
      "KOLOSSEUM_CONTROLLED_LAUNCH_PRICE_ID"
    );
  }

  if (seatLimit === null) {
    missing.push(
      "KOLOSSEUM_CONTROLLED_LAUNCH_SEAT_LIMIT"
    );
  }

  if (!applicationUrl) {
    missing.push("KOLOSSEUM_PUBLIC_APP_URL");
  }

  if (!cleanString(process.env.STRIPE_SECRET_KEY)) {
    missing.push("STRIPE_SECRET_KEY");
  }

  return Object.freeze({
    actor_type: accountActorType,
    configuration_state:
      missing.length === 0
        ? "ready"
        : "missing",
    missing_configuration:
      Object.freeze([...missing]),
    provider,
    portal_provider: portalProvider,
    plan_id: planId || null,
    provider_price_id: providerPriceId || null,
    seat_limit: seatLimit,
    application_url: applicationUrl,
    checkout_url: checkoutUrl,
    portal_url: portalUrl
  });
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return (
      "[" +
      value.map((entry) => canonicalJson(entry)).join(",") +
      "]"
    );
  }

  const record = value as JsonRecord;

  return (
    "{" +
    Object.keys(record)
      .sort()
      .map((key) => {
        return (
          JSON.stringify(key) +
          ":" +
          canonicalJson(record[key])
        );
      })
      .join(",") +
    "}"
  );
}

function sha256(value: string): string {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function withRecordHash(
  input: JsonRecord
): Readonly<JsonRecord> {
  const material = { ...input };

  delete material.record_hash;

  return Object.freeze({
    ...material,
    record_hash: sha256(canonicalJson(material))
  });
}

function mapStoredRecord(
  value: unknown
): StoredCommercialRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = cleanString(value.record_type);

  if (!ALLOWED_RECORD_TYPES.has(
    type as CommercialRecordType
  )) {
    return null;
  }

  if (!isRecord(value.record_payload)) {
    return null;
  }

  return Object.freeze({
    commercial_record_id:
      cleanString(value.commercial_record_id),
    user_id: cleanString(value.user_id),
    request_id: cleanString(value.request_id),
    record_type: type as CommercialRecordType,
    effective_at_iso8601:
      cleanString(value.effective_at),
    record_payload:
      Object.freeze({ ...value.record_payload }),
    record_sha256:
      cleanString(value.record_sha256),
    created_at_iso8601:
      cleanString(value.created_at)
  });
}

async function commercialRecords(
  userId: string
): Promise<readonly StoredCommercialRecord[]> {
  const result = await pool.query(
    `
    SELECT
      commercial_record_id,
      user_id,
      request_id,
      record_type,
      effective_at,
      record_payload,
      record_sha256,
      created_at
    FROM product_commercial_records
    WHERE user_id = $1
    ORDER BY
      effective_at DESC,
      created_at DESC,
      commercial_record_id DESC
    LIMIT 100
    `,
    [userId]
  );

  const rows: unknown[] =
    Array.isArray(result.rows)
      ? result.rows
      : [];

  return Object.freeze(
    rows
      .map((row: unknown) =>
        mapStoredRecord(row)
      )
      .filter(
        (
          record: StoredCommercialRecord | null
        ): record is StoredCommercialRecord =>
          record !== null
      )
  );
}

async function recordByRequest(
  userId: string,
  requestedId: string
): Promise<StoredCommercialRecord | null> {
  const result = await pool.query(
    `
    SELECT
      commercial_record_id,
      user_id,
      request_id,
      record_type,
      effective_at,
      record_payload,
      record_sha256,
      created_at
    FROM product_commercial_records
    WHERE user_id = $1 AND request_id = $2
    LIMIT 1
    `,
    [userId, requestedId]
  );

  return mapStoredRecord(result.rows?.[0]);
}

async function appendCommercialRecord(
  userId: string,
  requestedId: string,
  type: CommercialRecordType,
  effectiveAt: string,
  payload: JsonRecord
): Promise<StoredCommercialRecord> {
  const existing = await recordByRequest(
    userId,
    requestedId
  );

  if (existing) {
    return existing;
  }

  const recordId =
    `commercial_${randomUUID().replace(/-/gu, "")}`;

  const envelope = Object.freeze({
    commercial_record_id: recordId,
    user_id: userId,
    request_id: requestedId,
    record_type: type,
    effective_at_iso8601: effectiveAt,
    record_payload: Object.freeze({ ...payload }),
    ...ENGINE_INERT_STATE
  });

  const recordSha = sha256(canonicalJson(envelope));

  await pool.query(
    `
    INSERT INTO product_commercial_records (
      commercial_record_id,
      user_id,
      request_id,
      record_type,
      effective_at,
      record_payload,
      record_sha256,
      created_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5::timestamptz,
      $6::jsonb,
      $7,
      now()
    )
    ON CONFLICT (user_id, request_id)
    DO NOTHING
    `,
    [
      recordId,
      userId,
      requestedId,
      type,
      effectiveAt,
      JSON.stringify(payload),
      recordSha
    ]
  );

  const stored = await recordByRequest(
    userId,
    requestedId
  );

  if (!stored) {
    throw new ProductCommercialError(
      "commercial_record_write_failed",
      500
    );
  }

  return stored;
}

function billingAccessRecord(
  records: readonly StoredCommercialRecord[]
): Readonly<JsonRecord> | null {
  for (const record of records) {
    const candidate =
      record.record_payload.billing_access_record;

    if (isRecord(candidate)) {
      return Object.freeze({ ...candidate });
    }
  }

  return null;
}

function occupiedSeatCount(
  records: readonly StoredCommercialRecord[]
): number {
  for (const record of records) {
    const value =
      record.record_payload.occupied_seat_count;

    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0
    ) {
      return value;
    }
  }

  return 0;
}

function subscriptionState(
  accessRecord: Readonly<JsonRecord> | null,
  config: CommercialConfig
): string {
  if (config.configuration_state === "not_applicable") {
    return "not_applicable";
  }

  if (!accessRecord) {
    return config.configuration_state === "ready"
      ? "not_started"
      : "not_configured";
  }

  const accessState =
    cleanString(accessRecord.billing_access_state);

  const billingStatus =
    cleanString(accessRecord.billing_status);

  if (
    accessState === "access_active" &&
    billingStatus === "payment_confirmed"
  ) {
    return "active";
  }

  if (accessState === "access_suspended") {
    return "suspended";
  }

  if (accessState === "access_cancelled") {
    return "cancelled";
  }

  if (billingStatus === "provider_confirmation_pending") {
    return "confirmation_pending";
  }

  if (
    accessState === "checkout_created" ||
    billingStatus === "provider_checkout_created"
  ) {
    return "checkout_pending";
  }

  return "access_required";
}

function factualCommercialState(
  state: string,
  seatLimitReached: boolean
): string {
  if (seatLimitReached) {
    return "seat_limit_reached";
  }

  if (state === "active") {
    return "active";
  }

  if (state === "not_started") {
    return "controlled_launch";
  }

  if (
    state === "checkout_pending" ||
    state === "confirmation_pending" ||
    state === "access_required"
  ) {
    return "payment_action_required";
  }

  if (state === "cancelled") {
    return "cancelled";
  }

  if (
    state === "not_configured" ||
    state === "suspended"
  ) {
    return "unavailable";
  }

  if (state === "not_applicable") {
    return "not_applicable";
  }

  return "unavailable";
}

function factualEntitlementError(
  state: string,
  config: CommercialConfig,
  seatLimitReached: boolean
): Readonly<JsonRecord> | null {
  if (seatLimitReached) {
    return Object.freeze({
      code:
        "commercial_seat_limit_reached",
      message:
        "The current seat allowance is fully used.",
      missing_configuration:
        Object.freeze([])
    });
  }

  if (
    state === "active" ||
    state === "not_applicable"
  ) {
    return null;
  }

  const messages: Record<string, string> = {
    not_configured:
      "Controlled-launch billing has not been configured on this server.",
    not_started:
      "No controlled-launch checkout has been recorded for this account.",
    checkout_pending:
      "A checkout request exists, but provider confirmation has not been recorded.",
    confirmation_pending:
      "The browser returned from checkout, but trusted provider confirmation is still required.",
    cancelled:
      "The recorded checkout was cancelled.",
    suspended:
      "Commercial product access is suspended.",
    access_required:
      "Commercial product access is not active."
  };

  const codes: Record<string, string> = {
    not_configured:
      "commercial_configuration_missing",
    not_started:
      "commercial_not_started",
    checkout_pending:
      "commercial_checkout_pending",
    confirmation_pending:
      "commercial_provider_confirmation_pending",
    cancelled:
      "commercial_cancelled",
    suspended:
      "commercial_suspended",
    access_required:
      "commercial_access_required"
  };

  return Object.freeze({
    code:
      codes[state] ??
      "commercial_access_required",
    message:
      messages[state] ??
      "Commercial product access is not active.",
    missing_configuration:
      state === "not_configured"
        ? config.missing_configuration
        : Object.freeze([])
  });
}

function historyRecord(
  record: StoredCommercialRecord
): Readonly<JsonRecord> {
  return Object.freeze({
    commercial_record_id:
      record.commercial_record_id,
    request_id: record.request_id,
    record_type: record.record_type,
    effective_at_iso8601:
      record.effective_at_iso8601,
    record_sha256: record.record_sha256,
    billing_access_state:
      isRecord(
        record.record_payload.billing_access_record
      )
        ? cleanString(
            record.record_payload
              .billing_access_record
              .billing_access_state
          )
        : null,
    billing_status:
      isRecord(
        record.record_payload.billing_access_record
      )
        ? cleanString(
            record.record_payload
              .billing_access_record
              .billing_status
          )
        : null,
    return_outcome:
      cleanString(
        record.record_payload.return_outcome
      ) || null,
    provider_call_performed:
      record.record_payload
        .provider_call_performed === true,
    ...ENGINE_INERT_STATE
  });
}

function checkoutReturnUrl(
  applicationUrl: string,
  outcome: "success" | "cancelled"
): string {
  const target = new URL(applicationUrl);

  target.searchParams.set(
    "checkout_return",
    outcome
  );

  return target.toString();
}

function publicCommercialOverview(
  records: readonly StoredCommercialRecord[],
  config: CommercialConfig
): Readonly<JsonRecord> {
  const accessRecord = billingAccessRecord(records);
  const state = subscriptionState(
    accessRecord,
    config
  );
  const occupied = occupiedSeatCount(records);
  const seatLimit =
    typeof accessRecord?.seat_limit === "number"
      ? accessRecord.seat_limit
      : config.seat_limit;
  const available =
    typeof seatLimit === "number"
      ? Math.max(seatLimit - occupied, 0)
      : null;
  const seatLimitReached =
    typeof seatLimit === "number" &&
    seatLimit > 0 &&
    occupied >= seatLimit;
  const factualState =
    factualCommercialState(
      state,
      seatLimitReached
    );
  const providerSessionId =
    cleanString(
      accessRecord?.provider_session_id
    ) || null;
  const providerCustomerId =
    cleanString(
      accessRecord?.provider_customer_id
    ) || null;
  const accessActive =
    state === "active";
  const portalReady =
    accessActive &&
    Boolean(providerCustomerId);

  return Object.freeze({
    ok: true,
    commercial: Object.freeze({
      commercial_scope:
        config.actor_type === "coach"
          ? "controlled_launch_coach"
          : "not_applicable",
      configuration_state:
        config.configuration_state,
      subscription_state: state,
      factual_state:
        factualState,
      product_access_state:
        accessActive
          ? "allowed"
          : state === "not_applicable"
            ? "not_applicable"
            : "restricted",
      billing_access_state:
        cleanString(
          accessRecord?.billing_access_state
        ) || "not_recorded",
      billing_status:
        cleanString(
          accessRecord?.billing_status
        ) || "not_recorded",
      plan_id:
        cleanString(accessRecord?.plan_id) ||
        config.plan_id,
      provider:
        cleanString(accessRecord?.provider) ||
        config.provider,
      seat_limit: seatLimit,
      occupied_seat_count: occupied,
      available_seat_count: available,
      seat_limit_reached:
        seatLimitReached,
      checkout_available:
        config.configuration_state === "ready",
      checkout_redirect_available:
        config.configuration_state === "ready",
      billing_surface_visible:
        config.actor_type === "coach",
      portal_available: portalReady,
      provider_session_present:
        Boolean(providerSessionId),
      entitlement_error:
        factualEntitlementError(
          state,
          config,
          seatLimitReached
        ),
      provider_call_performed: false,
      provider_call_boundary:
        "performed_only_by_checkout_and_webhook_handlers",
      ...ENGINE_INERT_STATE
    }),
    history:
      Object.freeze(
        records
          .slice(0, 20)
          .map(historyRecord)
      ),
    ...ENGINE_INERT_STATE
  });
}

export async function getProductCommercialOverview(
  userIdValue: unknown,
  actorTypeValue: unknown
): Promise<Readonly<JsonRecord>> {
  const userId = cleanString(userIdValue);

  if (!userId) {
    throw new ProductCommercialError(
      "commercial_user_id_required",
      401
    );
  }

  const accountActorType =
    actorType(actorTypeValue);

  const records = await commercialRecords(userId);

  return publicCommercialOverview(
    records,
    commercialConfig(accountActorType)
  );
}

export async function createProductCommercialCheckout(
  userIdValue: unknown,
  actorTypeValue: unknown,
  inputValue: unknown
): Promise<Readonly<JsonRecord>> {
  const userId = cleanString(userIdValue);
  const accountActorType =
    actorType(actorTypeValue);
  const input = assertExactKeys(
    inputValue,
    ["request_id"]
  );
  const requestedId = requestId(input.request_id);

  if (!userId) {
    throw new ProductCommercialError(
      "commercial_user_id_required",
      401
    );
  }

  if (accountActorType !== "coach") {
    throw new ProductCommercialError(
      "commercial_coach_account_required",
      403
    );
  }

  const config = commercialConfig(accountActorType);

  if (
    config.configuration_state !== "ready" ||
    !config.plan_id ||
    !config.provider_price_id ||
    config.seat_limit === null ||
    !config.application_url
  ) {
    throw new ProductCommercialError(
      "commercial_configuration_missing",
      409,
      {
        missing_configuration:
          config.missing_configuration
      }
    );
  }

  const existing = await recordByRequest(
    userId,
    requestedId
  );

  if (existing) {
    return Object.freeze({
      ok: true,
      idempotent_replay: true,
      action: "checkout_request",
      record: historyRecord(existing),
      overview:
        await getProductCommercialOverview(
          userId,
          accountActorType
        ),
      checkout_url:
        cleanString(
          existing.record_payload.checkout_url
        ) || null,
      provider_call_performed: false,
      ...ENGINE_INERT_STATE
    });
  }

  const now = new Date().toISOString();

  const boundaryRecord = withRecordHash({
    contract_version: "S-V1-P-01",
    requested_control: "access_state",
    commercial_access_state: "access_required",
    session_state: "not_started",
    requested_at: now,
    boundary: Object.freeze({
      access_state_control:
        "permitted_product_surface",
      plan_visibility_control:
        "not_requested",
      seat_limit_control: "not_requested",
      billing_surface_control:
        "not_requested",
      engine_legality: "not_mutated",
      compile_output: "not_mutated",
      substitution_selection: "not_mutated",
      replay_record: "not_mutated",
      proof_record: "not_mutated",
      factual_history_record: "not_mutated",
      automated_mid_session_upsell:
        "not_permitted"
    })
  });

  const intentId =
    `cl_checkout_intent_${
      sha256(
        canonicalJson({
          user_id: userId,
          request_id: requestedId,
          plan_id: config.plan_id,
          provider_price_id:
            config.provider_price_id
        })
      ).slice(0, 24)
    }`;

  const billingRecord = withRecordHash({
    record_type:
      "controlled_launch_billing_access_record",
    provider: config.provider,
    provider_session_intent_id: intentId,
    provider_session_id: null,
    billing_access_state: "checkout_created",
    billing_status:
      "provider_checkout_created",
    plan_id: config.plan_id,
    seat_limit: config.seat_limit,
    actor_id: userId,
    subject_id: userId,
    provider_price_id:
      config.provider_price_id,
    checkout_mode: "subscription",
    idempotency_key: requestedId,
    created_at: now,
    updated_at: now,
    payment_boundary_record_hash:
      boundaryRecord.record_hash,
    engine_legality: "not_mutated",
    compile_output: "not_mutated",
    substitution_selection: "not_mutated",
    replay_record: "not_mutated",
    proof_record: "not_mutated",
    factual_history_record: "not_mutated"
  });

  const providerRequest = Object.freeze({
    provider: config.provider,
    checkout_mode: "subscription",
    provider_price_id:
      config.provider_price_id,
    quantity: config.seat_limit,
    success_url:
      checkoutReturnUrl(
        config.application_url,
        "success"
      ),
    cancel_url:
      checkoutReturnUrl(
        config.application_url,
        "cancelled"
      ),
    idempotency_key: requestedId,
    metadata: Object.freeze({
      slice: "S-V1-P-02",
      plan_id: config.plan_id,
      actor_id: userId,
      subject_id: userId,
      billing_access_record_hash:
        cleanString(billingRecord.record_hash)
    }),
    live_provider_call: "performed"
  });

  let session: Stripe.Checkout.Session;

  try {
    session = await stripeClient().checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [
          {
            price: config.provider_price_id,
            quantity: config.seat_limit
          }
        ],
        success_url: providerRequest.success_url,
        cancel_url: providerRequest.cancel_url,
        client_reference_id: userId,
        metadata: providerRequest.metadata
      },
      { idempotencyKey: requestedId }
    );
  }
  catch (error) {
    throw new ProductCommercialError(
      "commercial_checkout_provider_call_failed",
      502,
      {
        provider_error_type:
          error instanceof Stripe.errors.StripeError
            ? error.type
            : "unknown_error"
      }
    );
  }

  const finalBillingRecord = withRecordHash({
    ...billingRecord,
    provider_session_id: session.id,
    provider_customer_id:
      typeof session.customer === "string"
        ? session.customer
        : null
  });

  const stored = await appendCommercialRecord(
    userId,
    requestedId,
    "commercial_checkout_requested",
    now,
    {
      contract_version: "FULL-UI-08",
      status:
        "controlled_launch_checkout_requested",
      reason_code:
        "controlled_launch_checkout_allowed",
      provider_session_request:
        providerRequest,
      billing_access_record: finalBillingRecord,
      payment_boundary_record:
        boundaryRecord,
      occupied_seat_count: 0,
      checkout_url: session.url,
      provider_call_performed: true,
      ...ENGINE_INERT_STATE
    }
  );

  return Object.freeze({
    ok: true,
    idempotent_replay: false,
    action: "checkout_request",
    record: historyRecord(stored),
    overview:
      await getProductCommercialOverview(
        userId,
        accountActorType
      ),
    checkout_url: session.url,
    provider_session_request:
      providerRequest,
    provider_call_performed: true,
    ...ENGINE_INERT_STATE
  });
}

export async function recordProductCommercialPaymentReturn(
  userIdValue: unknown,
  actorTypeValue: unknown,
  inputValue: unknown
): Promise<Readonly<JsonRecord>> {
  const userId = cleanString(userIdValue);
  const accountActorType =
    actorType(actorTypeValue);
  const input = assertExactKeys(
    inputValue,
    [
      "request_id",
      "outcome",
      "provider_session_id"
    ]
  );
  const requestedId = requestId(input.request_id);

  if (!userId) {
    throw new ProductCommercialError(
      "commercial_user_id_required",
      401
    );
  }

  if (accountActorType !== "coach") {
    throw new ProductCommercialError(
      "commercial_coach_account_required",
      403
    );
  }

  const outcome = cleanString(input.outcome);

  if (
    outcome !== "success" &&
    outcome !== "cancelled"
  ) {
    throw new ProductCommercialError(
      "commercial_payment_return_invalid"
    );
  }

  const existing = await recordByRequest(
    userId,
    requestedId
  );

  if (existing) {
    return Object.freeze({
      ok: true,
      idempotent_replay: true,
      action: "payment_return",
      record: historyRecord(existing),
      overview:
        await getProductCommercialOverview(
          userId,
          accountActorType
        ),
      provider_call_performed: false,
      trusted_provider_confirmation:
        false,
      ...ENGINE_INERT_STATE
    });
  }

  const records = await commercialRecords(userId);
  const currentBillingRecord =
    billingAccessRecord(records);

  if (!currentBillingRecord) {
    throw new ProductCommercialError(
      "commercial_checkout_record_missing",
      409
    );
  }

  const now = new Date().toISOString();
  const suppliedSessionId =
    cleanString(input.provider_session_id);
  const providerSessionId =
    suppliedSessionId ||
    cleanString(
      currentBillingRecord.provider_session_id
    ) ||
    null;

  const updatedBillingRecord =
    withRecordHash({
      ...currentBillingRecord,
      provider_session_id:
        providerSessionId,
      billing_access_state:
        outcome === "success"
          ? "access_required"
          : "access_cancelled",
      billing_status:
        outcome === "success"
          ? "provider_confirmation_pending"
          : "checkout_cancelled",
      updated_at: now,
      engine_legality: "not_mutated",
      compile_output: "not_mutated",
      substitution_selection: "not_mutated",
      replay_record: "not_mutated",
      proof_record: "not_mutated",
      factual_history_record: "not_mutated"
    });

  const stored = await appendCommercialRecord(
    userId,
    requestedId,
    "commercial_payment_return_recorded",
    now,
    {
      contract_version: "FULL-UI-08",
      status:
        "controlled_launch_payment_return_recorded",
      return_outcome: outcome,
      trusted_provider_confirmation: false,
      billing_access_record:
        updatedBillingRecord,
      occupied_seat_count:
        occupiedSeatCount(records),
      provider_call_performed: false,
      ...ENGINE_INERT_STATE
    }
  );

  // FULL-UI-18: a cancelled checkout return leaves billing access blocked -
  // record this as its own durable access-state row (derived request id,
  // so retries of the same payment return stay idempotent) so the
  // notifications surface has a real event to derive a billing action-
  // required notification from, distinct from the payment-return record.
  if (outcome === "cancelled") {
    await appendCommercialRecord(
      userId,
      `${requestedId}__billing_access_updated`,
      "commercial_billing_access_updated",
      now,
      {
        contract_version: "FULL-UI-18",
        status:
          "controlled_launch_billing_access_action_required",
        billing_access_record:
          updatedBillingRecord,
        source_request_id: requestedId,
        provider_call_performed: false,
        ...ENGINE_INERT_STATE
      }
    );
  }

  return Object.freeze({
    ok: true,
    idempotent_replay: false,
    action: "payment_return",
    record: historyRecord(stored),
    overview:
      await getProductCommercialOverview(
        userId,
        accountActorType
      ),
    provider_call_performed: false,
    trusted_provider_confirmation:
      false,
    ...ENGINE_INERT_STATE
  });
}

export async function createProductCommercialPortalRequest(
  userIdValue: unknown,
  actorTypeValue: unknown,
  inputValue: unknown
): Promise<Readonly<JsonRecord>> {
  const userId = cleanString(userIdValue);
  const accountActorType =
    actorType(actorTypeValue);
  const input = assertExactKeys(
    inputValue,
    ["request_id"]
  );
  const requestedId = requestId(input.request_id);

  if (!userId) {
    throw new ProductCommercialError(
      "commercial_user_id_required",
      401
    );
  }

  if (accountActorType !== "coach") {
    throw new ProductCommercialError(
      "commercial_coach_account_required",
      403
    );
  }

  const config = commercialConfig(accountActorType);
  const existing = await recordByRequest(
    userId,
    requestedId
  );

  if (existing) {
    return Object.freeze({
      ok: true,
      idempotent_replay: true,
      action: "portal_request",
      record: historyRecord(existing),
      overview:
        await getProductCommercialOverview(
          userId,
          accountActorType
        ),
      portal_url:
        cleanString(
          existing.record_payload.portal_url
        ) || null,
      provider_call_performed: false,
      ...ENGINE_INERT_STATE
    });
  }

  const records = await commercialRecords(userId);
  const currentBillingRecord =
    billingAccessRecord(records);

  if (!currentBillingRecord) {
    throw new ProductCommercialError(
      "commercial_billing_record_missing",
      409
    );
  }

  const accessActive =
    cleanString(
      currentBillingRecord.billing_access_state
    ) === "access_active" &&
    cleanString(
      currentBillingRecord.billing_status
    ) === "payment_confirmed";

  const providerCustomerId =
    cleanString(
      currentBillingRecord.provider_customer_id
    );

  if (!accessActive || !providerCustomerId) {
    throw new ProductCommercialError(
      "commercial_portal_unavailable",
      409,
      {
        billing_access_state:
          currentBillingRecord
            .billing_access_state ?? null,
        billing_status:
          currentBillingRecord
            .billing_status ?? null,
        provider_customer_present:
          Boolean(providerCustomerId)
      }
    );
  }

  if (!config.application_url) {
    throw new ProductCommercialError(
      "commercial_portal_configuration_missing",
      409
    );
  }

  const now = new Date().toISOString();

  const portalRequest = Object.freeze({
    provider: config.portal_provider,
    provider_portal: "customer_portal",
    provider_customer_reference: userId,
    provider_customer_id: providerCustomerId,
    return_url:
      config.application_url,
    idempotency_key: requestedId,
    metadata: Object.freeze({
      slice: "S-V1-P-04",
      actor_id: userId,
      subject_id: userId,
      plan_id:
        cleanString(
          currentBillingRecord.plan_id
        ),
      billing_access_record_hash:
        cleanString(
          currentBillingRecord.record_hash
        )
    }),
    live_provider_call: "performed"
  });

  let portalSession: Stripe.BillingPortal.Session;

  try {
    portalSession =
      await stripeClient().billingPortal.sessions.create(
        {
          customer: providerCustomerId,
          return_url: config.application_url
        }
      );
  }
  catch (error) {
    throw new ProductCommercialError(
      "commercial_checkout_provider_call_failed",
      502,
      {
        provider_error_type:
          error instanceof Stripe.errors.StripeError
            ? error.type
            : "unknown_error"
      }
    );
  }

  const stored = await appendCommercialRecord(
    userId,
    requestedId,
    "commercial_portal_requested",
    now,
    {
      contract_version: "FULL-UI-08",
      status:
        "billing_management_portal_request_recorded",
      billing_access_record:
        currentBillingRecord,
      provider_portal_session_request:
        portalRequest,
      occupied_seat_count:
        occupiedSeatCount(records),
      portal_url: portalSession.url,
      provider_call_performed: true,
      ...ENGINE_INERT_STATE
    }
  );

  return Object.freeze({
    ok: true,
    idempotent_replay: false,
    action: "portal_request",
    record: historyRecord(stored),
    overview:
      await getProductCommercialOverview(
        userId,
        accountActorType
      ),
    portal_url: portalSession.url,
    provider_portal_session_request:
      portalRequest,
    provider_call_performed: true,
    ...ENGINE_INERT_STATE
  });
}
