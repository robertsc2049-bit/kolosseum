// DEV NOTE: FULL-UI-67/68 - programme template marketplace visibility and
// release. A coach declares one of their own complete/active templates
// publicly browsable by every other coach, with an optional price label
// and payment-methods note - plain display text only, since this
// application never processes, holds, or transmits any payment. Once a
// buying coach has paid the selling coach through whatever means they
// arrange off-platform, the selling coach releases the template to the
// buyer's own account code, which clones the full template into the
// buyer's own independent library - a one-time grant, not an ongoing
// licence. Both the sharing preference and the release event are wholly
// separate, additive record types - neither touches
// beta18_programme_template's own field contract, and ownership/status
// are re-verified against the live template on every save, release and
// browse read, never trusted from a stale sharing record.

import { pool } from "../db/pool.js";
import {
  loadLatestBetaProductRecord,
  persistBetaProductRecord
} from "./beta_product_record_store.js";
import {
  listCoachProgrammeTemplates,
  requireActiveCoach,
  saveCoachProgrammeTemplate,
  templateRecordInput
} from "./beta18_programme_template_service.js";
import { normaliseProgrammeTemplateSharingPreference } from "../../shared/programme-marketplace/programmeTemplateSharingLifecycle.mjs";
import crypto from "node:crypto";

type JsonRecord = Record<string, unknown>;

const SHAREABLE_TEMPLATE_STATUSES = new Set(["complete", "active"]);

export class ProgrammeTemplateSharingError extends Error {
  readonly status: number;

  constructor(reason: string, status = 400) {
    super(`programme_template_sharing_${reason}`);
    this.name = "ProgrammeTemplateSharingError";
    this.status = status;
  }
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        deepFreeze(child);
      }
    }
  }
  return value;
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (isRecord(value)) {
    const output: JsonRecord = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = canonicalise(value[key]);
    }
    return output;
  }
  return value;
}

function sha256(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalise(value)), "utf8")
    .digest("hex");
}

async function requireOwnedShareableTemplate(
  coachUserId: string,
  templateId: string
): Promise<Readonly<JsonRecord>> {
  const templates = await listCoachProgrammeTemplates(coachUserId);
  const template = templates.find((entry) => cleanString(entry.template_id) === templateId);

  if (!template) {
    throw new ProgrammeTemplateSharingError("template_not_found", 404);
  }
  if (!SHAREABLE_TEMPLATE_STATUSES.has(String(template.template_status))) {
    throw new ProgrammeTemplateSharingError("template_not_in_shareable_state", 400);
  }

  return template;
}

export async function saveProgrammeTemplateSharingPreference(
  coachUserIdInput: string,
  templateIdInput: string,
  input: { shared_publicly?: unknown; price_label?: unknown; payment_methods_note?: unknown }
): Promise<Readonly<JsonRecord>> {
  const coachUserId = cleanString(coachUserIdInput);
  const templateId = cleanString(templateIdInput);
  if (!coachUserId || !templateId) {
    throw new ProgrammeTemplateSharingError("identity_required");
  }

  await requireOwnedShareableTemplate(coachUserId, templateId);

  let normalised;
  try {
    normalised = normaliseProgrammeTemplateSharingPreference(input);
  }
  catch (error) {
    throw new ProgrammeTemplateSharingError((error as { code?: string }).code ?? "preference_invalid");
  }

  const recordWithoutHash = {
    record_type: "programme_template_sharing_preference" as const,
    contract_version: "full_ui_68.1.0.0",
    template_id: templateId,
    coach_user_id: coachUserId,
    shared_publicly: normalised.shared_publicly,
    price_label: normalised.price_label,
    payment_methods_note: normalised.payment_methods_note,
    updated_at_iso8601: new Date().toISOString(),
    factual_user_supplied_state: true as const,
    immutable_reference_history: true as const,
    inference_applied: false as const,
    readiness_semantics: false as const,
    safety_semantics: false as const,
    suitability_semantics: false as const,
    recommendation_semantics: false as const,
    engine_visible: false as const,
    compile_reference_visible: false as const
  };

  const record = deepFreeze({
    ...recordWithoutHash,
    record_sha256: sha256(recordWithoutHash)
  });

  return persistBetaProductRecord(record);
}

