// DEV NOTE: FULL-UI-03C staged athlete onboarding persistence.
// Records are explicit user declarations. No ability, safety, readiness,
// suitability, risk or recommendation is inferred here.

import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import {
  createBeta16AcknowledgementRecord,
  createBeta16Phase1DeclarationRecord
} from "./beta16_app_path_service.js";

type Json = Record<string, unknown>;
type QueryClient = Pick<PoolClient, "query">;

export const ATHLETE_ONBOARDING_STAGES = Object.freeze([
  "activity", "execution_scope", "product_acknowledgement", "jurisdiction",
  "accessibility", "instruction_density", "review"
] as const);
export type AthleteOnboardingStage = (typeof ATHLETE_ONBOARDING_STAGES)[number];
export const ATHLETE_ACTIVITY_IDS = Object.freeze([
  "powerlifting", "general_strength", "rugby_union", "strongman"
] as const);
export const ATHLETE_EXECUTION_SCOPES = Object.freeze([
  "individual", "coach_managed"
] as const);
export const ATHLETE_JURISDICTIONS = Object.freeze([
  "england_wales", "scotland", "northern_ireland", "other"
] as const);
export const ATHLETE_INSTRUCTION_DENSITIES = Object.freeze([
  "minimal", "standard", "detailed"
] as const);

const ACCESSIBILITY_KEYS = [
  "reduced_motion", "high_contrast", "larger_text", "screen_reader_optimised"
] as const;
const FIELD_KEYS = new Set([
  "activity_id", "execution_scope", "product_acknowledged", "jurisdiction_code",
  "jurisdiction_acknowledged", "accessibility_preferences", "instruction_density"
]);
const INFERENCE_KEYS = new Set([
  "ability", "ability_score", "readiness", "readiness_score", "safety",
  "safety_score", "suitability", "suitability_score", "risk", "risk_score",
  "recommendation", "clearance", "fitness_to_train"
]);
const DRAFT_EVENT = "athlete_onboarding_draft_saved";
const DECLARATION_EVENT = "athlete_declaration_confirmed";
const BETA_VERSION = "september_beta_2026";
const JURISDICTION_VERSION = "jurisdiction_v1";
const SCHEMA_VERSION = "full_ui_03c_v1";

type Accessibility = Readonly<Record<(typeof ACCESSIBILITY_KEYS)[number], boolean>>;
type Fields = Readonly<{
  activity_id?: string;
  execution_scope?: string;
  product_acknowledged?: boolean;
  jurisdiction_code?: string;
  jurisdiction_acknowledged?: boolean;
  accessibility_preferences?: Accessibility;
  instruction_density?: string;
}>;
type StoredEvent = Readonly<{
  event_id: string;
  event_type: string;
  event_payload: Json;
  occurred_at: string;
}>;

export class AthleteOnboardingError extends Error {
  readonly code: string;
  readonly status: number;
  readonly field_errors: Readonly<Record<string, string>>;
  constructor(code: string, status = 400, fields: Record<string, string> = {}) {
    super(code);
    this.name = "AthleteOnboardingError";
    this.code = code;
    this.status = status;
    this.field_errors = Object.freeze({ ...fields });
  }
}

