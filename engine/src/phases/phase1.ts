import Ajv from "ajv";
import fs from "node:fs";

export type Phase1Constraints = {
  avoid_joint_stress_tags?: string[];
  banned_equipment_ids?: string[];
  available_equipment_ids?: string[];
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

function canonicalizeConstraints(v: any): Phase1Constraints | undefined {
  if (!v || typeof v !== "object") return undefined;

  const c: Phase1Constraints = {};
  if (Array.isArray(v.avoid_joint_stress_tags)) c.avoid_joint_stress_tags = v.avoid_joint_stress_tags;
  if (Array.isArray(v.banned_equipment_ids)) c.banned_equipment_ids = v.banned_equipment_ids;
  if (Array.isArray(v.available_equipment_ids)) c.available_equipment_ids = v.available_equipment_ids;

  // If constraints was present but none of the known keys were present, treat as undefined.
  // The JSON schema already prevents empty objects, this is just defensive.
  return Object.keys(c).length > 0 ? c : undefined;
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

  // Closed-world canonical copy (explicit pick only)
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
    bias_mode: obj.bias_mode,

    constraints: canonicalizeConstraints(obj.constraints)
  };

  return { ok: true, canonical_input: canonical };
}