export async function loadProgrammeTemplateSharingPreference(
  coachUserIdInput: string,
  templateIdInput: string
): Promise<Readonly<JsonRecord> | null> {
  const coachUserId = cleanString(coachUserIdInput);
  const templateId = cleanString(templateIdInput);
  if (!coachUserId || !templateId) {
    throw new ProgrammeTemplateSharingError("identity_required");
  }

  const result = await pool.query(
    `
    SELECT record_payload
    FROM beta_product_records
    WHERE
      subject_user_id = $1
      AND record_type = 'programme_template_sharing_preference'
      AND record_payload->>'template_id' = $2
    ORDER BY effective_at DESC, created_at DESC, record_sha256 DESC
    LIMIT 1
    `,
    [coachUserId, templateId]
  );

  const payload = result.rows?.[0]?.record_payload;
  return isRecord(payload) ? Object.freeze(payload) : null;
}

export async function listMarketplaceSharedTemplates(): Promise<readonly Readonly<JsonRecord>[]> {
  const prefResult = await pool.query(
    `
    SELECT DISTINCT ON (record_id) record_payload
    FROM beta_product_records
    WHERE record_type = 'programme_template_sharing_preference'
    ORDER BY record_id, effective_at DESC, created_at DESC, record_sha256 DESC
    `
  );

  const sharedPrefs = prefResult.rows
    .map((row: JsonRecord) => row.record_payload)
    .filter(isRecord)
    .filter((preference) => preference.shared_publicly === true);

  const coachUserIds = [...new Set(sharedPrefs.map((preference) => cleanString(preference.coach_user_id)))];
  const templatesByCoach = new Map<string, readonly Readonly<JsonRecord>[]>();
  // Promise.allSettled, not Promise.all: listCoachProgrammeTemplates rejects
  // via requireActiveCoach the moment a sharing coach's own account is no
  // longer active (suspended/closed) - a normal account lifecycle event,
  // not a marketplace-browse error. One inactive seller among many must
  // never take the whole browse listing down for every other coach; their
  // templates are simply left out of templatesByCoach, so the ?? [] below
  // quietly excludes that seller's entries instead of throwing.
  const templateResults = await Promise.allSettled(
    coachUserIds.map((coachUserId) => listCoachProgrammeTemplates(coachUserId))
  );
  coachUserIds.forEach((coachUserId, index) => {
    const result = templateResults[index];
    if (result.status === "fulfilled") {
      templatesByCoach.set(coachUserId, result.value);
    }
  });

  const entries: JsonRecord[] = [];
  for (const preference of sharedPrefs) {
    const coachUserId = cleanString(preference.coach_user_id);
    const templateId = cleanString(preference.template_id);
    const templates = templatesByCoach.get(coachUserId) ?? [];
    const template = templates.find((entry) => cleanString(entry.template_id) === templateId);

    if (!template) continue;
    if (!SHAREABLE_TEMPLATE_STATUSES.has(String(template.template_status))) continue;

    const [coachProfile, brandPreference] = await Promise.all([
      loadLatestBetaProductRecord("beta17_coach_profile", coachUserId, coachUserId),
      loadLatestBetaProductRecord("coach_brand_preference", coachUserId, coachUserId)
    ]);

    entries.push({
      template_id: templateId,
      template_name: cleanString(template.template_name),
      description: cleanString(template.description) || null,
      activity_id: cleanString(template.activity_id),
      template_status: String(template.template_status),
      updated_at_iso8601: cleanString(template.updated_at_iso8601),
      price_label: cleanString(preference.price_label) || null,
      payment_methods_note: cleanString(preference.payment_methods_note) || null,
      coach_user_id: coachUserId,
      coach_display_name: cleanString(coachProfile?.display_name) || coachUserId,
      coach_brand_color: cleanString(brandPreference?.brand_color) || null,
      coach_brand_tagline: cleanString(brandPreference?.brand_tagline) || null
    });
  }

  entries.sort((left, right) =>
    String(right.updated_at_iso8601).localeCompare(String(left.updated_at_iso8601))
  );

  return deepFreeze(entries);
}

