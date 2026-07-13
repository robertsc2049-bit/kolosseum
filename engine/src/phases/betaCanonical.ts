// DEV NOTE: Shared beta canonical JSON and SHA-256 materialisation. This module is deterministic, closed-world, and free of registry, product, runtime, and coach-note input.

import { createHash } from "node:crypto";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function ordinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("non_finite_number");
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalValue(item));
  }

  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const output: Record<string, JsonValue> = {};

    for (const key of Object.keys(source).sort(ordinal)) {
      if (source[key] === undefined) {
        throw new Error("undefined_value");
      }
      output[key] = canonicalValue(source[key]);
    }

    return output;
  }

  throw new Error("unsupported_canonical_value");
}

export function betaCanonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function betaCanonicalHash(value: unknown): string {
  return createHash("sha256")
    .update(betaCanonicalJson(value), "utf8")
    .digest("hex");
}
