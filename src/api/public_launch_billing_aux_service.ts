// DEV NOTE: LAUNCH-04 public-launch billing audit/portal helpers.
// Browser return state is explicitly untrusted. Portal access is server-side
// billing management only. Neither path imports or mutates engine truth.

import { createHash, randomUUID } from "node:crypto";

import Stripe from "stripe";

import { pool } from "../db/pool.js";
import { ProductCommercialError } from "./product_commercial_service.js";
import {
  getPublicLaunchCommercialOverview,
  publicLaunchBillingEnabled
} from "./public_launch_billing_service.js";

type JsonRecord = Record<string, unknown>;
type ActorType = "athlete" | "coach";
type CommercialRecordType =
  | "commercial_payment_return_recorded"
  | "commercial_portal_requested";

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
  relationship_truth_mutation: "not_performed"
});

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function actorType(value: unknown): ActorType {
  if (value !== "athlete" && value !== "coach") {
    throw new ProductCommercialError("commercial_actor_type_invalid", 403);
  }
  return value;
}

function exactInput(value: unknown, allowedKeys: readonly string[]): JsonRecord {
  if (!isRecord(value)) throw new ProductCommercialError("commercial_input_required");
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new ProductCommercialError("commercial_unknown_field", 400, { field: key });
  }
  return value;
}