export async function releaseProgrammeTemplateToCoach(
  sellerCoachUserIdInput: string,
  templateIdInput: string,
  buyerAccountCodeInput: unknown
): Promise<Readonly<JsonRecord>> {
  const sellerCoachUserId = cleanString(sellerCoachUserIdInput);
  const templateId = cleanString(templateIdInput);
  const buyerCoachUserId = cleanString(buyerAccountCodeInput);

  if (!sellerCoachUserId || !templateId) {
    throw new ProgrammeTemplateSharingError("identity_required");
  }
  if (!buyerCoachUserId) {
    throw new ProgrammeTemplateSharingError("buyer_account_code_required");
  }
  if (buyerCoachUserId === sellerCoachUserId) {
    throw new ProgrammeTemplateSharingError("buyer_cannot_be_seller");
  }

  const template = await requireOwnedShareableTemplate(sellerCoachUserId, templateId);

  try {
    await requireActiveCoach(buyerCoachUserId);
  }
  catch {
    throw new ProgrammeTemplateSharingError("buyer_account_code_invalid", 404);
  }

  const sharingPreference = await loadProgrammeTemplateSharingPreference(sellerCoachUserId, templateId);

  const cloneInput = templateRecordInput(template as JsonRecord);
  cloneInput.coach_user_id = buyerCoachUserId;
  cloneInput.template_id = "";
  cloneInput.template_family_id = "";
  cloneInput.template_version = 1;
  cloneInput.event_plan = null;

  const clonedTemplate = await saveCoachProgrammeTemplate(cloneInput);
  const clonedTemplateId = cleanString(clonedTemplate.template_id);

  const recordWithoutHash = {
    record_type: "programme_template_release" as const,
    contract_version: "full_ui_68.1.0.0",
    release_id: randomId("template_release"),
    template_id: templateId,
    seller_coach_user_id: sellerCoachUserId,
    buyer_coach_user_id: buyerCoachUserId,
    cloned_template_id: clonedTemplateId,
    price_label: cleanString(sharingPreference?.price_label) || null,
    payment_methods_note: cleanString(sharingPreference?.payment_methods_note) || null,
    released_at_iso8601: new Date().toISOString(),
    factual_user_supplied_state: true as const,
    immutable_reference_history: true as const,
    inference_applied: false as const,
    readiness_semantics: false as const,
    safety_semantics: false as const,
    suitability_semantics: false as const,
    recommendation_semantics: false as const,
    engine_visible: false as const,
    compile_reference_visible: false as const
  };

  const record = deepFreeze({
    ...recordWithoutHash,
    record_sha256: sha256(recordWithoutHash)
  });

  await persistBetaProductRecord(record);

  return Object.freeze({
    cloned_template_id: clonedTemplateId,
    release: record
  });
}

export async function listProgrammeTemplateReleases(
  sellerCoachUserIdInput: string,
  templateIdInput: string
): Promise<readonly Readonly<JsonRecord>[]> {
  const sellerCoachUserId = cleanString(sellerCoachUserIdInput);
  const templateId = cleanString(templateIdInput);
  if (!sellerCoachUserId || !templateId) {
    throw new ProgrammeTemplateSharingError("identity_required");
  }

  const result = await pool.query(
    `
    SELECT DISTINCT ON (record_id) record_payload
    FROM beta_product_records
    WHERE
      record_type = 'programme_template_release'
      AND actor_user_id = $1
      AND record_payload->>'template_id' = $2
    ORDER BY record_id, effective_at DESC, created_at DESC, record_sha256 DESC
    `,
    [sellerCoachUserId, templateId]
  );

  const releases = result.rows
    .map((row: JsonRecord) => row.record_payload)
    .filter(isRecord);

  releases.sort((left, right) =>
    String(right.released_at_iso8601).localeCompare(String(left.released_at_iso8601))
  );

  return deepFreeze(releases);
}
