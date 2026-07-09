// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

import crypto from "node:crypto";

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function fail(reason: string, details?: unknown): never {
  const error = new Error(reason);
  (error as any).reason = reason;
  (error as any).details = details;
  throw error;
}

function utf8BytesFrom(input: unknown): Uint8Array | null {
  if (input instanceof Uint8Array) return new Uint8Array(input);
  if (typeof input === "string") return new TextEncoder().encode(input);
  return null;
}

function parseCanonicalJsonBytes(bytes: Uint8Array): unknown {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    fail("phase2-utf8-decode-failed", String(error));
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    fail("phase2-json-parse-failed", String(error));
  }
}

/**
 * BETA-09 deterministic canonical JSON path.
 * Boundary:
 * - UTF-8 bytes only when bytes/string are supplied.
 * - Objects are deeply sorted by lexicographic key order.
 * - JSON.stringify emits no insignificant whitespace.
 * - JSON.parse rejects trailing commas and comments for byte/string input.
 * - Undefined/function/symbol/bigint/non-finite number values fail instead of being dropped or coerced.
 * - Null is preserved exactly.
 * - Arrays preserve declared order.
 */
function canonicalise(value: unknown, path: string[] = []): unknown {
  if (value === null) return null;

  if (Array.isArray(value)) {
    return value.map((item, index) => canonicalise(item, [...path, String(index)]));
  }

  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = canonicalise(value[key], [...path, key]);
    }
    return out;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail("phase2-non-finite-number-refused", { path: path.join(".") });
    }
    return value;
  }

  if (["string", "boolean"].includes(typeof value)) return value;

  fail("phase2-unsupported-value-refused", {
    path: path.join("."),
    value_type: typeof value
  });
}

function canonicalJsonBytesFromInput(input: unknown): Uint8Array {
  const providedBytes = utf8BytesFrom(input);
  const parsedInput = providedBytes ? parseCanonicalJsonBytes(providedBytes) : input;
  const canonical = canonicalise(parsedInput);
  const json = JSON.stringify(canonical);
  return new TextEncoder().encode(json);
}

function hashCanonicalInputBytes(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export type Phase2Canonical = {
  // Stable string (sorted keys, no insignificant whitespace). This is the authoritative canonical JSON.
  phase2_canonical_json: string;

  // Lowercase SHA256 over UTF-8 bytes of canonical_input_json only.
  phase2_hash: string;

  // Legacy/extractor compatibility: canonical JSON bytes. This is the exact hash scope.
  canonical_input_json: Uint8Array;

  // Legacy/extractor compatibility: hash alias.
  canonical_input_hash: string;

  // BETA-09 hash-scope metadata for replay and downstream mismatch detection.
  hash_scope: "canonical_input_json";
  hash_algorithm: "sha256";
  hash_encoding: "lowercase_hex";
  canonical_json_encoding: "utf8";
};

export type Phase2Result =
  | { ok: true; phase2: Phase2Canonical; notes: string[] }
  | { ok: false; failure_token: string; details?: unknown };

/**
 * Phase 2 contract:
 * - Canonicalise by sorting object keys deeply in lexicographic order.
 * - Preserve every legal explicit value, including null.
 * - Do not drop empty objects/arrays, default missing fields, remove fields, or coerce values.
 * - Reject unsupported values that JSON.stringify would otherwise drop or coerce.
 * - MUST expose canonical JSON via:
 *    - phase2.phase2_canonical_json (string)
 *    - phase2.canonical_input_json (UTF-8 bytes)
 *   so downstream extractors cannot accidentally ignore fields.
 * - Hash scope is exactly phase2.canonical_input_json bytes and nothing downstream.
 */
export function phase2CanonicaliseAndHash(input: unknown): Phase2Result {
  try {
    const bytes = canonicalJsonBytesFromInput(input);
    const json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const hash = hashCanonicalInputBytes(bytes);

    return {
      ok: true,
      phase2: {
        phase2_canonical_json: json,
        phase2_hash: hash,
        canonical_input_json: bytes,
        canonical_input_hash: hash,
        hash_scope: "canonical_input_json",
        hash_algorithm: "sha256",
        hash_encoding: "lowercase_hex",
        canonical_json_encoding: "utf8"
      },
      notes: ["PHASE_2: canonicalised + hashed (BETA-09 exact canonical_input_json byte scope)"]
    };
  } catch (err: any) {
    return {
      ok: false,
      failure_token: "phase2_canonicalise_failed",
      details: {
        reason: String(err?.reason ?? err?.message ?? err),
        details: err?.details
      }
    };
  }
}
