import Ajv from "ajv";
import fs from "node:fs";

export type Phase1Constraints = {
  constraints_version: "1.0.0";
  avoid_joint_stress_tags?: string[];
  banned_equipment?: string[];
  available_equipment?: string[];
};

export type Phase1CanonicalInput = {
  consent_granted: true;
  engine_version: "EB2-1.0.0";
  enum_bundle_version: "EB2-1.0.0";
  phase1_schema_version: "1.0.0";

  actor_type: "athlete" | "coach" | "org_admin";
  execution_scope: "individual" | "coach_managed" | "org_managed";

  governing_authority_id?: string;

  activity_id: string;
  sport_role_id?: string;

  nd_mode: boolean;
  instruction_density: string;
  exposure_prompt_density: string;
  bias_mode: string;

  constraints?: Phase1Constraints;
};

export type Phase1Result =
  | { ok: true; canonical_input: Phase1CanonicalInput }
  | { ok: false; failure_token: string; details?: unknown };

function stripBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Pick a string list, tolerant to:
 * - array of strings (normal)
 * - single string (defensive; schema may disallow today)
 */
function pickStringArray(xs: unknown): string[] | undefined {
  const raw: unknown[] = Array.isArray(xs) ? xs : typeof xs === "string" ? [xs] : [];
  if (raw.length === 0) return undefined;

  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (s.length > 0) out.push(s);
  }

  if (out.length === 0) return undefined;

  // De-dupe, preserving first occurrence order
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const s of out) {
    if (seen.has(s)) continue;
    seen.add(s);
    uniq.push(s);
  }
  return uniq.length > 0 ? uniq : undefined;
}

const PLATE_ONLY_TOKENS = new Set([
  "plate-only",
  "plates-only",
  "plate_only",
  "plates_only",
  "plateonly",
  "platesonly"
]);

type EquipmentCanonOk = { ok: true; tokens?: string[] };
type EquipmentCanonFail = {
  ok: false;
  failure_token: "plate_only_mixed_with_other_tokens";
  details: {
    list: "available_equipment" | "banned_equipment";
    received: string[];
    rule: string;
  };
};

function canonicalizeEquipmentList(
  listName: "available_equipment" | "banned_equipment",
  xs: string[] | undefined
): EquipmentCanonOk | EquipmentCanonFail {
  if (!xs || xs.length === 0) return { ok: true, tokens: undefined };

  // normalize for matching; we emit canonical lower-case tokens
  const lowered = xs
    .map(s => String(s).trim().toLowerCase())
    .filter(s => s.length > 0);

  if (lowered.length === 0) return { ok: true, tokens: undefined };

  // De-dupe preserving first occurrence order
  const seen0 = new Set<string>();
  const uniq0: string[] = [];
  for (const t of lowered) {
    if (seen0.has(t)) continue;
    seen0.add(t);
    uniq0.push(t);
  }

  const hasPlateOnly = uniq0.some(t => PLATE_ONLY_TOKENS.has(t));
  const others = uniq0.filter(t => !PLATE_ONLY_TOKENS.has(t));

  // ILLEGAL: plate-only marker mixed with anything else (data loss footgun)
  if (hasPlateOnly && others.length > 0) {
    return {
      ok: false,
      failure_token: "plate_only_mixed_with_other_tokens",
      details: {
        list: listName,
        received: uniq0,
        rule: "plate-only markers must be used alone (no other equipment tokens in the same list)"
      }
    };
  }

  // LEGAL: plate-only used alone -> canonical token ["plate"]
  if (hasPlateOnly && others.length === 0) {
    return { ok: true, tokens: ["plate"] };
  }

  // Minimal canonicalization that helps upstream without scope creep.
  const mapped = others.map(t => (t === "plates" ? "plate" : t));

  // De-dupe preserving first occurrence order
  const seen1 = new Set<string>();
  const uniq1: string[] = [];
  for (const t of mapped) {
    if (seen1.has(t)) continue;
    seen1.add(t);
    uniq1.push(t);
  }

  return { ok: true, tokens: uniq1.length > 0 ? uniq1 : undefined };
}

