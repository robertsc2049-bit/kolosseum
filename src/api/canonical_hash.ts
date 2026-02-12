export type CanonicalHashSelectInput = {
  requested?: string;
  phase2_hash: string;
  allow_override: boolean;
  expected_token?: string;
  provided_token?: string;
};

export type CanonicalHashSelectResult = {
  canonical_hash: string;
  used_override: boolean;
};

function asNonEmptyString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

/**
 * selectCanonicalHash
 *
 * Security + determinism:
 * - By default, canonical_hash MUST be the Phase2 hash.
 * - A caller-supplied canonical_hash is ignored unless:
 *    - allow_override === true
 *    - expected_token is set (non-empty)
 *    - provided_token matches expected_token
 *    - requested is a non-empty string
 */
export function selectCanonicalHash(input: CanonicalHashSelectInput): CanonicalHashSelectResult {
  const phase2 = asNonEmptyString(input.phase2_hash);
  if (!phase2) {
    throw new Error("selectCanonicalHash: phase2_hash missing/empty");
  }

  const requested = asNonEmptyString(input.requested);
  if (!requested) return { canonical_hash: phase2, used_override: false };

  if (input.allow_override !== true) return { canonical_hash: phase2, used_override: false };

  const expected = asNonEmptyString(input.expected_token);
  const provided = asNonEmptyString(input.provided_token);

  if (!expected || !provided) return { canonical_hash: phase2, used_override: false };
  if (provided !== expected) return { canonical_hash: phase2, used_override: false };

  return { canonical_hash: requested, used_override: true };
}