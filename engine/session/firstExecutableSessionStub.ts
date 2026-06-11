
// DEV NOTE: S-V0-04 canonical identity boundary.
// Canonical JSON and hash materialisation are release-critical identity functions.
// Do not add timestamps, random values, locale formatting, environment paths, or
// object-order-dependent behaviour here; identical v0 inputs must produce identical bytes and hash values.

// DEV NOTE: Engine-side implementation surface. Keep this code deterministic, closed-world, and
// free of product/UI/coach-note influence. Engine truth must come from explicit inputs,
// canonical registries, and validated contracts only.

import { createHash } from "node:crypto";

export const FIRST_EXECUTABLE_SESSION_STUB_VERSION = "1.0.0" as const;
export const ENGINE_COMPATIBILITY = "EB2-1.0.0" as const;

export type V0ActivityId = "powerlifting" | "rugby_union" | "general_strength";
export type V0ExecutionScope = "individual" | "coach_managed";

export type AcceptedPhase1Declaration = {
  declaration_id: string;
  status: "accepted";
  phase1_hash: string;
  engine_compatibility: typeof ENGINE_COMPATIBILITY;
  activity_id: V0ActivityId;
  execution_scope: V0ExecutionScope;
};

export type WorkItemStatus = "pending";
export type SessionStatus = "materialised";
export type GeneratedAtPolicy = "omitted_for_determinism";

export type FirstExecutableSessionWorkItem = {
  work_item_id: string;
  ordinal: number;
  kind: "movement";
  exercise_token_id: string;
  factual_label: string;
  status: WorkItemStatus;
  prescription: {
    sets: number;
    reps: number;
  };
};

export type FirstExecutableSessionArtefact = {
  session_id: string;
  source_phase1_declaration_id: string;
  source_phase1_hash: string;
  engine_compatibility: typeof ENGINE_COMPATIBILITY;
  activity_id: V0ActivityId;
  execution_scope: V0ExecutionScope;
  generated_at_policy: GeneratedAtPolicy;
  ordered_work_items: FirstExecutableSessionWorkItem[];
  session_status: SessionStatus;
  factual_labels: string[];
};

export type FirstExecutableSessionMaterialisationInput = {
  accepted_declaration: AcceptedPhase1Declaration;
};

const SUPPORTED_ACTIVITIES: readonly V0ActivityId[] = [
  "powerlifting",
  "rugby_union",
  "general_strength",
];

const SUPPORTED_EXECUTION_SCOPES: readonly V0ExecutionScope[] = [
  "individual",
  "coach_managed",
];

const WORK_ITEM_TEMPLATES: Record<V0ActivityId, FirstExecutableSessionWorkItem[]> = {
  powerlifting: [
    {
      work_item_id: "wi_001",
      ordinal: 1,
      kind: "movement",
      exercise_token_id: "exercise_token__powerlifting__squat",
      factual_label: "squat",
      status: "pending",
      prescription: { sets: 3, reps: 5 },
    },
    {
      work_item_id: "wi_002",
      ordinal: 2,
      kind: "movement",
      exercise_token_id: "exercise_token__powerlifting__bench_press",
      factual_label: "bench_press",
      status: "pending",
      prescription: { sets: 3, reps: 5 },
    },
    {
      work_item_id: "wi_003",
      ordinal: 3,
      kind: "movement",
      exercise_token_id: "exercise_token__powerlifting__deadlift",
      factual_label: "deadlift",
      status: "pending",
      prescription: { sets: 1, reps: 5 },
    },
  ],
  rugby_union: [
    {
      work_item_id: "wi_001",
      ordinal: 1,
      kind: "movement",
      exercise_token_id: "exercise_token__rugby_union__goblet_squat",
      factual_label: "goblet_squat",
      status: "pending",
      prescription: { sets: 3, reps: 6 },
    },
    {
      work_item_id: "wi_002",
      ordinal: 2,
      kind: "movement",
      exercise_token_id: "exercise_token__rugby_union__push_up",
      factual_label: "push_up",
      status: "pending",
      prescription: { sets: 3, reps: 8 },
    },
    {
      work_item_id: "wi_003",
      ordinal: 3,
      kind: "movement",
      exercise_token_id: "exercise_token__rugby_union__loaded_carry",
      factual_label: "loaded_carry",
      status: "pending",
      prescription: { sets: 3, reps: 1 },
    },
  ],
  general_strength: [
    {
      work_item_id: "wi_001",
      ordinal: 1,
      kind: "movement",
      exercise_token_id: "exercise_token__general_strength__hinge",
      factual_label: "hinge",
      status: "pending",
      prescription: { sets: 3, reps: 6 },
    },
    {
      work_item_id: "wi_002",
      ordinal: 2,
      kind: "movement",
      exercise_token_id: "exercise_token__general_strength__press",
      factual_label: "press",
      status: "pending",
      prescription: { sets: 3, reps: 6 },
    },
    {
      work_item_id: "wi_003",
      ordinal: 3,
      kind: "movement",
      exercise_token_id: "exercise_token__general_strength__row",
      factual_label: "row",
      status: "pending",
      prescription: { sets: 3, reps: 8 },
    },
  ],
};

