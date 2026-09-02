// DEV NOTE: LAUNCH-04 public-launch billing lifecycle.
// This service owns product entitlement and Stripe lifecycle state only. It never
// imports engine code and cannot alter compile, registry, substitution, replay,
// proof, factual history, or coach-athlete relationship truth.

import { createHash, randomUUID } from "node:crypto";

import Stripe from "stripe";

import { pool } from "../db/pool.js";
import { ProductCommercialError } from "./product_commercial_service.js";

type JsonRecord = Record<string, unknown>;
type ActorType = "athlete" | "coach";
type CommercialRecordType =
  | "commercial_checkout_requested"
  | "commercial_payment_return_recorded"
  | "commercial_billing_access_updated"
  | "commercial_portal_requested";
type TrialState = "not_applicable" | "eligible" | "active" | "completed" | "expired";
type IntroState = "not_applicable" | "scheduled" | "active" | "completed";
type BillingState = "not_started" | "trial" | "active_paid" | "past_due" | "cancelled" | "ended";
type AccessState = "active" | "restricted" | "inactive";

type PlanDefinition = Readonly<{
  account_role: ActorType;
  product: "athlete_individual" | "coach_subscription";
  tier: string;
  athlete_capacity: number | null;
  standard_price_gbp_minor: number;
  intro_price_gbp_minor: number | null;
  standard_price_env: string;
  intro_price_env: string | null;
}>;

type PublicLaunchEntitlement = Readonly<{
  product: "athlete_individual" | "coach_subscription";
  account_role: ActorType;
  tier: string;
  athlete_capacity: number | null;
  trial_state: TrialState;
  trial_start_at: string | null;
  trial_end_at: string | null;
  intro_price_state: IntroState;
  intro_period_start_at: string | null;
  intro_period_end_at: string | null;
  standard_price_gbp_minor: number;
  intro_price_gbp_minor: number | null;
  billing_state: BillingState;
  access_state: AccessState;
  founding_coach: boolean;
  founding_cohort_ordinal: number | null;
  billing_provider_ids: Readonly<JsonRecord>;
  entitlement_metadata: Readonly<JsonRecord>;
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
  relationship_truth_mutation: "not_performed"
});

const COACH_TRIAL_DAYS = 30;
const COACH_INTRO_MONTHS = 6;
const FOUNDING_ACTIVE_LIMIT = 100;
const FOUNDING_MAX_AUTHORISED = 250;

export const PUBLIC_LAUNCH_PLANS: Readonly<Record<string, PlanDefinition>> = Object.freeze({
  athlete_monthly: Object.freeze({
    account_role: "athlete",
    product: "athlete_individual",
    tier: "athlete_monthly",
    athlete_capacity: null,
    standard_price_gbp_minor: 1499,
    intro_price_gbp_minor: null,
    standard_price_env: "KOLOSSEUM_PUBLIC_LAUNCH_ATHLETE_STANDARD_PRICE_ID",
    intro_price_env: null
  }),
  coach_6: Object.freeze({
    account_role: "coach", product: "coach_subscription", tier: "coach_6", athlete_capacity: 6,
    standard_price_gbp_minor: 2499, intro_price_gbp_minor: 1699,
    standard_price_env: "KOLOSSEUM_PUBLIC_LAUNCH_COACH_6_STANDARD_PRICE_ID",
    intro_price_env: "KOLOSSEUM_PUBLIC_LAUNCH_COACH_6_INTRO_PRICE_ID"
  }),
  coach_16: Object.freeze({
    account_role: "coach", product: "coach_subscription", tier: "coach_16", athlete_capacity: 16,
    standard_price_gbp_minor: 5999, intro_price_gbp_minor: 3999,
    standard_price_env: "KOLOSSEUM_PUBLIC_LAUNCH_COACH_16_STANDARD_PRICE_ID",
    intro_price_env: "KOLOSSEUM_PUBLIC_LAUNCH_COACH_16_INTRO_PRICE_ID"
  }),
  coach_32: Object.freeze({
    account_role: "coach", product: "coach_subscription", tier: "coach_32", athlete_capacity: 32,
    standard_price_gbp_minor: 10999, intro_price_gbp_minor: 7499,
    standard_price_env: "KOLOSSEUM_PUBLIC_LAUNCH_COACH_32_STANDARD_PRICE_ID",
    intro_price_env: "KOLOSSEUM_PUBLIC_LAUNCH_COACH_32_INTRO_PRICE_ID"
  }),
  coach_64: Object.freeze({
    account_role: "coach", product: "coach_subscription", tier: "coach_64", athlete_capacity: 64,
    standard_price_gbp_minor: 18999, intro_price_gbp_minor: 12999,
    standard_price_env: "KOLOSSEUM_PUBLIC_LAUNCH_COACH_64_STANDARD_PRICE_ID",
    intro_price_env: "KOLOSSEUM_PUBLIC_LAUNCH_COACH_64_INTRO_PRICE_ID"
  }),
  coach_120: Object.freeze({
    account_role: "coach", product: "coach_subscription", tier: "coach_120", athlete_capacity: 120,
    standard_price_gbp_minor: 29999, intro_price_gbp_minor: 19999,
    standard_price_env: "KOLOSSEUM_PUBLIC_LAUNCH_COACH_120_STANDARD_PRICE_ID",
    intro_price_env: "KOLOSSEUM_PUBLIC_LAUNCH_COACH_120_INTRO_PRICE_ID"
  }),
  coach_250: Object.freeze({
    account_role: "coach", product: "coach_subscription", tier: "coach_250", athlete_capacity: 250,
    standard_price_gbp_minor: 49999, intro_price_gbp_minor: 32999,
    standard_price_env: "KOLOSSEUM_PUBLIC_LAUNCH_COACH_250_STANDARD_PRICE_ID",
    intro_price_env: "KOLOSSEUM_PUBLIC_LAUNCH_COACH_250_INTRO_PRICE_ID"
  })
});

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanActorType(value: unknown): ActorType {
  if (value !== "athlete" && value !== "coach") {
    throw new ProductCommercialError("commercial_actor_type_invalid", 403);
  }
  return value;
}

function requireUserId(value: unknown): string {
  const userId = cleanString(value);
  if (!userId) throw new ProductCommercialError("commercial_user_id_required", 401);
  return userId;
}

function requireRequestId(value: unknown): string {
  const candidate = cleanString(value);
  if (!candidate || candidate.length > 120 || !/^[A-Za-z0-9_.:-]+$/u.test(candidate)) {
    throw new ProductCommercialError("commercial_request_id_invalid");
  }
  return candidate;
}

function exactInput(value: unknown, allowedKeys: readonly string[]): JsonRecord {
  if (!isRecord(value)) throw new ProductCommercialError("commercial_input_required");
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new ProductCommercialError("commercial_unknown_field", 400, { field: key });
  }
  return value;
}

