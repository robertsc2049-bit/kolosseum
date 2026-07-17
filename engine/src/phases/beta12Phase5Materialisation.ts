/*
 * DEV NOTE: BETA-12 deterministic Phase 5 materialisation.
 * This module consumes only the hash-bound Phase 4 enumeration structure.
 * Selection is the canonical structural minimum and does not consult external state.
 */

import { betaCanonicalHash } from "./betaCanonical.js";
import type {
  Beta11ActivityId,
  Phase4Program,
  Phase4StructuralCandidate,
  PlannedItem
} from "./phase4/types.js";

const supportedActivities: readonly Beta11ActivityId[] = Object.freeze([
  "general_strength",
  "powerlifting",
  "rugby_union"
]);

export type Phase5ExecutableBlock = {
  block_id: string;
  item_ids: [string];
};

export type Phase5ExecutableSession = {
  session_id: string;
  status: "ready";
  activity_id: Beta11ActivityId;
  blocks: [Phase5ExecutableBlock];
  planned_items: [PlannedItem];
};

export type Phase5MaterialisationOutput = {
  canonical_input_hash: string;
  constraint_hash: string;
  enumeration_hash: string;
  selection_hash: string;
  selected_candidate: Phase4StructuralCandidate;
  executable_session: Phase5ExecutableSession;
};

export type Beta12MaterialisedProgram = Phase4Program & {
  selection_hash: string;
  materialised_session_id: string;
};

export type Beta12Phase5MaterialisationResult =
  | {
      ok: true;
      phase5: Phase5MaterialisationOutput;
      materialised_program: Beta12MaterialisedProgram;
      adjustments: [];
      notes: [];
    }
  | {
      ok: false;
      failure_token:
        | "phase5_binding_mismatch"
        | "empty_solution_space"
        | "unknown_enum_value"
        | "nondeterminism_detected";
    };

function ordinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isSupportedActivity(value: unknown): value is Beta11ActivityId {
  return (
    typeof value === "string" &&
    (supportedActivities as readonly string[]).includes(value)
  );
}

function structuralIdentity(candidate: Phase4StructuralCandidate): string {
  return (
    candidate.activity_id +
    "\u0000" +
    candidate.exercise_ids.join("\u0000")
  );
}

function normaliseCandidate(
  value: unknown
): Phase4StructuralCandidate | null {
  if (!isRecord(value)) {
    return null;
  }

  const keys = Object.keys(value).sort(ordinal);

  if (
    JSON.stringify(keys) !==
    JSON.stringify(["activity_id", "exercise_ids"])
  ) {
    return null;
  }

  if (!isSupportedActivity(value.activity_id)) {
    return null;
  }

  if (
    !Array.isArray(value.exercise_ids) ||
    value.exercise_ids.length !== 1 ||
    typeof value.exercise_ids[0] !== "string" ||
    value.exercise_ids[0].length === 0
  ) {
    return null;
  }

  return {
    activity_id: value.activity_id,
    exercise_ids: [value.exercise_ids[0]]
  };
}

function deepFreeze<T>(value: T): T {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function")
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry);
    }
  }
  else {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      deepFreeze(entry);
    }
  }

  return Object.freeze(value);
}

function fail(
  failure_token:
    | "phase5_binding_mismatch"
    | "empty_solution_space"
    | "unknown_enum_value"
    | "nondeterminism_detected"
): Beta12Phase5MaterialisationResult {
  return deepFreeze({
    ok: false,
    failure_token
  });
}

export function hasBeta12Phase5Materialisation(
  value: unknown
): boolean {
  return (
    isRecord(value) &&
    (
      "enumeration_hash" in value ||
      "enumerated_solution_space" in value
    )
  );
}

export function materialiseBeta12Phase5(
  phase4Value: unknown
): Beta12Phase5MaterialisationResult {
  if (!isRecord(phase4Value)) {
    return fail("phase5_binding_mismatch");
  }

  const canonical_input_hash = phase4Value.canonical_input_hash;
  const constraint_hash = phase4Value.constraint_hash;
  const enumeration_hash = phase4Value.enumeration_hash;
  const enumeration = phase4Value.enumerated_solution_space;

  if (
    !isHash(canonical_input_hash) ||
    !isHash(constraint_hash) ||
    !isHash(enumeration_hash) ||
    !Array.isArray(enumeration)
  ) {
    return fail("phase5_binding_mismatch");
  }

  if (enumeration.length === 0) {
    return fail("empty_solution_space");
  }

  const candidates: Phase4StructuralCandidate[] = [];

  for (const rawCandidate of enumeration) {
    const candidate = normaliseCandidate(rawCandidate);

    if (!candidate) {
      return fail("unknown_enum_value");
    }

    candidates.push(candidate);
  }

  if (betaCanonicalHash(candidates) !== enumeration_hash) {
    return fail("phase5_binding_mismatch");
  }

  const activity_id = candidates[0].activity_id;

  if (
    candidates.some(
      (candidate) => candidate.activity_id !== activity_id
    )
  ) {
    return fail("unknown_enum_value");
  }

  const identities = candidates.map(structuralIdentity);

  if (new Set(identities).size !== identities.length) {
    return fail("nondeterminism_detected");
  }

  const selected_candidate = [...candidates]
    .sort(
      (left, right) =>
        ordinal(
          structuralIdentity(left),
          structuralIdentity(right)
        )
    )[0];

  const selection_hash = betaCanonicalHash({
    canonical_input_hash,
    constraint_hash,
    enumeration_hash,
    selected_candidate
  });

  const identityToken = selection_hash.slice(0, 24);
  const shortToken = selection_hash.slice(0, 16);

  const session_id = `beta12_session_${identityToken}`;
  const block_id = `beta12_block_${shortToken}`;
  const item_id = `beta12_item_${shortToken}_0`;

  const plannedItem: PlannedItem = {
    block_id,
    item_id,
    exercise_id: selected_candidate.exercise_ids[0],
    session_id,
    role: "primary",
    sets: 1,
    reps: 1,
    intensity: {
      type: "load",
      value: 0
    },
    rest_seconds: 0
  };

  const block: Phase5ExecutableBlock = {
    block_id,
    item_ids: [item_id]
  };

  const executable_session: Phase5ExecutableSession = {
    session_id,
    status: "ready",
    activity_id,
    blocks: [block],
    planned_items: [plannedItem]
  };

  const phase5: Phase5MaterialisationOutput = {
    canonical_input_hash,
    constraint_hash,
    enumeration_hash,
    selection_hash,
    selected_candidate,
    executable_session
  };

  const materialised_program: Beta12MaterialisedProgram = {
    program_id: "BETA_12_PHASE_5_MATERIALISATION",
    version: "1.0.0",
    blocks: executable_session.blocks,
    planned_items: executable_session.planned_items,
    planned_exercise_ids: [
      selected_candidate.exercise_ids[0]
    ],
    exercises: [],
    exercise_pool: {},
    target_exercise_id:
      selected_candidate.exercise_ids[0],
    canonical_input_hash,
    constraint_hash,
    enumeration_hash,
    enumerated_solution_space: candidates,
    selection_hash,
    materialised_session_id: session_id
  };

  return deepFreeze({
    ok: true,
    phase5,
    materialised_program,
    adjustments: [],
    notes: []
  });
}