function requestId(value: unknown): string {
  const candidate = cleanString(value);
  if (!candidate || candidate.length > 120 || !/^[A-Za-z0-9_.:-]+$/u.test(candidate)) {
    throw new ProductCommercialError("commercial_request_id_invalid");
  }
  return candidate;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as JsonRecord;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function currentEntitlement(userId: string): Promise<JsonRecord> {
  const result = await pool.query(
    `SELECT record_payload -> 'public_launch_entitlement' AS entitlement
     FROM product_commercial_records
     WHERE user_id = $1 AND record_payload ? 'public_launch_entitlement'
     ORDER BY effective_at DESC, created_at DESC, commercial_record_id DESC
     LIMIT 1`,
    [userId]
  );
  const entitlement = result.rows?.[0]?.entitlement;
  if (!isRecord(entitlement)) throw new ProductCommercialError("public_launch_entitlement_missing", 409);
  return entitlement;
}

async function recordByRequest(userId: string, requestedId: string): Promise<JsonRecord | null> {
  const result = await pool.query(
    `SELECT commercial_record_id, request_id, record_type, effective_at, record_payload, record_sha256
     FROM product_commercial_records
     WHERE user_id = $1 AND request_id = $2 LIMIT 1`,
    [userId, requestedId]
  );
  return result.rows?.[0] ? { ...result.rows[0] } : null;
}

async function appendRecord(
  userId: string,
  requestedId: string,
  recordType: CommercialRecordType,
  status: string,
  entitlement: JsonRecord,
  extra: JsonRecord
): Promise<JsonRecord> {
  const existing = await recordByRequest(userId, requestedId);
  if (existing) return existing;
  const effectiveAt = new Date().toISOString();
  const commercialRecordId = `commercial_${randomUUID().replace(/-/gu, "")}`;
  const payload = {
    contract_version: "LAUNCH-04",
    status,
    public_launch_entitlement: entitlement,
    ...extra,
    ...ENGINE_INERT_STATE
  };
  const envelope = {
    commercial_record_id: commercialRecordId,
    user_id: userId,
    request_id: requestedId,
    record_type: recordType,
    effective_at: effectiveAt,
    record_payload: payload
  };
  await pool.query(
    `INSERT INTO product_commercial_records (
       commercial_record_id, user_id, request_id, record_type,
       effective_at, record_payload, record_sha256, created_at
     ) VALUES ($1,$2,$3,$4,$5::timestamptz,$6::jsonb,$7,now())
     ON CONFLICT (user_id, request_id) DO NOTHING`,
    [
      commercialRecordId,
      userId,
      requestedId,
      recordType,
      effectiveAt,
      JSON.stringify(payload),
      sha256(canonicalJson(envelope))
    ]
  );
  const stored = await recordByRequest(userId, requestedId);
  if (!stored) throw new ProductCommercialError("commercial_record_write_failed", 500);
  return stored;
}

function historyRecord(record: JsonRecord): Readonly<JsonRecord> {
  return Object.freeze({
    commercial_record_id: cleanString(record.commercial_record_id),
    request_id: cleanString(record.request_id),
    record_type: cleanString(record.record_type),
    effective_at_iso8601: cleanString(record.effective_at),
    record_sha256: cleanString(record.record_sha256)
  });
}

function configuredApplicationUrl(): string {
  const candidate = cleanString(process.env.KOLOSSEUM_PUBLIC_APP_URL);
  if (!candidate) throw new ProductCommercialError("commercial_portal_configuration_missing", 409);
  try {
    const parsed = new URL(candidate);
    const secure = parsed.protocol === "https:";
    const local = process.env.NODE_ENV !== "production" && parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
    if (!secure && !local) throw new Error("insecure");
    return parsed.toString();
  }
  catch {
    throw new ProductCommercialError("commercial_portal_configuration_missing", 409);
  }
}

let cachedStripeClient: Stripe | null = null;
function stripeClient(): Stripe {
  if (cachedStripeClient) return cachedStripeClient;
  const secretKey = cleanString(process.env.STRIPE_SECRET_KEY);
  if (!secretKey) throw new ProductCommercialError("commercial_configuration_missing", 409, { missing_configuration: ["STRIPE_SECRET_KEY"] });
  const testApiBaseUrl = cleanString(process.env.STRIPE_TEST_API_BASE_URL);
  const overrides: Stripe.StripeConfig = testApiBaseUrl
    ? (() => {
        const parsed = new URL(testApiBaseUrl);
        return {
          host: parsed.hostname,
          port: parsed.port ? Number(parsed.port) : undefined,
          protocol: parsed.protocol === "https:" ? "https" : "http"
        };
      })()
    : {};
  cachedStripeClient = new Stripe(secretKey, overrides);
  return cachedStripeClient;
}

export async function recordPublicLaunchPaymentReturn(
  userIdValue: unknown,
  actorTypeValue: unknown,
  inputValue: unknown
): Promise<Readonly<JsonRecord>> {
  if (!publicLaunchBillingEnabled()) throw new ProductCommercialError("public_launch_billing_disabled", 409);
  const userId = cleanString(userIdValue);
  if (!userId) throw new ProductCommercialError("commercial_user_id_required", 401);
  const role = actorType(actorTypeValue);
  const input = exactInput(inputValue, ["request_id", "outcome", "provider_session_id"]);
  const requestedId = requestId(input.request_id);
  const outcome = cleanString(input.outcome);
  if (outcome !== "success" && outcome !== "cancelled") throw new ProductCommercialError("commercial_payment_return_invalid");
  const existing = await recordByRequest(userId, requestedId);
  if (existing) {
    return Object.freeze({
      ok: true,
      idempotent_replay: true,
      action: "payment_return",
      record: historyRecord(existing),
      overview: await getPublicLaunchCommercialOverview(userId, role),
      trusted_provider_confirmation: false,
      provider_call_performed: false,
      ...ENGINE_INERT_STATE
    });
  }
  const entitlement = await currentEntitlement(userId);
  const stored = await appendRecord(
    userId,
    requestedId,
    "commercial_payment_return_recorded",
    "public_launch_payment_return_recorded",
    entitlement,
    {
      return_outcome: outcome,
      provider_session_id: cleanString(input.provider_session_id) || null,
      trusted_provider_confirmation: false,
      provider_call_performed: false
    }
  );
  return Object.freeze({
    ok: true,
    idempotent_replay: false,
    action: "payment_return",
    record: historyRecord(stored),
    overview: await getPublicLaunchCommercialOverview(userId, role),
    trusted_provider_confirmation: false,
    provider_call_performed: false,
    ...ENGINE_INERT_STATE
  });
}

export async function createPublicLaunchBillingPortal(
  userIdValue: unknown,
  actorTypeValue: unknown,
  inputValue: unknown
): Promise<Readonly<JsonRecord>> {
  if (!publicLaunchBillingEnabled()) throw new ProductCommercialError("public_launch_billing_disabled", 409);
  const userId = cleanString(userIdValue);
  if (!userId) throw new ProductCommercialError("commercial_user_id_required", 401);
  const role = actorType(actorTypeValue);
  const input = exactInput(inputValue, ["request_id"]);
  const requestedId = requestId(input.request_id);
  const existing = await recordByRequest(userId, requestedId);
  if (existing) {
    const payload = isRecord(existing.record_payload) ? existing.record_payload : {};
    return Object.freeze({
      ok: true,
      idempotent_replay: true,
      action: "portal_request",
      record: historyRecord(existing),
      portal_url: cleanString(payload.portal_url) || null,
      overview: await getPublicLaunchCommercialOverview(userId, role),
      provider_call_performed: false,
      ...ENGINE_INERT_STATE
    });
  }
  const entitlement = await currentEntitlement(userId);
  const providerIds = isRecord(entitlement.billing_provider_ids) ? entitlement.billing_provider_ids : {};
  const customerId = cleanString(providerIds.customer_id);
  if (!customerId) throw new ProductCommercialError("commercial_portal_unavailable", 409, { provider_customer_present: false });
  const applicationUrl = configuredApplicationUrl();
  let portal: Stripe.BillingPortal.Session;
  try {
    portal = await stripeClient().billingPortal.sessions.create({ customer: customerId, return_url: applicationUrl });
  }
  catch (error) {
    throw new ProductCommercialError("commercial_portal_provider_call_failed", 502, {
      provider_error_type: error instanceof Stripe.errors.StripeError ? error.type : "unknown_error"
    });
  }
  const stored = await appendRecord(
    userId,
    requestedId,
    "commercial_portal_requested",
    "public_launch_portal_requested",
    entitlement,
    { portal_url: portal.url, provider_customer_id: customerId, provider_call_performed: true }
  );
  return Object.freeze({
    ok: true,
    idempotent_replay: false,
    action: "portal_request",
    record: historyRecord(stored),
    portal_url: portal.url,
    overview: await getPublicLaunchCommercialOverview(userId, role),
    provider_call_performed: true,
    ...ENGINE_INERT_STATE
  });
}
