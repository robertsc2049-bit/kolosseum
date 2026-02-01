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

function pickStringArray(xs: unknown): string[] | undefined {
  if (!Array.isArray(xs)) return undefined;
  const out: string[] = [];
  for (const v of xs) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (s.length > 0) out.push(s);
  }
  const uniq = Array.from(new Set(out));
  return uniq.length > 0 ? uniq : undefined;
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
      details: "PHASE_1: constraints envelope present but not an object",
    };
  }

  const keys = Object.keys(c);
  const refused = keys.filter((k) => k.endsWith("_ids"));
  if (refused.length > 0) {
    refused.sort((a, b) => a.localeCompare(b));
    return {
      ok: false,
      failure_token: "legacy_constraints_keys_refused",
      details: {
        refused,
        rule: "Keys ending with _ids are not permitted",
        canonical_keys: ["constraints_version", "avoid_joint_stress_tags", "banned_equipment", "available_equipment"],
      },
    };
  }

  if ((c as any).constraints_version !== "1.0.0") {
    return {
      ok: false,
      failure_token: "constraints_version_invalid_or_missing",
      details: {
        received: (c as any).constraints_version,
        required: "1.0.0",
      },
    };
  }

  return null;
}

function canonicalizeConstraints(raw: any): Phase1Constraints {
  const out: Phase1Constraints = { constraints_version: "1.0.0" };

  const avoid = pickStringArray(raw.avoid_joint_stress_tags);
  const banned = pickStringArray(raw.banned_equipment);
  const avail = pickStringArray(raw.available_equipment);

  if (avoid) out.avoid_joint_stress_tags = avoid;
  if (banned) out.banned_equipment = banned;
  if (avail) out.available_equipment = avail;

  return out;
}

/**
 * AJV error classifier:
 * - additionalProperties => unknown_field
 * - everything else => type_mismatch
 *
 * We keep details deterministic by extracting only stable fields and sorting.
 */
function classifyAjvErrors(errors: any[] | null | undefined): Phase1Result {
  const errs = Array.isArray(errors) ? errors : [];

  const unknowns: { instancePath: string; additionalProperty: string }[] = [];
  for (const e of errs) {
    if (e && typeof e === "object" && e.keyword === "additionalProperties") {
      const instancePath = typeof e.instancePath === "string" ? e.instancePath : "";
      const ap =
        e.params && typeof e.params === "object" && typeof e.params.additionalProperty === "string"
          ? e.params.additionalProperty
          : "";
      if (ap) unknowns.push({ instancePath, additionalProperty: ap });
    }
  }

  if (unknowns.length > 0) {
    unknowns.sort((a, b) => {
      const pa = `${a.instancePath}::${a.additionalProperty}`;
      const pb = `${b.instancePath}::${b.additionalProperty}`;
      return pa.localeCompare(pb);
    });

    return {
      ok: false,
      failure_token: "unknown_field",
      details: {
        unknown_fields: unknowns,
        ajv_errors: errs,
      },
    };
  }

  return { ok: false, failure_token: "type_mismatch", details: errs };
}

export function phase1Validate(input: unknown): Phase1Result {
  const schemaTextRaw = fs.readFileSync("ci/schemas/phase1.input.schema.v1.0.0.json", "utf8");
  const schemaText = stripBom(schemaTextRaw);
  const schema = JSON.parse(schemaText);

  const ajv = new Ajv({
    allErrors: true,
    strict: true,
    strictRequired: false,
  });

  if (isRecord(input)) {
    const refusal = preflightConstraintsRefusal(input);
    if (refusal) return refusal;
  }

  const validate = ajv.compile(schema);
  const ok = validate(input);

  if (!ok) {
    return classifyAjvErrors(validate.errors as any);
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
    bias_mode: obj.bias_mode,
  };

  const envelopePresent = Object.prototype.hasOwnProperty.call(obj ?? {}, "constraints");
  if (envelopePresent) {
    canonical.constraints = canonicalizeConstraints(obj.constraints);
  }

  return { ok: true, canonical_input: canonical };
}
