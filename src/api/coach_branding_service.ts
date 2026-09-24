// DEV NOTE: FULL-UI-65 - coach branding preference. A brand preference is
// self-declared by the coach only - there is no athlete or other-coach
// write path anywhere in this file. One preference exists per coach,
// superseded (never UPDATEd/DELETEd) by a new row on save - the newest
// row for a coach always wins on read, mirroring athlete_goal's own
// archival pattern. This is a wholly separate, additive record type -
// it does not touch any existing coach-identity record shape used
// throughout the test suite.

import crypto from "node:crypto";

import {
  loadLatestBetaProductRecord,
  persistBetaProductRecord
} from "./beta_product_record_store.js";
import { normaliseCoachBrandPreference } from "../../shared/coach-branding/coachBrandingLifecycle.mjs";

type JsonRecord = Record<string, unknown>;

export class CoachBrandingError extends Error {
  readonly status: number;

  constructor(reason: string, status = 400) {
    super(`coach_branding_${reason}`);
    this.name = "CoachBrandingError";
    this.status = status;
  }
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

type CoachBrandPreferenceInput = {
  brand_color?: unknown;
  brand_tagline?: unknown;
};

export async function saveCoachBrandPreference(
  coachUserId: string,
  input: CoachBrandPreferenceInput
): Promise<Readonly<JsonRecord>> {
  const coach = cleanString(coachUserId);
  if (!coach) {
    throw new CoachBrandingError("coach_identity_required");
  }

  let normalised;
  try {
    normalised = normaliseCoachBrandPreference(input);
  }
  catch (error) {
    throw new CoachBrandingError((error as { code?: string }).code ?? "preference_invalid");
  }

  const recordWithoutHash = {
    record_type: "coach_brand_preference" as const,
    contract_version: "full_ui_65.1.0.0",
    coach_user_id: coach,
    brand_color: normalised.brand_color,
    brand_tagline: normalised.brand_tagline,
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

export async function loadCoachBrandPreference(
  coachUserIdInput: string
): Promise<Readonly<JsonRecord> | null> {
  const coachUserId = cleanString(coachUserIdInput);
  if (!coachUserId) {
    throw new CoachBrandingError("coach_identity_required");
  }
  return loadLatestBetaProductRecord("coach_brand_preference", coachUserId, coachUserId);
}