export function materialiseFirstExecutableSession(
  input: FirstExecutableSessionMaterialisationInput,
): FirstExecutableSessionArtefact {
  const declaration = input?.accepted_declaration;

  assertAcceptedDeclaration(declaration);

  const orderedWorkItems = cloneWorkItems(WORK_ITEM_TEMPLATES[declaration.activity_id]);

  const bodyWithoutId = {
    source_phase1_declaration_id: declaration.declaration_id,
    source_phase1_hash: declaration.phase1_hash,
    engine_compatibility: declaration.engine_compatibility,
    activity_id: declaration.activity_id,
    execution_scope: declaration.execution_scope,
    generated_at_policy: "omitted_for_determinism" as const,
    ordered_work_items: orderedWorkItems,
  };

  const sessionId = deriveSessionId(bodyWithoutId);

  return {
    session_id: sessionId,
    ...bodyWithoutId,
    session_status: "materialised",
    factual_labels: [
      declaration.activity_id,
      declaration.execution_scope,
      "first_executable_session",
      "materialised",
    ],
  };
}

function assertAcceptedDeclaration(value: unknown): asserts value is AcceptedPhase1Declaration {
  if (!isPlainObject(value)) {
    throw new Error("S32_MISSING_ACCEPTED_DECLARATION");
  }

  if (value.status !== "accepted") {
    throw new Error("S32_DECLARATION_NOT_ACCEPTED");
  }

  if (typeof value.declaration_id !== "string" || value.declaration_id.length === 0) {
    throw new Error("S32_MISSING_PHASE1_DECLARATION_ID");
  }

  if (typeof value.phase1_hash !== "string" || !/^[a-f0-9]{64}$/.test(value.phase1_hash)) {
    throw new Error("S32_INVALID_PHASE1_HASH");
  }

  if (value.engine_compatibility !== ENGINE_COMPATIBILITY) {
    throw new Error("S32_ENGINE_COMPATIBILITY_MISMATCH");
  }

  if (!SUPPORTED_ACTIVITIES.includes(value.activity_id as V0ActivityId)) {
    throw new Error("S32_UNSUPPORTED_ACTIVITY");
  }

  if (!SUPPORTED_EXECUTION_SCOPES.includes(value.execution_scope as V0ExecutionScope)) {
    throw new Error("S32_UNSUPPORTED_EXECUTION_SCOPE");
  }
}

function deriveSessionId(bodyWithoutId: Omit<FirstExecutableSessionArtefact, "session_id" | "session_status" | "factual_labels">): string {
  const seed = stableCanonicalJson({
    kolosseum_artefact: "first_executable_session_stub",
    version: FIRST_EXECUTABLE_SESSION_STUB_VERSION,
    body: bodyWithoutId,
  });

  return `fes_${sha256Hex(seed).slice(0, 32)}`;
}

function cloneWorkItems(items: readonly FirstExecutableSessionWorkItem[]): FirstExecutableSessionWorkItem[] {
  return items.map((item) => ({
    work_item_id: item.work_item_id,
    ordinal: item.ordinal,
    kind: item.kind,
    exercise_token_id: item.exercise_token_id,
    factual_label: item.factual_label,
    status: item.status,
    prescription: {
      sets: item.prescription.sets,
      reps: item.prescription.reps,
    },
  }));
}

export function stableCanonicalJson(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("S32_NON_FINITE_NUMBER");
    }

    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableCanonicalJson(entry)).join(",")}]`;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();

    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableCanonicalJson((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }

  throw new Error("S32_UNSERIALISABLE_VALUE");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