function planForRole(actorType: ActorType, tierValue: unknown): PlanDefinition {
  const requestedTier = cleanString(tierValue) || (actorType === "athlete" ? "athlete_monthly" : "coach_6");
  const plan = PUBLIC_LAUNCH_PLANS[requestedTier];
  if (!plan || plan.account_role !== actorType) {
    throw new ProductCommercialError("public_launch_billing_tier_invalid", 400, { tier: requestedTier });
  }
  return plan;
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

function configuredUrl(value: unknown): string | null {
  const candidate = cleanString(value);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    const secure = parsed.protocol === "https:";
    const local = process.env.NODE_ENV !== "production" && parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
    return secure || local ? parsed.toString() : null;
  }
  catch {
    return null;
  }
}

export function publicLaunchBillingEnabled(): boolean {
  const value = cleanString(process.env.KOLOSSEUM_PUBLIC_LAUNCH_BILLING_ENABLED).toLowerCase();
  return value === "1" || value === "true" || value === "enabled";
}

let cachedStripeClient: Stripe | null = null;
function stripeClient(): Stripe {
  if (cachedStripeClient) return cachedStripeClient;
  const secretKey = cleanString(process.env.STRIPE_SECRET_KEY);
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

function providerMode(): "test" | "live" | null {
  const mode = cleanString(process.env.KOLOSSEUM_PUBLIC_LAUNCH_BILLING_MODE);
  return mode === "test" || mode === "live" ? mode : null;
}

function baseProviderMissing(): string[] {
  const missing: string[] = [];
  const mode = providerMode();
  const secretKey = cleanString(process.env.STRIPE_SECRET_KEY);
  if (!mode) missing.push("KOLOSSEUM_PUBLIC_LAUNCH_BILLING_MODE");
  if (!secretKey) missing.push("STRIPE_SECRET_KEY");
  if (!configuredUrl(process.env.KOLOSSEUM_PUBLIC_APP_URL)) missing.push("KOLOSSEUM_PUBLIC_APP_URL");
  if (process.env.NODE_ENV === "production" && mode !== "live") missing.push("KOLOSSEUM_PUBLIC_LAUNCH_BILLING_MODE=live");
  if (process.env.NODE_ENV === "production" && secretKey && !secretKey.startsWith("sk_live_")) missing.push("STRIPE_SECRET_KEY(live)");
  if (mode === "test" && secretKey && !secretKey.startsWith("sk_test_")) missing.push("STRIPE_SECRET_KEY(test)");
  if (mode === "live" && secretKey && !secretKey.startsWith("sk_live_")) missing.push("STRIPE_SECRET_KEY(live)");
  return missing;
}

function providerPrice(plan: PlanDefinition, useIntro: boolean): string | null {
  const variable = useIntro ? plan.intro_price_env : plan.standard_price_env;
  return variable ? cleanString(process.env[variable]) || null : null;
}

function providerConfiguration(plan: PlanDefinition, useIntro: boolean): Readonly<JsonRecord> {
  const missing = baseProviderMissing();
  const variable = useIntro ? plan.intro_price_env : plan.standard_price_env;
  const priceId = providerPrice(plan, useIntro);
  if (variable && !priceId) missing.push(variable);
  return Object.freeze({
    state: missing.length === 0 ? "ready" : "missing",
    missing_configuration: Object.freeze([...new Set(missing)]),
    mode: providerMode(),
    price_id: priceId,
    application_url: configuredUrl(process.env.KOLOSSEUM_PUBLIC_APP_URL)
  });
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 24 * 60 * 60 * 1000).toISOString();
}

function addCalendarMonths(iso: string, months: number): string {
  const input = new Date(iso);
  const day = input.getUTCDate();
  const result = new Date(input.getTime());
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result.toISOString();
}

function initialAthleteEntitlement(now: string): PublicLaunchEntitlement {
  const plan = PUBLIC_LAUNCH_PLANS.athlete_monthly;
  return Object.freeze({
    product: plan.product,
    account_role: "athlete",
    tier: plan.tier,
    athlete_capacity: null,
    trial_state: "not_applicable",
    trial_start_at: null,
    trial_end_at: null,
    intro_price_state: "not_applicable",
    intro_period_start_at: null,
    intro_period_end_at: null,
    standard_price_gbp_minor: plan.standard_price_gbp_minor,
    intro_price_gbp_minor: null,
    billing_state: "not_started",
    access_state: "restricted",
    founding_coach: false,
    founding_cohort_ordinal: null,
    billing_provider_ids: Object.freeze({ customer_id: null, subscription_id: null, subscription_item_id: null, checkout_session_id: null, price_id: null }),
    entitlement_metadata: Object.freeze({ created_at: now, intro_paid_cycles: 0, cancel_at_period_end: false, provider_mode: providerMode(), latest_provider_event_created: null, latest_provider_event_id: null, engine_visible: false })
  });
}

function initialCoachEntitlement(plan: PlanDefinition, now: string, foundingOrdinal: number | null): PublicLaunchEntitlement {
  const founding = foundingOrdinal !== null;
  const trialEnd = founding ? addDays(now, COACH_TRIAL_DAYS) : null;
  const introEnd = trialEnd ? addCalendarMonths(trialEnd, COACH_INTRO_MONTHS) : null;
  return Object.freeze({
    product: plan.product,
    account_role: "coach",
    tier: plan.tier,
    athlete_capacity: plan.athlete_capacity,
    trial_state: founding ? "active" : "not_applicable",
    trial_start_at: founding ? now : null,
    trial_end_at: trialEnd,
    intro_price_state: founding ? "scheduled" : "not_applicable",
    intro_period_start_at: trialEnd,
    intro_period_end_at: introEnd,
    standard_price_gbp_minor: plan.standard_price_gbp_minor,
    intro_price_gbp_minor: plan.intro_price_gbp_minor,
    billing_state: founding ? "trial" : "not_started",
    access_state: founding ? "active" : "restricted",
    founding_coach: founding,
    founding_cohort_ordinal: foundingOrdinal,
    billing_provider_ids: Object.freeze({ customer_id: null, subscription_id: null, subscription_item_id: null, checkout_session_id: null, price_id: null }),
    entitlement_metadata: Object.freeze({ created_at: now, intro_paid_cycles: 0, cancel_at_period_end: false, provider_mode: providerMode(), latest_provider_event_created: null, latest_provider_event_id: null, engine_visible: false })
  });
}

