import { loadRegistries } from "../registries/loadRegistries.js";

export type Phase3Output = {
  constraints_resolved: boolean;
  notes: string[];
  registry_index_version: string;
  loaded_registries: string[];
  constraints: {
    avoid_joint_stress_tags?: string[];
    banned_equipment?: string[];
  };
};

export type Phase3Result =
  | { ok: true; phase3: Phase3Output }
  | { ok: false; failure_token: string; details?: unknown };

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

  // v0 demo rule (now Phase 3 responsibility)
  const constraints =
    activityId === "powerlifting"
      ? { avoid_joint_stress_tags: ["shoulder_high"] }
      : {};

  return {
    ok: true,
    phase3: {
      constraints_resolved: true,
      notes: ["PHASE_3_V0: registries loaded; constraints emitted (minimal demo rule)"],
      registry_index_version: lr.registry_index_version,
      loaded_registries: lr.loaded_registries,
      constraints
    }
  };
}