function record(value: unknown): value is Json {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/gu, "")}`;
}
function stable(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (typeof value === "object") {
    const item = value as Json;
    return `{${Object.keys(item).sort().map(
      (key) => `${JSON.stringify(key)}:${stable(item[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
function hash(value: unknown): string {
  return crypto.createHash("sha256").update(stable(value), "utf8").digest("hex");
}
function fail(field: string, message: string): never {
  throw new AthleteOnboardingError(
    "athlete_onboarding_validation_failed", 422, { [field]: message }
  );
}
function enumValue(value: unknown, values: readonly string[], field: string, message: string): string {
  const clean = text(value);
  if (!values.includes(clean)) fail(field, message);
  return clean;
}
function trueValue(value: unknown, field: string, message: string): true {
  if (value !== true) fail(field, message);
  return true;
}
function noInference(value: unknown, path: string[] = []): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => noInference(entry, [...path, String(index)]));
    return;
  }
  if (!record(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (INFERENCE_KEYS.has(key)) {
      const field = [...path, key].join(".");
      throw new AthleteOnboardingError(
        "athlete_onboarding_inference_field_prohibited", 422,
        { [field]: "This field is not part of athlete declarations." }
      );
    }
    noInference(entry, [...path, key]);
  }
}

export function validateAthleteActivityId(value: unknown): string {
  return enumValue(value, ATHLETE_ACTIVITY_IDS, "activity_id", "Choose a supported activity.");
}
export function validateAthleteExecutionScope(value: unknown): string {
  return enumValue(value, ATHLETE_EXECUTION_SCOPES, "execution_scope", "Choose an execution scope.");
}
export function validateAthleteJurisdiction(value: unknown): string {
  return enumValue(value, ATHLETE_JURISDICTIONS, "jurisdiction_code", "Choose the jurisdiction you are acknowledging.");
}
export function validateAthleteInstructionDensity(value: unknown): string {
  return enumValue(value, ATHLETE_INSTRUCTION_DENSITIES, "instruction_density", "Choose an instruction-density preference.");
}
export function validateAthleteAccessibilityPreferences(value: unknown): Accessibility {
  if (!record(value)) fail("accessibility_preferences", "Choose your accessibility preferences.");
  for (const key of Object.keys(value)) {
    if (!(ACCESSIBILITY_KEYS as readonly string[]).includes(key)) {
      fail(`accessibility_preferences.${key}`, "This accessibility preference is not supported.");
    }
  }
  const result = {} as Record<string, boolean>;
  for (const key of ACCESSIBILITY_KEYS) {
    if (typeof value[key] !== "boolean") {
      fail(`accessibility_preferences.${key}`, "Select yes or no for this preference.");
    }
    result[key] = value[key] as boolean;
  }
  return Object.freeze(result) as Accessibility;
}

function stage(value: unknown): AthleteOnboardingStage {
  return enumValue(
    value, ATHLETE_ONBOARDING_STAGES, "current_stage", "Choose a valid onboarding stage."
  ) as AthleteOnboardingStage;
}
function fields(value: unknown, partial: boolean): Fields {
  if (!record(value)) fail("fields", "Declaration fields are required.");
  noInference(value);
  for (const key of Object.keys(value)) {
    if (!FIELD_KEYS.has(key)) fail(key, "This field is not part of athlete onboarding.");
  }
  const out: Json = {};
  const add = (key: string, validator: (entry: unknown) => unknown, missing: string) => {
    if (Object.prototype.hasOwnProperty.call(value, key)) out[key] = validator(value[key]);
    else if (!partial) fail(key, missing);
  };
  add("activity_id", validateAthleteActivityId, "Choose an activity.");
  add("execution_scope", validateAthleteExecutionScope, "Choose an execution scope.");
  add("product_acknowledged", (entry) => trueValue(
    entry, "product_acknowledged", "Acknowledge the controlled-beta product boundary."
  ), "Acknowledge the controlled-beta product boundary.");
  add("jurisdiction_code", validateAthleteJurisdiction, "Choose a jurisdiction.");
  add("jurisdiction_acknowledged", (entry) => trueValue(
    entry, "jurisdiction_acknowledged", "Acknowledge the selected jurisdiction."
  ), "Acknowledge the selected jurisdiction.");
  add("accessibility_preferences", validateAthleteAccessibilityPreferences, "Choose your accessibility preferences.");
  add("instruction_density", validateAthleteInstructionDensity, "Choose an instruction-density preference.");
  return Object.freeze(out) as Fields;
}
const REQUIRED_BEFORE: Record<AthleteOnboardingStage, readonly string[]> = {
  activity: [],
  execution_scope: ["activity_id"],
  product_acknowledgement: ["activity_id", "execution_scope"],
  jurisdiction: ["activity_id", "execution_scope", "product_acknowledged"],
  accessibility: [
    "activity_id", "execution_scope", "product_acknowledged",
    "jurisdiction_code", "jurisdiction_acknowledged"
  ],
  instruction_density: [
    "activity_id", "execution_scope", "product_acknowledged", "jurisdiction_code",
    "jurisdiction_acknowledged", "accessibility_preferences"
  ],
  review: [
    "activity_id", "execution_scope", "product_acknowledged", "jurisdiction_code",
    "jurisdiction_acknowledged", "accessibility_preferences", "instruction_density"
  ]
};

export function validateAthleteOnboardingDraftInput(value: unknown): Readonly<{
  current_stage: AthleteOnboardingStage;
  fields: Fields;
}> {
  if (!record(value)) throw new AthleteOnboardingError("athlete_onboarding_draft_invalid", 422);
  for (const key of Object.keys(value)) {
    if (key !== "current_stage" && key !== "fields") fail(key, "This draft field is not supported.");
  }
  const currentStage = stage(value.current_stage);
  const validatedFields = fields(value.fields, true);
  for (const key of REQUIRED_BEFORE[currentStage]) {
    if (!Object.prototype.hasOwnProperty.call(validatedFields, key)) {
      fail(key, "Complete this earlier onboarding stage before continuing.");
    }
  }
  return Object.freeze({ current_stage: currentStage, fields: validatedFields });
}
export function validateAthleteOnboardingConfirmation(value: unknown): true {
  if (!record(value)) throw new AthleteOnboardingError("athlete_onboarding_confirmation_invalid", 422);
  for (const key of Object.keys(value)) {
    if (key !== "review_confirmed") fail(key, "This confirmation field is not supported.");
  }
  return trueValue(value.review_confirmed, "review_confirmed", "Confirm that you reviewed the declaration.");
}
export function validateCompleteAthleteDeclaration(value: unknown): Fields {
  return fields(value, false);
}

function iso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? text(value) : date.toISOString();
}
async function events(client: QueryClient, userId: string): Promise<StoredEvent[]> {
  const result = await client.query(
    `SELECT event_id, event_type, event_payload, occurred_at
     FROM product_account_events
     WHERE user_id = $1 AND event_type = ANY($2::text[])
     ORDER BY occurred_at ASC, event_id ASC`,
    [userId, [DRAFT_EVENT, DECLARATION_EVENT]]
  );
  return (result.rows ?? []).flatMap((row: any) => record(row?.event_payload) ? [{
    event_id: text(row.event_id), event_type: text(row.event_type),
    event_payload: row.event_payload as Json, occurred_at: iso(row.occurred_at)
  }] : []);
}
function declaration(payload: Json, status: "current" | "superseded"): Readonly<Json> {
  return Object.freeze({
    declaration_id: text(payload.declaration_id),
    declaration_version: Number(payload.declaration_version ?? 1),
    declaration_status: status,
    effective_at_iso8601: text(payload.effective_at_iso8601),
    supersedes_declaration_id: text(payload.supersedes_declaration_id) || null,
    fields: clone(payload.fields),
    product_acknowledgement_version: text(payload.product_acknowledgement_version),
    jurisdiction_acknowledgement_version: text(payload.jurisdiction_acknowledgement_version),
    declaration_schema_version: text(payload.declaration_schema_version),
    immutable: true,
    user_declared_factual_state: true
  });
}
function state(all: readonly StoredEvent[]): Readonly<Json> {
  const declarations = all.filter((entry) => entry.event_type === DECLARATION_EVENT)
    .map((entry) => entry.event_payload);
  const currentPayload = declarations.at(-1) ?? null;
  const declarationTime = currentPayload ? text(currentPayload.effective_at_iso8601) : "";
  const draftEvent = [...all].reverse().find((entry) =>
    entry.event_type === DRAFT_EVENT && (!declarationTime || entry.occurred_at > declarationTime)
  );
  const draft = draftEvent?.event_payload ?? null;
  const completed = Boolean(currentPayload);
  const history = declarations.slice(0, -1).reverse().map((entry) => declaration(entry, "superseded"));
  return Object.freeze({
    service_state: "available",
    onboarding_status: completed ? "completed" : "incomplete",
    completion_persisted: completed,
    current_stage: completed ? "completed" : text(draft?.current_stage) || "activity",
    saved_draft_state: Boolean(draft),
    saved_draft_at_iso8601: text(draft?.saved_at_iso8601) || null,
    draft: draft ? Object.freeze({
      draft_id: text(draft.draft_id), revision: Number(draft.revision ?? 1),
      current_stage: text(draft.current_stage), fields: clone(draft.fields)
    }) : null,
    current_effective_declaration: currentPayload ? declaration(currentPayload, "current") : null,
    historical_declarations: Object.freeze(history),
    historical_declaration_count: history.length,
    inference_boundary: Object.freeze({
      ability_inferred: false, safety_inferred: false,
      readiness_inferred: false, suitability_inferred: false
    })
  });
}

async function account(client: QueryClient, userId: string, lock = false): Promise<void> {
  const result = await client.query(
    `SELECT actor_type, account_state FROM product_accounts
     WHERE user_id = $1 ${lock ? "FOR UPDATE" : ""}`,
    [userId]
  );
  const row = result.rows?.[0];
  if (!row) throw new AthleteOnboardingError("athlete_onboarding_account_not_found", 404);
  if (row.actor_type !== "athlete") throw new AthleteOnboardingError("athlete_onboarding_athlete_required", 403);
  if (row.account_state !== "active") throw new AthleteOnboardingError("athlete_onboarding_service_unavailable", 423);
}
async function append(client: QueryClient, userId: string, eventType: string, payload: Json, at: string): Promise<void> {
  await client.query(
    `INSERT INTO product_account_events
      (event_id, user_id, event_type, event_payload, occurred_at)
     VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz)`,
    [id("account_event"), userId, eventType, JSON.stringify(payload), at]
  );
}
async function currentPhase1(client: QueryClient, userId: string): Promise<Json> {
  const result = await client.query(
    `SELECT record_payload -> 'engine_phase1_input' AS phase1_input
     FROM beta_product_records
     WHERE subject_user_id = $1 AND record_type = 'beta16_phase1_declaration'
     ORDER BY effective_at DESC, created_at DESC LIMIT 1`,
    [userId]
  );
  if (record(result.rows?.[0]?.phase1_input)) return clone(result.rows[0].phase1_input);
  return {
    consent_granted: true, engine_version: "EB2-1.0.0", enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0", actor_type: "athlete", execution_scope: "individual",
    activity_id: "powerlifting", nd_mode: false, instruction_density: "standard",
    exposure_prompt_density: "standard", bias_mode: "none"
  };
}
async function terms(client: QueryClient, userId: string): Promise<string> {
  const result = await client.query(
    "SELECT accepted_terms_version FROM product_accounts WHERE user_id = $1 LIMIT 1", [userId]
  );
  return text(result.rows?.[0]?.accepted_terms_version) || "terms_v1";
}
async function insertBeta(client: QueryClient, item: Json): Promise<void> {
  const acknowledgement = item.record_type === "beta16_acknowledgement";
  const recordId = text(acknowledgement ? item.acknowledgement_id : item.declaration_id);
  const userId = text(acknowledgement ? item.user_id : item.subject_user_id);
  const actorId = text(acknowledgement ? item.user_id : item.declared_by_user_id);
  const effectiveAt = text(acknowledgement ? item.accepted_at_iso8601 : item.declared_at_iso8601);
  if (!recordId || !userId || !actorId || !effectiveAt || !text(item.record_sha256)) {
    throw new AthleteOnboardingError("athlete_onboarding_beta_record_invalid", 500);
  }
  await client.query(
    `INSERT INTO beta_product_records
      (record_type, record_id, subject_user_id, actor_user_id, effective_at, record_sha256, record_payload)
     VALUES ($1, $2, $3, $4, $5::timestamptz, $6, $7::jsonb)
     ON CONFLICT (record_type, record_id, record_sha256) DO NOTHING`,
    [item.record_type, recordId, userId, actorId, effectiveAt, item.record_sha256, JSON.stringify(item)]
  );
}
async function effectiveBetaDeclaration(client: QueryClient, userId: string, declared: Fields, at: string): Promise<void> {
  const phase1 = await currentPhase1(client, userId);
  Object.assign(phase1, {
    consent_granted: true,
    actor_type: "athlete",
    // BETA-16 compile admission remains individual; product scope does not broaden engine law.
    execution_scope: "individual",
    activity_id: declared.activity_id,
    instruction_density: declared.instruction_density
  });
  const acknowledgement = createBeta16AcknowledgementRecord({
    acknowledgement_id: id("beta16_ack"), user_id: userId, beta_id: BETA_VERSION,
    accepted: true, jurisdiction_acknowledged: true, accepted_at_iso8601: at,
    copy_acknowledgement_id: "BETA16_COPY_ACKNOWLEDGEMENT_LABEL"
  });
  const declarationRecord = createBeta16Phase1DeclarationRecord({
    declaration_id: id("beta16_declaration"), user_id: userId, phase1_input: phase1,
    jurisdiction_acknowledged: true, declared_at_iso8601: at,
    accepted_terms_version: await terms(client, userId),
    copy_acknowledgement_id: "BETA16_COPY_DECLARATION_ACKNOWLEDGEMENT"
  });
  const ack = acknowledgement.body.acknowledgement_record;
  const declarationValue = declarationRecord.body.declaration_record;
  if (acknowledgement.status !== 201 || declarationRecord.status !== 201 ||
      !record(ack) || !record(declarationValue)) {
    throw new AthleteOnboardingError("athlete_onboarding_beta_record_invalid", 500);
  }
  await insertBeta(client, ack);
  await insertBeta(client, declarationValue);
}

export async function getAthleteOnboardingState(userId: string): Promise<Readonly<Json>> {
  const client = await pool.connect();
  try {
    await account(client, userId);
    return state(await events(client, userId));
  }
  finally { client.release(); }
}

export async function saveAthleteOnboardingDraft(userId: string, input: unknown): Promise<Readonly<Json>> {
  const valid = validateAthleteOnboardingDraftInput(input);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await account(client, userId, true);
    const existing = state(await events(client, userId));
    if (existing.onboarding_status === "completed") {
      throw new AthleteOnboardingError("athlete_onboarding_already_completed", 409);
    }
    const previous = record(existing.draft) ? existing.draft : null;
    const at = new Date().toISOString();
    const core = {
      draft_id: text(previous?.draft_id) || id("onboarding_draft"),
      revision: Number(previous?.revision ?? 0) + 1,
      current_stage: valid.current_stage, fields: clone(valid.fields),
      saved_at_iso8601: at, declaration_schema_version: SCHEMA_VERSION,
      immutable_event: true
    };
    await append(client, userId, DRAFT_EVENT, { ...core, record_sha256: hash(core) }, at);
    await client.query("COMMIT");
    return state(await events(client, userId));
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally { client.release(); }
}

export async function confirmAthleteOnboarding(userId: string, input: unknown): Promise<Readonly<Json>> {
  validateAthleteOnboardingConfirmation(input);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await account(client, userId, true);
    const existing = state(await events(client, userId));
    if (existing.onboarding_status === "completed") {
      await client.query("COMMIT");
      return existing;
    }
    const draft = record(existing.draft) ? existing.draft : null;
    if (!draft || !record(draft.fields)) {
      throw new AthleteOnboardingError("athlete_onboarding_draft_required", 409);
    }
    const declared = validateCompleteAthleteDeclaration(draft.fields);
    const at = new Date().toISOString();
    const core = {
      declaration_id: id("athlete_declaration"), declaration_version: 1,
      supersedes_declaration_id: null, effective_at_iso8601: at,
      fields: clone(declared), product_acknowledgement_version: BETA_VERSION,
      jurisdiction_acknowledgement_version: JURISDICTION_VERSION,
      declaration_schema_version: SCHEMA_VERSION,
      declaration_source: "athlete_confirmed_onboarding", immutable: true,
      user_declared_factual_state: true, engine_visible: false
    };
    await effectiveBetaDeclaration(client, userId, declared, at);
    await append(client, userId, DECLARATION_EVENT, { ...core, record_sha256: hash(core) }, at);
    await client.query("COMMIT");
    return state(await events(client, userId));
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally { client.release(); }
}

export async function updateAthleteOnboardingPreferences(userId: string, input: unknown): Promise<Readonly<Json>> {
  if (!record(input)) throw new AthleteOnboardingError("athlete_onboarding_preferences_invalid", 422);
  for (const key of Object.keys(input)) {
    if (key !== "accessibility_preferences" && key !== "instruction_density") {
      fail(key, "Only accessibility and instruction-density preferences are editable after confirmation.");
    }
  }
  const accessibility = validateAthleteAccessibilityPreferences(input.accessibility_preferences);
  const density = validateAthleteInstructionDensity(input.instruction_density);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await account(client, userId, true);
    const existing = state(await events(client, userId));
    const current = record(existing.current_effective_declaration)
      ? existing.current_effective_declaration : null;
    if (!current || !record(current.fields)) {
      throw new AthleteOnboardingError("athlete_onboarding_completion_required", 409);
    }
    const previous = validateCompleteAthleteDeclaration(current.fields);
    if (stable(previous.accessibility_preferences) === stable(accessibility) &&
        previous.instruction_density === density) {
      await client.query("COMMIT");
      return existing;
    }
    const declared = Object.freeze({
      ...previous, accessibility_preferences: accessibility, instruction_density: density
    });
    const at = new Date().toISOString();
    const core = {
      declaration_id: id("athlete_declaration"),
      declaration_version: Number(current.declaration_version ?? 1) + 1,
      supersedes_declaration_id: text(current.declaration_id),
      effective_at_iso8601: at, fields: clone(declared),
      product_acknowledgement_version: BETA_VERSION,
      jurisdiction_acknowledgement_version: JURISDICTION_VERSION,
      declaration_schema_version: SCHEMA_VERSION,
      declaration_source: "athlete_editable_preferences_updated", immutable: true,
      user_declared_factual_state: true, engine_visible: false
    };
    if (previous.instruction_density !== density) {
      await effectiveBetaDeclaration(client, userId, declared, at);
    }
    await append(client, userId, DECLARATION_EVENT, { ...core, record_sha256: hash(core) }, at);
    await client.query("COMMIT");
    return state(await events(client, userId));
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally { client.release(); }
}
