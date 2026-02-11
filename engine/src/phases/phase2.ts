import crypto from "node:crypto";

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function hasOwn(obj: any, key: string): boolean {
  return isRecord(obj) && Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Deterministic deep key sort.
 * IMPORTANT: we do NOT prune empty objects/arrays.
 * If an object exists, it stays (including {}), because presence/absence is semantic (Ticket 010/011).
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);

  if (isRecord(value)) {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = sortKeysDeep(value[k]);
    return out;
  }

  return value;
}

export type Phase2Canonical = {
  // Stable string (sorted keys). This is the authoritative canonical JSON.
  phase2_canonical_json: string;

  // SHA256 over UTF-8 bytes of canonical JSON.
  phase2_hash: string;

  // Legacy/extractor compatibility: canonical JSON bytes.
  canonical_input_json: Uint8Array;

  // Legacy/extractor compatibility: hash alias.
  canonical_input_hash: string;
};

export type Phase2Result =
  | { ok: true; phase2: Phase2Canonical; notes: string[] }
  | { ok: false; failure_token: string; details?: unknown };

/**
 * Phase 2 contract:
 * - Canonicalise by sorting keys deeply (deterministic).
 * - Do NOT drop empty objects/arrays.
 * - MUST expose canonical JSON via:
 *    - phase2.phase2_canonical_json (string)
 *    - phase2.canonical_input_json (bytes)
 *   so downstream extractors cannot accidentally ignore fields.
 */
export function phase2CanonicaliseAndHash(input: unknown): Phase2Result {
  try {
    // If caller provided an explicit constraints envelope (even empty {}),
    // it must remain present in canonical output.
    // We don't mutate input, but we guard against "undefined" getting introduced.
    if (isRecord(input) && hasOwn(input, "constraints") && input.constraints === undefined) {
      // constraints present-but-undefined is invalid for our semantics.
      // Canonicalise it as empty object to preserve "present" signal deterministically.
      (input as any).constraints = {};
    }

    const sorted = sortKeysDeep(input);
    const json = JSON.stringify(sorted);

    const bytes = new TextEncoder().encode(json);
    const hash = crypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");

    return {
      ok: true,
      phase2: {
        phase2_canonical_json: json,
        phase2_hash: hash,
        canonical_input_json: bytes,
        canonical_input_hash: hash
      },
      notes: ["PHASE_2: canonicalised + hashed (deep key sort; no pruning; bytes+string emitted)"]
    };
  } catch (err) {
    return {
      ok: false,
      failure_token: "phase2_canonicalise_failed",
      details: String(err)
    };
  }
}
