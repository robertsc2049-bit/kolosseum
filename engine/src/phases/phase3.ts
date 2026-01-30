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
      * - undefined envelope => Phase3 may inject deterministic v0 defaults (only if permitted)
      *    */
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
 * Ticket 012 / Ticket 014 / Ticket 018 alignment:
 * - If canonicalInput.constraints is PRESENT (even {}), it is sovereign: Phase3 MUST NOT inject defaults.
  * - If canonicalInput.constraints is ABSENT, Phase3 MAY inject deterministic v0 defaults (if you keep that behaviour).
 *
 * Note: Phase1 enforces schema + constraints_version + refusal rules.
 * Phase3 assumes the canonical input is already lawful.
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
  const rawEnvelope = envelopePresent ? canonicalInput?.constraints : undefined;

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
      // Present but invalid shape should be blocked by Phase1 schema.
      // Stay deterministic: treat as empty envelope.
      constraints = {};
    }
  } else {
    /// Envelope absent: v0 defaults allowed, minimal and deterministic.
    // If you ever want "no defaults, ever" later, delete this block and always return {} here.
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
      : "PHASE_3: constraints envelope absent — defaults permitted (v0)"
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