/**
 * Ticket 018: refusal rules (before AJV), only when constraints envelope is present.
 * - constraints must be object
 * - constraints_version must be "1.0.0"
 * - any key ending with "_ids" is refused
 */
function preflightConstraintsRefusal(obj: any): Phase1Result | null {
  const envelopePresent = Object.prototype.hasOwnProperty.call(obj ?? {}, "constraints");
  if (!envelopePresent) return null;

  const c = obj?.constraints;

  if (!isRecord(c)) {
    return {
      ok: false,
      failure_token: "constraints_type_invalid",
      details: "PHASE_1: constraints envelope present but not an object"
    };
  }

  const keys = Object.keys(c);
  const refused = keys.filter(k => k.endsWith("_ids"));
  if (refused.length > 0) {
    refused.sort((a, b) => a.localeCompare(b));
    return {
      ok: false,
      failure_token: "legacy_constraints_keys_refused",
      details: {
        refused,
        rule: "Keys ending with _ids are not permitted",
        canonical_keys: ["constraints_version", "avoid_joint_stress_tags", "banned_equipment", "available_equipment"]
      }
    };
  }

  if ((c as any).constraints_version !== "1.0.0") {
    return {
      ok: false,
      failure_token: "constraints_version_invalid_or_missing",
      details: {
        received: (c as any).constraints_version,
        required: "1.0.0"
      }
    };
  }

  return null;
}

function canonicalizeConstraints(raw: any): { ok: true; constraints: Phase1Constraints } | { ok: false; failure_token: string; details?: unknown } {
  const out: Phase1Constraints = { constraints_version: "1.0.0" };

  const avoid = pickStringArray(raw.avoid_joint_stress_tags);

  // FIRST ACCEPT/PARSE BOUNDARY FOR EQUIPMENT TOKENS
  // Rule: plate-only markers must be alone; mixing is a hard failure.
  const bannedRaw = pickStringArray(raw.banned_equipment);
  const availRaw = pickStringArray(raw.available_equipment);

  const bannedCanon = canonicalizeEquipmentList("banned_equipment", bannedRaw);
  if (!bannedCanon.ok) return bannedCanon;

  const availCanon = canonicalizeEquipmentList("available_equipment", availRaw);
  if (!availCanon.ok) return availCanon;

  if (avoid) out.avoid_joint_stress_tags = avoid;
  if (bannedCanon.tokens) out.banned_equipment = bannedCanon.tokens;
  if (availCanon.tokens) out.available_equipment = availCanon.tokens;

  return { ok: true, constraints: out };
}

export function phase1Validate(input: unknown): Phase1Result {
  const schemaTextRaw = fs.readFileSync("ci/schemas/phase1.input.schema.v1.0.0.json", "utf8");
  const schemaText = stripBom(schemaTextRaw);
  const schema = JSON.parse(schemaText);

  const ajv = new Ajv({
    allErrors: true,
    strict: true,
    strictRequired: false
  });

  if (isRecord(input)) {
    const refusal = preflightConstraintsRefusal(input);
    if (refusal) return refusal;
  }

  const validate = ajv.compile(schema);
  const ok = validate(input);

  if (!ok) {
    return { ok: false, failure_token: "type_mismatch", details: validate.errors };
  }

  const obj = input as any;

  if (obj?.consent_granted !== true) {
    return { ok: false, failure_token: "consent_not_granted" };
  }

  const canonical: Phase1CanonicalInput = {
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",

    actor_type: obj.actor_type,
    execution_scope: obj.execution_scope,

    governing_authority_id: obj.governing_authority_id,

    activity_id: obj.activity_id,
    sport_role_id: obj.sport_role_id,

    nd_mode: obj.nd_mode,
    instruction_density: obj.instruction_density,
    exposure_prompt_density: obj.exposure_prompt_density,
    bias_mode: obj.bias_mode
  };

  const envelopePresent = Object.prototype.hasOwnProperty.call(obj ?? {}, "constraints");
  if (envelopePresent) {
    const c = canonicalizeConstraints(obj.constraints);
    if (!c.ok) return { ok: false, failure_token: c.failure_token, details: c.details };
    canonical.constraints = c.constraints;
  }

  return { ok: true, canonical_input: canonical };
}