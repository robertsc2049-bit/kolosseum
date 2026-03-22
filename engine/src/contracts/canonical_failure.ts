export const CANONICAL_FAILURE_TOKENS = [
  "consent_not_granted",
  "constraints_type_invalid",
  "constraints_version_invalid_or_missing",
  "legacy_constraints_keys_refused",
  "phase1_failed_non_object",
  "phase2_canonical_parse_failed",
  "phase2_canonicalise_failed",
  "phase2_failed_non_object",
  "phase3_failed_non_object",
  "phase4_failed_non_object",
  "phase5_failed_non_object",
  "phase6_requires_planned_items",
  "plate_only_mixed_with_other_tokens",
  "type_mismatch"
] as const;

export type CanonicalFailureToken = (typeof CANONICAL_FAILURE_TOKENS)[number];

export type CanonicalFailureEnvelope = {
  ok: false;
  failure_token: CanonicalFailureToken;
  details?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

const CANONICAL_FAILURE_TOKEN_SET = new Set<string>(CANONICAL_FAILURE_TOKENS);

export function isCanonicalFailureToken(value: unknown): value is CanonicalFailureToken {
  return typeof value === "string" && CANONICAL_FAILURE_TOKEN_SET.has(value);
}

export function canonicalFailure(
  failure_token: CanonicalFailureToken,
  details?: unknown
): CanonicalFailureEnvelope {
  if (details === undefined) {
    return { ok: false, failure_token };
  }

  return { ok: false, failure_token, details };
}

export function assertCanonicalSuccessEnvelope(
  result: unknown,
  label = "success result"
): asserts result is Record<string, unknown> & { ok: true } {
  if (!isRecord(result)) {
    throw new Error(`${label} must be an object`);
  }

  if (result.ok !== true) {
    throw new Error(`${label} must have ok === true`);
  }

  if (hasOwn(result, "failure_token")) {
    throw new Error(`${label} must not carry failure_token`);
  }
}

export function assertCanonicalFailureEnvelope(
  result: unknown,
  label = "failure result"
): asserts result is CanonicalFailureEnvelope {
  if (!isRecord(result)) {
    throw new Error(`${label} must be an object`);
  }

  if (result.ok !== false) {
    throw new Error(`${label} must have ok === false`);
  }

  if (!hasOwn(result, "failure_token")) {
    throw new Error(`${label} must include failure_token`);
  }

  const token = result.failure_token;
  if (typeof token !== "string" || token.trim().length === 0) {
    throw new Error(`${label} must include a non-empty failure_token`);
  }

  if (!isCanonicalFailureToken(token)) {
    throw new Error(`${label} emitted unknown canonical failure_token=${token}`);
  }

  const allowedKeys = new Set(["ok", "failure_token", "details"]);
  const extraKeys = Object.keys(result).filter((key) => !allowedKeys.has(key));
  if (extraKeys.length > 0) {
    extraKeys.sort((a, b) => a.localeCompare(b));
    throw new Error(`${label} must not mix failure envelope with extra keys: ${extraKeys.join(", ")}`);
  }
}

export function coerceCanonicalFailureEnvelope(
  result: unknown,
  fallbackToken: CanonicalFailureToken,
  label = "phase failure"
): CanonicalFailureEnvelope {
  if (!isRecord(result)) {
    return canonicalFailure(fallbackToken);
  }

  if (result.ok === true) {
    if (hasOwn(result, "failure_token")) {
      throw new Error(`${label} returned mixed success/failure envelope`);
    }

    throw new Error(`${label} returned success envelope where failure was expected`);
  }

  if (result.ok !== false) {
    return canonicalFailure(fallbackToken);
  }

  assertCanonicalFailureEnvelope(result, label);

  if (hasOwn(result, "details")) {
    return canonicalFailure(result.failure_token, result.details);
  }

  return canonicalFailure(result.failure_token);
}