function projectedEntitlement(value: PublicLaunchEntitlement, now = new Date().toISOString()): PublicLaunchEntitlement {
  const timestamp = Date.parse(now);
  let trialState = value.trial_state;
  let introState = value.intro_price_state;
  let billingState = value.billing_state;
  let accessState = value.access_state;
  if (trialState === "active" && value.trial_end_at && timestamp >= Date.parse(value.trial_end_at)) {
    trialState = "completed";
    if (billingState === "trial" && !cleanString(value.billing_provider_ids.subscription_id)) {
      billingState = "not_started";
      accessState = "restricted";
    }
  }
  if ((introState === "scheduled" || introState === "active") && value.intro_period_start_at && timestamp >= Date.parse(value.intro_period_start_at)) {
    introState = "active";
  }
  if (introState === "active" && value.intro_period_end_at && timestamp >= Date.parse(value.intro_period_end_at)) {
    introState = "completed";
  }
  return Object.freeze({ ...value, trial_state: trialState, intro_price_state: introState, billing_state: billingState, access_state: accessState });
}

function entitlementFrom(value: unknown): PublicLaunchEntitlement | null {
  if (!isRecord(value)) return null;
  const role = value.account_role;
  const tier = cleanString(value.tier);
  const plan = PUBLIC_LAUNCH_PLANS[tier];
  if ((role !== "athlete" && role !== "coach") || !plan || plan.account_role !== role) return null;
  if (!isRecord(value.billing_provider_ids) || !isRecord(value.entitlement_metadata)) return null;
  return value as unknown as PublicLaunchEntitlement;
}

async function currentEntitlement(userId: string): Promise<PublicLaunchEntitlement | null> {
  const result = await pool.query(
    `SELECT record_payload -> 'public_launch_entitlement' AS entitlement
     FROM product_commercial_records
     WHERE user_id = $1 AND record_payload ? 'public_launch_entitlement'
     ORDER BY effective_at DESC, created_at DESC, commercial_record_id DESC
     LIMIT 1`,
    [userId]
  );
  return entitlementFrom(result.rows?.[0]?.entitlement);
}

async function recordByRequest(userId: string, requestId: string): Promise<Readonly<JsonRecord> | null> {
  const result = await pool.query(
    `SELECT commercial_record_id, request_id, record_type, effective_at, record_payload, record_sha256, created_at
     FROM product_commercial_records WHERE user_id = $1 AND request_id = $2 LIMIT 1`,
    [userId, requestId]
  );
  return result.rows?.[0] ? Object.freeze({ ...result.rows[0] }) : null;
}

async function appendEntitlementRecord(
  userId: string,
  requestId: string,
  recordType: CommercialRecordType,
  entitlement: PublicLaunchEntitlement,
  status: string,
  extra: JsonRecord = {},
  effectiveAt = new Date().toISOString()
): Promise<Readonly<JsonRecord>> {
  const existing = await recordByRequest(userId, requestId);
  if (existing) return existing;
  const commercialRecordId = `commercial_${randomUUID().replace(/-/gu, "")}`;
  const payload = Object.freeze({
    contract_version: "LAUNCH-04",
    status,
    public_launch_entitlement: entitlement,
    ...extra,
    ...ENGINE_INERT_STATE
  });
  const envelope = { commercial_record_id: commercialRecordId, user_id: userId, request_id: requestId, record_type: recordType, effective_at: effectiveAt, record_payload: payload };
  const recordSha = sha256(canonicalJson(envelope));
  await pool.query(
    `INSERT INTO product_commercial_records (
       commercial_record_id, user_id, request_id, record_type, effective_at,
       record_payload, record_sha256, created_at
     ) VALUES ($1,$2,$3,$4,$5::timestamptz,$6::jsonb,$7,now())
     ON CONFLICT (user_id, request_id) DO NOTHING`,
    [commercialRecordId, userId, requestId, recordType, effectiveAt, JSON.stringify(payload), recordSha]
  );
  const stored = await recordByRequest(userId, requestId);
  if (!stored) throw new ProductCommercialError("commercial_record_write_failed", 500);
  return stored;
}

async function nextFoundingOrdinal(): Promise<number | null> {
  const result = await pool.query(
    `SELECT COALESCE(MAX((record_payload -> 'public_launch_entitlement' ->> 'founding_cohort_ordinal')::integer), 0) AS maximum
     FROM product_commercial_records
     WHERE record_payload ? 'public_launch_entitlement'
       AND jsonb_typeof(record_payload -> 'public_launch_entitlement' -> 'founding_cohort_ordinal') = 'number'`
  );
  const next = Number(result.rows?.[0]?.maximum ?? 0) + 1;
  return next <= FOUNDING_ACTIVE_LIMIT && next <= FOUNDING_MAX_AUTHORISED ? next : null;
}

async function ensureInitialEntitlement(userId: string, actorType: ActorType, tierValue: unknown, requestId: string): Promise<PublicLaunchEntitlement> {
  const existing = await currentEntitlement(userId);
  if (existing) return projectedEntitlement(existing);
  const now = new Date().toISOString();
  if (actorType === "athlete") {
    const entitlement = initialAthleteEntitlement(now);
    await appendEntitlementRecord(userId, `${requestId}__initial`, "commercial_billing_access_updated", entitlement, "public_launch_athlete_entitlement_created", {}, now);
    return entitlement;
  }
  const plan = planForRole(actorType, tierValue);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('kolosseum_launch_04_founding_cohort'))");
    const againResult = await client.query(
      `SELECT record_payload -> 'public_launch_entitlement' AS entitlement
       FROM product_commercial_records
       WHERE user_id = $1 AND record_payload ? 'public_launch_entitlement'
       ORDER BY effective_at DESC, created_at DESC, commercial_record_id DESC LIMIT 1`,
      [userId]
    );
    const again = entitlementFrom(againResult.rows?.[0]?.entitlement);
    if (again) {
      await client.query("COMMIT");
      return projectedEntitlement(again);
    }
    const ordinalResult = await client.query(
      `SELECT COALESCE(MAX((record_payload -> 'public_launch_entitlement' ->> 'founding_cohort_ordinal')::integer), 0) AS maximum
       FROM product_commercial_records
       WHERE record_payload ? 'public_launch_entitlement'
         AND jsonb_typeof(record_payload -> 'public_launch_entitlement' -> 'founding_cohort_ordinal') = 'number'`
    );
    const candidate = Number(ordinalResult.rows?.[0]?.maximum ?? 0) + 1;
    const foundingOrdinal = candidate <= FOUNDING_ACTIVE_LIMIT && candidate <= FOUNDING_MAX_AUTHORISED ? candidate : null;
    const entitlement = initialCoachEntitlement(plan, now, foundingOrdinal);
    const commercialRecordId = `commercial_${randomUUID().replace(/-/gu, "")}`;
    const payload = Object.freeze({ contract_version: "LAUNCH-04", status: foundingOrdinal ? "public_launch_founding_trial_started" : "public_launch_standard_coach_entitlement_created", public_launch_entitlement: entitlement, ...ENGINE_INERT_STATE });
    const envelope = { commercial_record_id: commercialRecordId, user_id: userId, request_id: `${requestId}__initial`, record_type: "commercial_billing_access_updated", effective_at: now, record_payload: payload };
    await client.query(
      `INSERT INTO product_commercial_records (commercial_record_id,user_id,request_id,record_type,effective_at,record_payload,record_sha256,created_at)
       VALUES ($1,$2,$3,'commercial_billing_access_updated',$4::timestamptz,$5::jsonb,$6,now())
       ON CONFLICT (user_id,request_id) DO NOTHING`,
      [commercialRecordId, userId, `${requestId}__initial`, now, JSON.stringify(payload), sha256(canonicalJson(envelope))]
    );
    await client.query("COMMIT");
    return entitlement;
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally {
    client.release();
  }
}

