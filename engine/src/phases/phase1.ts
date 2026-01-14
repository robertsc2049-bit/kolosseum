import Ajv from "ajv";
import fs from "node:fs";

export type Phase1Constraints = {
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

  // IMPORTANT: preserve presence semantics.
  // - If caller provided constraints: {}, canonical retains constraints: {}.
  // - If caller omitted constraints entirely, canonical omits constraints.
  constraints?: Phase1Constraints;
};

export type Phase1Result =
  | { ok: true; canonical_input: Phase1CanonicalInput }
  | { ok: false; failure_token: string; details?: unknown };

function stripBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function pickStringArray(xs: any): string[] | undefined {
  if (!Array.isArray(xs)) return undefined;
  const out = xs.filter((v: any) => typeof v === "string" && v.length > 0);
  const uniq = Array.from(new Set(out));
  return uniq.length > 0 ? uniq : undefined;
}

function canonicalizeConstraints(raw: any, envelopePresent: boolean): Phase1Constraints | undefined {
  if (!envelopePresent) return undefined; // truly absent
  if (!raw || typeof raw !== "object") return {}; // present but weird => canonical empty

  const c: Phase1Constraints = {};
  const avoid = pickStringArray(raw.avoid_joint_stress_tags);
  const banned = pickStringArray(raw.banned_equipment);
  const avail = pickStringArray(raw.available_equipment);

  if (avoid) c.avoid_joint_stress_tags = avoid;
  if (banned) c.banned_equipment = banned;
  if (avail) c.available_equipment = avail;

  // envelope present is semantically meaningful, so return {} even if empty
  return c;
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

  const validate = ajv.compile(schema);

  const ok = validate(input);
  if (!ok) {
    return { ok: false, failure_token: "type_mismatch", details: validate.errors };
  }

  const obj = input as any;
  if (obj?.consent_granted !== true) {
    return { ok: false, failure_token: "consent_not_granted" };
  }

  const envelopePresent = Object.prototype.hasOwnProperty.call(obj ?? {}, "constraints");

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

  if (envelopePresent) {
    canonical.constraints = canonicalizeConstraints(obj.constraints, true);
  }

  return { ok: true, canonical_input: canonical };
}


