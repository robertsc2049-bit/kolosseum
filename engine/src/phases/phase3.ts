import { loadRegistries } from "../registries/loadRegistries.js";

export type Phase3Output = {
  constraints_resolved: boolean;
  notes: string[];
  registry_index_version: string;
  loaded_registries: string[];
  constraints: {
    avoid_joint_stress_tags?: string[];
    banned_equipment?: string[];
    available_equipment_ids?: string[];
  };
};

export type Phase3Result =
  | { ok: true; phase3: Phase3Output }
  | { ok: false; failure_token: string; details?: unknown };

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function uniqStrings(xs: unknown): string[] | undefined {
  if (!Array.isArray(xs)) return undefined;
  const out: string[] = [];
  for (const v of xs) {
    if (typeof v === "string" && v.length > 0) out.push(v);
  }
  const uniq = Array.from(new Set(out));
  return uniq.length > 0 ? uniq : undefined;
}

/**
 * Ticket 012 (authoritative):
 * - If canonicalInput.constraints is PRESENT (even {}), it is sovereign.
 *   Phase3 must not inject defaults.
 * - If canonicalInput.constraints is ABSENT (undefined), Phase3 may inject demo defaults.
 *
 * This preserves the semantic signal of envelope presence.
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

  // Phase1 envelope mapping (schema uses *_ids; substitution types use slightly different names)
  // We do NOT attempt to invent/merge constraints beyond what is provided when envelope is present.
  let constraints: Phase3Output["constraints"] = {};

  if (envelopePresent) {
    // Sovereign: map only what caller provided. No defaults.
    if (isRecord(rawEnvelope)) {
      const avoid = uniqStrings((rawEnvelope as any).avoid_joint_stress_tags);
      const bannedIds = uniqStrings((rawEnvelope as any).banned_equipment_ids);
      const availableIds = uniqStrings((rawEnvelope as any).available_equipment_ids);

      if (avoid) constraints.avoid_joint_stress_tags = avoid;
      // NOTE: substitution engine constraint key is banned_equipment (string[]). We map ids directly.
      if (bannedIds) constraints.banned_equipment = bannedIds;
      if (availableIds) constraints.available_equipment_ids = availableIds;
    }
  } else {
    // Envelope absent: Phase3 may inject deterministic demo defaults (if desired).
    // Keep this minimal and deterministic; do NOT override later.
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