async function acceptedRelationshipCount(coachUserId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::integer AS count
     FROM (
       SELECT DISTINCT ON (subject_user_id) subject_user_id, record_payload
       FROM beta_product_records
       WHERE record_type = 'beta17_coach_relationship' AND actor_user_id = $1
       ORDER BY subject_user_id, effective_at DESC, created_at DESC, record_sha256 DESC
     ) latest
     WHERE latest.record_payload ->> 'relationship_state' = 'accepted'`,
    [coachUserId]
  );
  return Number(result.rows?.[0]?.count ?? 0);
}

function useIntroPrice(entitlement: PublicLaunchEntitlement, now = new Date().toISOString()): boolean {
  const projected = projectedEntitlement(entitlement, now);
  return projected.founding_coach && (projected.intro_price_state === "scheduled" || projected.intro_price_state === "active");
}

function checkoutReturnUrl(applicationUrl: string, outcome: "success" | "cancelled"): string {
  const url = new URL(applicationUrl);
  url.searchParams.set("checkout_return", outcome);
  return url.toString();
}

function publicHistoryRecord(value: Readonly<JsonRecord>): Readonly<JsonRecord> {
  return Object.freeze({
    commercial_record_id: cleanString(value.commercial_record_id),
    request_id: cleanString(value.request_id),
    record_type: cleanString(value.record_type),
    effective_at_iso8601: cleanString(value.effective_at),
    record_sha256: cleanString(value.record_sha256)
  });
}

export async function startPublicLaunchCoachTrial(userIdValue: unknown, actorTypeValue: unknown, inputValue: unknown): Promise<Readonly<JsonRecord>> {
  if (!publicLaunchBillingEnabled()) throw new ProductCommercialError("public_launch_billing_disabled", 409);
  const userId = requireUserId(userIdValue);
  const actorType = cleanActorType(actorTypeValue);
  if (actorType !== "coach") throw new ProductCommercialError("public_launch_coach_trial_required", 403);
  const input = exactInput(inputValue, ["request_id", "tier"]);
  const requestId = requireRequestId(input.request_id);
  const existingRequest = await recordByRequest(userId, requestId);
  if (existingRequest) return Object.freeze({ ok: true, idempotent_replay: true, action: "trial_start", overview: await getPublicLaunchCommercialOverview(userId, actorType), ...ENGINE_INERT_STATE });
  const previous = await currentEntitlement(userId);
  if (previous) {
    return Object.freeze({ ok: true, idempotent_replay: true, action: "trial_start", reason_code: previous.founding_coach ? "founding_trial_already_allocated" : "founding_offer_not_available", overview: await getPublicLaunchCommercialOverview(userId, actorType), ...ENGINE_INERT_STATE });
  }
  const entitlement = await ensureInitialEntitlement(userId, actorType, input.tier, requestId);
  await appendEntitlementRecord(userId, requestId, "commercial_billing_access_updated", entitlement, entitlement.founding_coach ? "public_launch_founding_trial_confirmed" : "public_launch_founding_offer_unavailable");
  return Object.freeze({ ok: true, idempotent_replay: false, action: "trial_start", founding_offer_applied: entitlement.founding_coach, overview: await getPublicLaunchCommercialOverview(userId, actorType), ...ENGINE_INERT_STATE });
}

export async function getPublicLaunchCommercialOverview(userIdValue: unknown, actorTypeValue: unknown): Promise<Readonly<JsonRecord>> {
  const userId = requireUserId(userIdValue);
  const actorType = cleanActorType(actorTypeValue);
  const rawEntitlement = await currentEntitlement(userId);
  const entitlement = rawEntitlement ? projectedEntitlement(rawEntitlement) : null;
  const occupied = actorType === "coach" ? await acceptedRelationshipCount(userId) : 0;
  const defaultPlan = planForRole(actorType, entitlement?.tier);
  const useIntro = entitlement ? useIntroPrice(entitlement) : false;
  const config = providerConfiguration(defaultPlan, useIntro);
  const tierOptions = Object.values(PUBLIC_LAUNCH_PLANS)
    .filter((plan) => plan.account_role === actorType)
    .map((plan) => Object.freeze({
      tier: plan.tier,
      athlete_capacity: plan.athlete_capacity,
      standard_price_gbp_minor: plan.standard_price_gbp_minor,
      intro_price_gbp_minor: plan.intro_price_gbp_minor,
      configuration_state: providerConfiguration(plan, Boolean(entitlement?.founding_coach && entitlement.intro_price_state !== "completed")).state
    }));
  const capacity = entitlement?.athlete_capacity ?? null;
  return Object.freeze({
    ok: true,
    commercial: Object.freeze({
      commercial_scope: `public_launch_${actorType}`,
      configuration_state: config.state,
      missing_configuration: config.missing_configuration,
      subscription_state: entitlement?.billing_state ?? "not_started",
      factual_state: entitlement?.access_state ?? "restricted",
      product_access_state: entitlement?.access_state === "active" ? "allowed" : "restricted",
      billing_status: entitlement?.billing_state ?? "not_started",
      billing_access_state: entitlement?.access_state ?? "restricted",
      plan_id: entitlement?.tier ?? defaultPlan.tier,
      tier: entitlement?.tier ?? defaultPlan.tier,
      athlete_capacity: capacity,
      seat_limit: capacity,
      occupied_seat_count: occupied,
      available_seat_count: capacity === null ? null : Math.max(capacity - occupied, 0),
      seat_limit_reached: capacity !== null && occupied >= capacity,
      trial_state: entitlement?.trial_state ?? (actorType === "coach" ? "eligible" : "not_applicable"),
      trial_start_at: entitlement?.trial_start_at ?? null,
      trial_end_at: entitlement?.trial_end_at ?? null,
      intro_price_state: entitlement?.intro_price_state ?? "not_applicable",
      intro_period_start_at: entitlement?.intro_period_start_at ?? null,
      intro_period_end_at: entitlement?.intro_period_end_at ?? null,
      founding_coach: entitlement?.founding_coach ?? false,
      founding_cohort_ordinal: entitlement?.founding_cohort_ordinal ?? null,
      checkout_available: config.state === "ready",
      checkout_redirect_available: config.state === "ready",
      billing_surface_visible: true,
      trial_start_available: actorType === "coach" && !entitlement,
      tier_change_available: actorType === "coach" && Boolean(entitlement),
      cancel_available: Boolean(entitlement && entitlement.billing_state !== "ended"),
      reconcile_available: Boolean(cleanString(entitlement?.billing_provider_ids.subscription_id)),
      portal_available: Boolean(cleanString(entitlement?.billing_provider_ids.customer_id)),
      tier_options: Object.freeze(tierOptions),
      entitlement: entitlement ? Object.freeze({ ...entitlement }) : null,
      entitlement_error: entitlement?.access_state === "active" ? null : Object.freeze({ code: "commercial_access_required", message: "Public-launch commercial access is not active." }),
      provider_call_performed: false,
      ...ENGINE_INERT_STATE
    }),
    history: Object.freeze([]),
    ...ENGINE_INERT_STATE
  });
}

export async function createPublicLaunchCheckout(userIdValue: unknown, actorTypeValue: unknown, inputValue: unknown): Promise<Readonly<JsonRecord>> {
  if (!publicLaunchBillingEnabled()) throw new ProductCommercialError("public_launch_billing_disabled", 409);
  const userId = requireUserId(userIdValue);
  const actorType = cleanActorType(actorTypeValue);
  const input = exactInput(inputValue, ["request_id", "tier"]);
  const requestId = requireRequestId(input.request_id);
  const existing = await recordByRequest(userId, requestId);
  if (existing) {
    const payload = isRecord(existing.record_payload) ? existing.record_payload : {};
    return Object.freeze({ ok: true, idempotent_replay: true, action: "checkout_request", checkout_url: cleanString(payload.checkout_url) || null, overview: await getPublicLaunchCommercialOverview(userId, actorType), provider_call_performed: false, ...ENGINE_INERT_STATE });
  }
  let entitlement = await ensureInitialEntitlement(userId, actorType, input.tier, requestId);
  entitlement = projectedEntitlement(entitlement);
  const requestedPlan = planForRole(actorType, input.tier ?? entitlement.tier);
  if (requestedPlan.tier !== entitlement.tier) {
    if (actorType !== "coach") throw new ProductCommercialError("public_launch_billing_tier_invalid");
    const changed = await changePublicLaunchCoachTier(userId, actorType, { request_id: `${requestId}__tier`, tier: requestedPlan.tier });
    const changedOverview = changed.overview as JsonRecord;
    const changedCommercial = isRecord(changedOverview?.commercial) ? changedOverview.commercial : {};
    entitlement = entitlementFrom(changedCommercial.entitlement) ?? entitlement;
  }
  const plan = planForRole(actorType, entitlement.tier);
  const intro = useIntroPrice(entitlement);
  const config = providerConfiguration(plan, intro);
  if (config.state !== "ready" || !cleanString(config.price_id) || !cleanString(config.application_url)) {
    throw new ProductCommercialError("commercial_configuration_missing", 409, { missing_configuration: config.missing_configuration });
  }
  const priceId = cleanString(config.price_id);
  const applicationUrl = cleanString(config.application_url);
  const metadata: Record<string, string> = {
    slice: "LAUNCH-04",
    release_id: "kolosseum_public_launch",
    actor_id: userId,
    account_role: actorType,
    tier: plan.tier,
    price_phase: intro ? "intro" : "standard"
  };
  if (entitlement.intro_period_start_at) metadata.intro_period_start_at = entitlement.intro_period_start_at;
  if (entitlement.intro_period_end_at) metadata.intro_period_end_at = entitlement.intro_period_end_at;
  const trialEndUnix = entitlement.trial_state === "active" && entitlement.trial_end_at ? Math.floor(Date.parse(entitlement.trial_end_at) / 1000) : null;
  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = { metadata };
  if (trialEndUnix && trialEndUnix > Math.floor(Date.now() / 1000)) subscriptionData.trial_end = trialEndUnix;
  let session: Stripe.Checkout.Session;
  try {
    session = await stripeClient().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: checkoutReturnUrl(applicationUrl, "success"),
      cancel_url: checkoutReturnUrl(applicationUrl, "cancelled"),
      client_reference_id: userId,
      metadata,
      subscription_data: subscriptionData,
      ...(trialEndUnix ? { payment_method_collection: "if_required" as const } : {})
    }, { idempotencyKey: requestId });
  }
  catch (error) {
    throw new ProductCommercialError("commercial_checkout_provider_call_failed", 502, { provider_error_type: error instanceof Stripe.errors.StripeError ? error.type : "unknown_error" });
  }
  const updated: PublicLaunchEntitlement = Object.freeze({
    ...entitlement,
    billing_provider_ids: Object.freeze({
      ...entitlement.billing_provider_ids,
      customer_id: typeof session.customer === "string" ? session.customer : null,
      checkout_session_id: session.id,
      price_id: priceId
    }),
    entitlement_metadata: Object.freeze({ ...entitlement.entitlement_metadata, provider_mode: providerMode(), checkout_requested_at: new Date().toISOString() })
  });
  const stored = await appendEntitlementRecord(userId, requestId, "commercial_checkout_requested", updated, "public_launch_checkout_requested", { checkout_url: session.url, provider_call_performed: true });
  return Object.freeze({ ok: true, idempotent_replay: false, action: "checkout_request", record: publicHistoryRecord(stored), checkout_url: session.url, overview: await getPublicLaunchCommercialOverview(userId, actorType), provider_call_performed: true, ...ENGINE_INERT_STATE });
}

async function updateProviderSubscriptionTier(entitlement: PublicLaunchEntitlement, plan: PlanDefinition): Promise<Readonly<JsonRecord>> {
  const subscriptionId = cleanString(entitlement.billing_provider_ids.subscription_id);
  if (!subscriptionId) return Object.freeze({ provider_call_performed: false, subscription_item_id: null, price_id: null });
  const intro = useIntroPrice(entitlement);
  const config = providerConfiguration(plan, intro);
  const priceId = cleanString(config.price_id);
  if (config.state !== "ready" || !priceId) throw new ProductCommercialError("commercial_configuration_missing", 409, { missing_configuration: config.missing_configuration });
  const subscription = await stripeClient().subscriptions.retrieve(subscriptionId);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) throw new ProductCommercialError("public_launch_subscription_item_missing", 409);
  await stripeClient().subscriptions.update(subscriptionId, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: "none",
    metadata: { slice: "LAUNCH-04", tier: plan.tier, intro_period_end_at: entitlement.intro_period_end_at ?? "" }
  });
  return Object.freeze({ provider_call_performed: true, subscription_item_id: itemId, price_id: priceId });
}

export async function changePublicLaunchCoachTier(userIdValue: unknown, actorTypeValue: unknown, inputValue: unknown): Promise<Readonly<JsonRecord>> {
  if (!publicLaunchBillingEnabled()) throw new ProductCommercialError("public_launch_billing_disabled", 409);
  const userId = requireUserId(userIdValue);
  const actorType = cleanActorType(actorTypeValue);
  if (actorType !== "coach") throw new ProductCommercialError("public_launch_coach_tier_required", 403);
  const input = exactInput(inputValue, ["request_id", "tier"]);
  const requestId = requireRequestId(input.request_id);
  if (await recordByRequest(userId, requestId)) return Object.freeze({ ok: true, idempotent_replay: true, action: "tier_change", overview: await getPublicLaunchCommercialOverview(userId, actorType), ...ENGINE_INERT_STATE });
  const raw = await currentEntitlement(userId);
  if (!raw) throw new ProductCommercialError("public_launch_entitlement_missing", 409);
  const entitlement = projectedEntitlement(raw);
  const plan = planForRole("coach", input.tier);
  const occupied = await acceptedRelationshipCount(userId);
  if (plan.athlete_capacity !== null && occupied > plan.athlete_capacity) {
    throw new ProductCommercialError("product_access_rejected", 409, { reason: "coach_capacity_downgrade_blocked", occupied_athletes: occupied, requested_capacity: plan.athlete_capacity });
  }
  const provider = await updateProviderSubscriptionTier(entitlement, plan);
  const updated: PublicLaunchEntitlement = Object.freeze({
    ...entitlement,
    tier: plan.tier,
    athlete_capacity: plan.athlete_capacity,
    standard_price_gbp_minor: plan.standard_price_gbp_minor,
    intro_price_gbp_minor: plan.intro_price_gbp_minor,
    billing_provider_ids: Object.freeze({ ...entitlement.billing_provider_ids, subscription_item_id: provider.subscription_item_id ?? entitlement.billing_provider_ids.subscription_item_id, price_id: provider.price_id ?? entitlement.billing_provider_ids.price_id }),
    entitlement_metadata: Object.freeze({ ...entitlement.entitlement_metadata, tier_changed_at: new Date().toISOString(), intro_clock_preserved: true })
  });
  const stored = await appendEntitlementRecord(userId, requestId, "commercial_billing_access_updated", updated, "public_launch_tier_changed", { previous_tier: entitlement.tier, provider_call_performed: provider.provider_call_performed === true });
  return Object.freeze({ ok: true, idempotent_replay: false, action: "tier_change", record: publicHistoryRecord(stored), overview: await getPublicLaunchCommercialOverview(userId, actorType), provider_call_performed: provider.provider_call_performed === true, ...ENGINE_INERT_STATE });
}

export async function cancelPublicLaunchBilling(userIdValue: unknown, actorTypeValue: unknown, inputValue: unknown): Promise<Readonly<JsonRecord>> {
  if (!publicLaunchBillingEnabled()) throw new ProductCommercialError("public_launch_billing_disabled", 409);
  const userId = requireUserId(userIdValue);
  const actorType = cleanActorType(actorTypeValue);
  const input = exactInput(inputValue, ["request_id"]);
  const requestId = requireRequestId(input.request_id);
  if (await recordByRequest(userId, requestId)) return Object.freeze({ ok: true, idempotent_replay: true, action: "cancel", overview: await getPublicLaunchCommercialOverview(userId, actorType), ...ENGINE_INERT_STATE });
  const raw = await currentEntitlement(userId);
  if (!raw) throw new ProductCommercialError("public_launch_entitlement_missing", 409);
  const entitlement = projectedEntitlement(raw);
  const subscriptionId = cleanString(entitlement.billing_provider_ids.subscription_id);
  let providerCall = false;
  if (subscriptionId) {
    await stripeClient().subscriptions.update(subscriptionId, { cancel_at_period_end: true, metadata: { slice: "LAUNCH-04", cancellation_requested: "true" } });
    providerCall = true;
  }
  const updated: PublicLaunchEntitlement = Object.freeze({
    ...entitlement,
    trial_state: !subscriptionId && entitlement.trial_state === "active" ? "completed" : entitlement.trial_state,
    billing_state: "cancelled",
    access_state: subscriptionId ? "active" : "inactive",
    entitlement_metadata: Object.freeze({ ...entitlement.entitlement_metadata, cancel_at_period_end: Boolean(subscriptionId), cancellation_requested_at: new Date().toISOString() })
  });
  const stored = await appendEntitlementRecord(userId, requestId, "commercial_billing_access_updated", updated, "public_launch_cancellation_requested", { provider_call_performed: providerCall });
  return Object.freeze({ ok: true, idempotent_replay: false, action: "cancel", record: publicHistoryRecord(stored), overview: await getPublicLaunchCommercialOverview(userId, actorType), provider_call_performed: providerCall, ...ENGINE_INERT_STATE });
}

function stripeId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id: unknown }).id === "string") return (value as { id: string }).id;
  return null;
}

function planByProviderPriceId(priceId: string, role: ActorType): Readonly<{ plan: PlanDefinition; phase: "intro" | "standard" }> | null {
  for (const plan of Object.values(PUBLIC_LAUNCH_PLANS)) {
    if (plan.account_role !== role) continue;
    if (cleanString(process.env[plan.standard_price_env]) === priceId) return Object.freeze({ plan, phase: "standard" });
    if (plan.intro_price_env && cleanString(process.env[plan.intro_price_env]) === priceId) return Object.freeze({ plan, phase: "intro" });
  }
  return null;
}

function eventIsNewer(entitlement: PublicLaunchEntitlement, event: Stripe.Event): boolean {
  const previousCreated = Number(entitlement.entitlement_metadata.latest_provider_event_created ?? -1);
  const previousId = cleanString(entitlement.entitlement_metadata.latest_provider_event_id);
  if (event.created > previousCreated) return true;
  if (event.created < previousCreated) return false;
  return event.id > previousId;
}

function withEventCursor(entitlement: PublicLaunchEntitlement, event: Stripe.Event, metadata: JsonRecord = {}): PublicLaunchEntitlement {
  return Object.freeze({
    ...entitlement,
    entitlement_metadata: Object.freeze({ ...entitlement.entitlement_metadata, ...metadata, latest_provider_event_created: event.created, latest_provider_event_id: event.id })
  });
}

async function userIdByProviderReference(customerId: string | null, subscriptionId: string | null): Promise<string | null> {
  if (!customerId && !subscriptionId) return null;
  const result = await pool.query(
    `SELECT user_id
     FROM product_commercial_records
     WHERE record_payload ? 'public_launch_entitlement'
       AND (($1::text IS NOT NULL AND record_payload -> 'public_launch_entitlement' -> 'billing_provider_ids' ->> 'customer_id' = $1)
         OR ($2::text IS NOT NULL AND record_payload -> 'public_launch_entitlement' -> 'billing_provider_ids' ->> 'subscription_id' = $2))
     ORDER BY effective_at DESC, created_at DESC LIMIT 1`,
    [customerId, subscriptionId]
  );
  return result.rows?.[0] ? cleanString(result.rows[0].user_id) || null : null;
}

async function reconcileSubscriptionEntitlement(entitlement: PublicLaunchEntitlement, subscription: Stripe.Subscription, event: Stripe.Event | null): Promise<PublicLaunchEntitlement> {
  const status = subscription.status;
  let billingState: BillingState;
  let accessState: AccessState;
  if (status === "trialing") { billingState = "trial"; accessState = "active"; }
  else if (status === "active") { billingState = "active_paid"; accessState = "active"; }
  else if (status === "canceled") { billingState = "ended"; accessState = "inactive"; }
  else { billingState = "past_due"; accessState = "restricted"; }
  const priceId = subscription.items.data[0]?.price?.id ?? "";
  const mapped = priceId ? planByProviderPriceId(priceId, entitlement.account_role) : null;
  const occupied = entitlement.account_role === "coach" ? await acceptedRelationshipCount(cleanString(subscription.metadata.actor_id) || "") : 0;
  const capacityViolation = Boolean(mapped?.plan.athlete_capacity !== null && mapped?.plan.athlete_capacity !== undefined && occupied > mapped.plan.athlete_capacity);
  const base: PublicLaunchEntitlement = Object.freeze({
    ...entitlement,
    ...(mapped ? { tier: mapped.plan.tier, athlete_capacity: mapped.plan.athlete_capacity, standard_price_gbp_minor: mapped.plan.standard_price_gbp_minor, intro_price_gbp_minor: mapped.plan.intro_price_gbp_minor } : {}),
    intro_price_state: mapped?.phase === "standard" && entitlement.founding_coach ? "completed" : entitlement.intro_price_state,
    billing_state: capacityViolation ? "past_due" : billingState,
    access_state: capacityViolation || !mapped ? "restricted" : accessState,
    billing_provider_ids: Object.freeze({ ...entitlement.billing_provider_ids, customer_id: stripeId(subscription.customer) ?? entitlement.billing_provider_ids.customer_id, subscription_id: subscription.id, subscription_item_id: subscription.items.data[0]?.id ?? entitlement.billing_provider_ids.subscription_item_id, price_id: priceId || entitlement.billing_provider_ids.price_id }),
    entitlement_metadata: Object.freeze({ ...entitlement.entitlement_metadata, cancel_at_period_end: subscription.cancel_at_period_end === true, reconciliation_error: !mapped ? "unknown_provider_price" : capacityViolation ? "provider_tier_below_relationship_capacity" : null })
  });
  return event ? withEventCursor(base, event) : base;
}

export async function reconcilePublicLaunchBilling(userIdValue: unknown, actorTypeValue: unknown, inputValue: unknown): Promise<Readonly<JsonRecord>> {
  if (!publicLaunchBillingEnabled()) throw new ProductCommercialError("public_launch_billing_disabled", 409);
  const userId = requireUserId(userIdValue);
  const actorType = cleanActorType(actorTypeValue);
  const input = exactInput(inputValue, ["request_id"]);
  const requestId = requireRequestId(input.request_id);
  if (await recordByRequest(userId, requestId)) return Object.freeze({ ok: true, idempotent_replay: true, action: "reconcile", overview: await getPublicLaunchCommercialOverview(userId, actorType), ...ENGINE_INERT_STATE });
  const raw = await currentEntitlement(userId);
  if (!raw) throw new ProductCommercialError("public_launch_entitlement_missing", 409);
  const subscriptionId = cleanString(raw.billing_provider_ids.subscription_id);
  if (!subscriptionId) throw new ProductCommercialError("public_launch_subscription_missing", 409);
  const subscription = await stripeClient().subscriptions.retrieve(subscriptionId);
  const updated = await reconcileSubscriptionEntitlement(projectedEntitlement(raw), subscription, null);
  const stored = await appendEntitlementRecord(userId, requestId, "commercial_billing_access_updated", updated, "public_launch_subscription_reconciled", { provider_call_performed: true });
  return Object.freeze({ ok: true, idempotent_replay: false, action: "reconcile", record: publicHistoryRecord(stored), overview: await getPublicLaunchCommercialOverview(userId, actorType), provider_call_performed: true, ...ENGINE_INERT_STATE });
}

export async function assertPublicLaunchCoachCapacity(coachUserIdValue: unknown): Promise<void> {
  if (!publicLaunchBillingEnabled()) return;
  const coachUserId = requireUserId(coachUserIdValue);
  const raw = await currentEntitlement(coachUserId);
  const entitlement = raw ? projectedEntitlement(raw) : null;
  if (!entitlement || entitlement.account_role !== "coach" || entitlement.access_state !== "active" || entitlement.athlete_capacity === null) {
    throw new ProductCommercialError("product_access_rejected", 403, { reason: "coach_commercial_access_inactive" });
  }
  const occupied = await acceptedRelationshipCount(coachUserId);
  if (occupied >= entitlement.athlete_capacity) {
    throw new ProductCommercialError("product_access_rejected", 409, { reason: "coach_athlete_capacity_reached", athlete_capacity: entitlement.athlete_capacity, occupied_athletes: occupied });
  }
}

async function advanceIntroAfterPaidInvoice(userId: string, entitlement: PublicLaunchEntitlement, invoice: Stripe.Invoice): Promise<Readonly<{ entitlement: PublicLaunchEntitlement; provider_call_performed: boolean }>> {
  if (!entitlement.founding_coach || entitlement.intro_price_state === "completed" || Number(invoice.amount_paid ?? 0) <= 0) {
    return Object.freeze({ entitlement, provider_call_performed: false });
  }
  const previousCycles = Number(entitlement.entitlement_metadata.intro_paid_cycles ?? 0);
  const paidCycles = previousCycles + 1;
  const introEndedByDate = Boolean(entitlement.intro_period_end_at && Date.now() >= Date.parse(entitlement.intro_period_end_at));
  if (paidCycles < COACH_INTRO_MONTHS && !introEndedByDate) {
    return Object.freeze({ entitlement: Object.freeze({ ...entitlement, intro_price_state: "active", entitlement_metadata: Object.freeze({ ...entitlement.entitlement_metadata, intro_paid_cycles: paidCycles }) }), provider_call_performed: false });
  }
  const plan = planForRole(entitlement.account_role, entitlement.tier);
  const config = providerConfiguration(plan, false);
  const subscriptionId = cleanString(entitlement.billing_provider_ids.subscription_id);
  const standardPriceId = cleanString(config.price_id);
  let providerCall = false;
  let itemId = cleanString(entitlement.billing_provider_ids.subscription_item_id);
  if (subscriptionId && config.state === "ready" && standardPriceId) {
    if (!itemId) {
      const subscription = await stripeClient().subscriptions.retrieve(subscriptionId);
      itemId = subscription.items.data[0]?.id ?? "";
    }
    if (itemId) {
      await stripeClient().subscriptions.update(subscriptionId, { items: [{ id: itemId, price: standardPriceId }], proration_behavior: "none", metadata: { slice: "LAUNCH-04", tier: entitlement.tier, intro_completed: "true" } });
      providerCall = true;
    }
  }
  return Object.freeze({
    entitlement: Object.freeze({
      ...entitlement,
      intro_price_state: "completed",
      billing_provider_ids: Object.freeze({ ...entitlement.billing_provider_ids, subscription_item_id: itemId || entitlement.billing_provider_ids.subscription_item_id, price_id: standardPriceId || entitlement.billing_provider_ids.price_id }),
      entitlement_metadata: Object.freeze({ ...entitlement.entitlement_metadata, intro_paid_cycles: paidCycles, standard_price_transition_at: new Date().toISOString() })
    }),
    provider_call_performed: providerCall
  });
}

export async function recordPublicLaunchBillingWebhookEvent(event: Stripe.Event): Promise<Readonly<{ handled: boolean; result: Readonly<JsonRecord> }>> {
  const object = event.data.object as unknown;
  const objectRecord = isRecord(object) ? object : {};
  const metadata = isRecord(objectRecord.metadata) ? objectRecord.metadata : {};
  const directUserId = cleanString(objectRecord.client_reference_id) || cleanString(metadata.actor_id);
  const customerId = stripeId(objectRecord.customer);
  const subscriptionId = event.type.startsWith("customer.subscription.") ? stripeId(object) : stripeId(objectRecord.subscription);
  const userId = directUserId || await userIdByProviderReference(customerId, subscriptionId);
  const explicitlyPublicLaunch = cleanString(metadata.slice) === "LAUNCH-04";
  if (!userId && !explicitlyPublicLaunch) return Object.freeze({ handled: false, result: Object.freeze({ ok: true, action: "webhook_ignored" }) });
  if (!userId) return Object.freeze({ handled: true, result: Object.freeze({ ok: true, action: "webhook_ignored", reason_code: "public_launch_webhook_actor_unresolved", ...ENGINE_INERT_STATE }) });
  const raw = await currentEntitlement(userId);
  if (!raw) {
    if (!explicitlyPublicLaunch) return Object.freeze({ handled: false, result: Object.freeze({ ok: true, action: "webhook_ignored" }) });
    return Object.freeze({ handled: true, result: Object.freeze({ ok: true, action: "webhook_ignored", reason_code: "public_launch_entitlement_missing", ...ENGINE_INERT_STATE }) });
  }
  if (await recordByRequest(userId, event.id)) return Object.freeze({ handled: true, result: Object.freeze({ ok: true, action: "webhook_idempotent_replay", ...ENGINE_INERT_STATE }) });
  let entitlement = projectedEntitlement(raw, new Date(event.created * 1000).toISOString());
  if (!eventIsNewer(entitlement, event)) {
    await appendEntitlementRecord(userId, event.id, "commercial_billing_access_updated", entitlement, "public_launch_stale_webhook_ignored", { provider_event_type: event.type, stale_provider_event: true }, new Date(event.created * 1000).toISOString());
    return Object.freeze({ handled: true, result: Object.freeze({ ok: true, action: "webhook_stale_ignored", ...ENGINE_INERT_STATE }) });
  }
  let providerCall = false;
  if (event.type === "checkout.session.completed") {
    const session = object as Stripe.Checkout.Session;
    const trialActive = entitlement.trial_state === "active" && Boolean(entitlement.trial_end_at && event.created * 1000 < Date.parse(entitlement.trial_end_at));
    entitlement = withEventCursor(Object.freeze({
      ...entitlement,
      billing_state: trialActive ? "trial" : "active_paid",
      access_state: "active",
      intro_price_state: entitlement.founding_coach && !trialActive ? "active" : entitlement.intro_price_state,
      billing_provider_ids: Object.freeze({ ...entitlement.billing_provider_ids, customer_id: stripeId(session.customer), subscription_id: stripeId(session.subscription), checkout_session_id: session.id })
    }), event);
  }
  else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = object as Stripe.Subscription;
    entitlement = await reconcileSubscriptionEntitlement(entitlement, subscription, event);
  }
  else if (event.type === "invoice.payment_failed") {
    entitlement = withEventCursor(Object.freeze({ ...entitlement, billing_state: "past_due", access_state: "restricted" }), event, { last_payment_failure_at: new Date(event.created * 1000).toISOString() });
  }
  else if (event.type === "invoice.paid") {
    const invoice = object as Stripe.Invoice;
    const advanced = await advanceIntroAfterPaidInvoice(userId, Object.freeze({ ...entitlement, billing_state: "active_paid", access_state: "active" }), invoice);
    providerCall = advanced.provider_call_performed;
    entitlement = withEventCursor(advanced.entitlement, event, { last_paid_invoice_at: new Date(event.created * 1000).toISOString() });
  }
  else {
    return Object.freeze({ handled: explicitlyPublicLaunch, result: Object.freeze({ ok: true, action: "webhook_ignored", reason_code: "unhandled_event_type", ...ENGINE_INERT_STATE }) });
  }
  const stored = await appendEntitlementRecord(userId, event.id, "commercial_billing_access_updated", entitlement, `public_launch_webhook_${event.type.replaceAll(".", "_")}`, { provider_event_type: event.type, trusted_provider_confirmation: true, provider_call_performed: providerCall }, new Date(event.created * 1000).toISOString());
  return Object.freeze({ handled: true, result: Object.freeze({ ok: true, action: "webhook_recorded", record: publicHistoryRecord(stored), provider_call_performed: providerCall, ...ENGINE_INERT_STATE }) });
}

export const PUBLIC_LAUNCH_BILLING_CONSTANTS = Object.freeze({
  coach_trial_days: COACH_TRIAL_DAYS,
  coach_intro_paid_months: COACH_INTRO_MONTHS,
  founding_active_limit: FOUNDING_ACTIVE_LIMIT,
  founding_max_authorised: FOUNDING_MAX_AUTHORISED
});
