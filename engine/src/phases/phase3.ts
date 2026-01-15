import { loadRegistries } from "../registries/loadRegistries.js";
import type { Phase3Constraints } from "./phase3.constraints.js";

export type { Phase3Constraints } from "./phase3.constraints.js";

export type Phase3Output = {
  constraints_resolved: boolean;
  notes: string[];
  registry_index_version: string;
  loaded_registries: string[];

  /**
   * Canonical constraint contract:
   * - {} is valid (envelope present but empty)
   * - undefined envelope => Phase3 may inject deterministic demo defaults
   */
  constraints: Phase3Constraints;
};

export type Phase3Result =
  | { ok: true; phase3: Phase3Output }
  | { ok: false; failure_token: string; details?: unknown };

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Deterministic canonicalization:
 * - keep only non-empty strings
 * - de-dupe
 * - sort lexicographically
 * - return undefined if empty
 */
function uniqSortedStrings(xs: unknown): string[] | undefined {
  if (!Array.isArray(xs)) return undefined;

  const buf: string[] = [];
  for (const v of xs) {
    if (typeof v === "string") {
      const s = v.trim();
      if (s.length > 0) buf.push(s);
    }
  }
  if (buf.length === 0) return undefined;

  const uniq = Array.from(new Set(buf));
  uniq.sort((a, b) => a.localeCompare(b));
  return uniq.length > 0 ? uniq : undefined;
}

/**
 * Ticket 012/014:
 * - If canonicalInput.constraints is PRESENT (even {}), it is sovereign: no defaults.
 * - If canonicalInput.constraints is ABSENT, defaults are permitted (demo only).
 */
export function phase3ResolveConstraintsAndLoadRegistries(canonicalInput: any): Phase3Result {
  let lr: any;
  try {
    lr = loadRegistries();
  } catch (e: any) {
    return {
      ok: false,
      failure_token: "registry_load_failed",
      details: String(e?.message ?? e)
    };
  }

  const activityId = String(canonicalInput?.activity_id ?? "");

  const envelopePresent = Object.prototype.hasOwnProperty.call(canonicalInput ?? {}, "constraints");
  const rawEnvelope = envelopePresent ? (canonicalInput?.constraints ?? {}) : undefined;

  let constraints: Phase3Constraints = {};

  if (envelopePresent) {
    // Sovereign envelope: map only what exists. No defaults.
    if (isRecord(rawEnvelope)) {
      const avoid = uniqSortedStrings((rawEnvelope as any).avoid_joint_stress_tags);
      const banned = uniqSortedStrings((rawEnvelope as any).banned_equipment);
      const available = uniqSortedStrings((rawEnvelope as any).available_equipment);

      if (avoid) constraints.avoid_joint_stress_tags = avoid;
      if (banned) constraints.banned_equipment = banned;
      if (available) constraints.available_equipment = available;
    } else {
      // Present but invalid shape (should be prevented by schema). Stay deterministic.
      constraints = {};
    }
  } else {
    // Envelope absent: demo defaults allowed, minimal and deterministic.
    if (activityId === "powerlifting") {
      constraints = { avoid_joint_stress_tags: ["shoulder_high"] };
    } else {
      constraints = {};
    }
  }

  const notes: string[] = [];
  notes.push("PHASE_3: registries loaded");
  notes.push(
    envelopePresent
      ? "PHASE_3: constraints envelope present (Phase1 sovereign) — no defaults injected"
      : "PHASE_3: constraints envelope absent — defaults permitted (demo)"
  );

  return {
    ok: true,
    phase3: {
      constraints_resolved: true,
      notes,
      registry_index_version: lr.registry_index_version,
      loaded_registries: lr.loaded_registries,
      constraints
    }
  };
}




