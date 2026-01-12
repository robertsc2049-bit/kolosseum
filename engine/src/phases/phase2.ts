import crypto from "node:crypto";

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort((a, b) => a.localeCompare(b))) {
      out[key] = sortKeysDeep(obj[key]);
    }
    return out;
  }
  return value;
}

export type Phase2Canonical = {
  phase2_canonical_json: string; // stable string (sorted keys)
  phase2_hash: string;           // sha256 over UTF-8 bytes of canonical JSON
};

export type Phase2Result =
  | { ok: true; phase2: Phase2Canonical; notes: string[] }
  | { ok: false; failure_token: string; details?: unknown };

export function phase2CanonicaliseAndHash(input: unknown): Phase2Result {
  try {
    const sorted = sortKeysDeep(input);
    const json = JSON.stringify(sorted);
    const hash = crypto.createHash("sha256").update(Buffer.from(json, "utf8")).digest("hex");

    return {
      ok: true,
      phase2: {
        phase2_canonical_json: json,
        phase2_hash: hash
      },
      notes: ["PHASE_2: canonicalised + hashed (sorted keys)"]
    };
  } catch (err) {
    return {
      ok: false,
      failure_token: "phase2_canonicalise_failed",
      details: String(err)
    };
  }
}
