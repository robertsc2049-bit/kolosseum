import Ajv from "ajv";
import fs from "node:fs";

export type Phase1Result =
  | { ok: true; canonical_input: unknown }
  | { ok: false; failure_token: string; details?: unknown };

function stripBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
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

  return { ok: true, canonical_input: input };
}
