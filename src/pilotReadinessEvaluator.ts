// S48 - Pilot Acceptance Gate
// Pure deterministic evaluator.
// No database, no network, no generated timestamps, no randomness.

export const PILOT_READY_STATUS = Object.freeze({
  COACH_READY: "coach_ready",
  BLOCKED: "blocked"
} as const);

export type PilotReadyStatus =
  (typeof PILOT_READY_STATUS)[keyof typeof PILOT_READY_STATUS];

export const REQUIRED_READINESS_IDS = Object.freeze([
  "payment_confirmed",
  "workspace_created",
  "coach_active",
  "athlete_active",
  "link_accepted",
  "scope_locked",
  "phase1_accepted",
  "first_compile_passed",
  "first_executable_session_exists",
  "factual_execution_checked",
  "split_return_checked_if_claimed",
  "partial_completion_checked_if_claimed",
  "coach_surface_checked",
  "coach_artefact_view_checked",
  "non_binding_note_checked",
  "history_counts_checked",
  "support_boundary_checked",
  "claim_guard_checked",
  "source_artefacts_present"
] as const);

export type RequiredReadinessId = (typeof REQUIRED_READINESS_IDS)[number];

export const REQUIRED_NEGATIVE_BOUNDARY_IDS = Object.freeze([
  "no_phase7_surface",
  "no_phase8_surface",
  "no_org_runtime_surface",
  "no_team_runtime_surface",
  "no_gym_runtime_surface",
  "no_analytics_surface",
  "no_messaging_surface",
  "no_claim_surface",
  "no_medical_surface",
  "no_safety_surface",
  "no_optimisation_surface",
  "no_coach_override_surface",
  "no_forbidden_surface_exposed"
] as const);

export type RequiredNegativeBoundaryId = (typeof REQUIRED_NEGATIVE_BOUNDARY_IDS)[number];

export type PilotBlockedReasonId =
  | "payment_missing"
  | "workspace_missing"
  | "coach_account_inactive"
  | "athlete_account_inactive"
  | "coach_athlete_link_not_accepted"
  | "scope_not_locked"
  | "phase1_not_accepted"
  | "compile_not_admitted"
  | "first_session_missing"
  | "factual_execution_not_proven"
  | "split_return_not_proven_if_claimed"
  | "partial_completion_not_proven_if_claimed"
  | "coach_artefact_view_missing"
  | "non_binding_note_missing"
  | "history_counts_not_factual"
  | "support_boundary_missing"
  | "claim_guard_missing"
  | "forbidden_surface_exposed"
  | "source_artefact_missing";

export type PilotReadinessItemResult = {
  readonly item_id: string;
  readonly passed: boolean;
  readonly source_artefact_ref_ids: readonly string[];
};

export type PilotNegativeBoundaryResult = {
  readonly boundary_id: string;
  readonly passed: boolean;
  readonly source_artefact_ref_ids: readonly string[];
};

export type PilotSourceArtefactRef = {
  readonly artefact_ref_id: string;
};

export type PilotReadinessEvaluatorInput = {
  readonly readiness_item_results?: readonly unknown[];
  readonly negative_boundary_results?: readonly unknown[];
  readonly source_artefact_refs?: readonly unknown[];
};

export type PilotReadinessEvaluatorOutput = {
  readonly final_status: PilotReadyStatus;
  readonly blocked_reasons: readonly PilotBlockedReasonId[];
  readonly missing_readiness_ids: readonly string[];
  readonly failed_readiness_ids: readonly string[];
  readonly missing_negative_boundary_ids: readonly string[];
  readonly failed_negative_boundary_ids: readonly string[];
  readonly missing_source_artefact_ids: readonly string[];
};

export const READINESS_BLOCKED_REASON_MAP = {
  payment_confirmed: ["payment_missing"],
  workspace_created: ["workspace_missing"],
  coach_active: ["coach_account_inactive"],
  athlete_active: ["athlete_account_inactive"],
  link_accepted: ["coach_athlete_link_not_accepted"],
  scope_locked: ["scope_not_locked"],
  phase1_accepted: ["phase1_not_accepted"],
  first_compile_passed: ["compile_not_admitted", "first_session_missing"],
  first_executable_session_exists: ["first_session_missing"],
  factual_execution_checked: ["factual_execution_not_proven"],
  split_return_checked_if_claimed: ["split_return_not_proven_if_claimed"],
  partial_completion_checked_if_claimed: ["partial_completion_not_proven_if_claimed"],
  coach_surface_checked: ["coach_artefact_view_missing", "non_binding_note_missing"],
  coach_artefact_view_checked: ["coach_artefact_view_missing"],
  non_binding_note_checked: ["non_binding_note_missing"],
  history_counts_checked: ["history_counts_not_factual"],
  support_boundary_checked: ["support_boundary_missing"],
  claim_guard_checked: ["claim_guard_missing"],
  source_artefacts_present: ["source_artefact_missing"]
} as const satisfies Readonly<Record<RequiredReadinessId, readonly PilotBlockedReasonId[]>>;

export const NEGATIVE_BOUNDARY_BLOCKED_REASON: PilotBlockedReasonId = "forbidden_surface_exposed";
export const SOURCE_ARTEFACT_BLOCKED_REASON: PilotBlockedReasonId = "source_artefact_missing";

function uniqueInOrder<T extends string>(values: readonly T[]): T[] {
  const seen = new Set<T>();
  const output: T[] = [];

  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }

  return output;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function arrayOrEmpty(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function makeIdSet(values: readonly string[]): Set<string> {
  return new Set<string>(values);
}

function isRequiredReadinessId(value: string): value is RequiredReadinessId {
  return (REQUIRED_READINESS_IDS as readonly string[]).includes(value);
}

function isRequiredNegativeBoundaryId(value: string): value is RequiredNegativeBoundaryId {
  return (REQUIRED_NEGATIVE_BOUNDARY_IDS as readonly string[]).includes(value);
}

function readSourceArtefactIds(sourceArtefactRefs: unknown): Set<string> {
  const ids: string[] = [];

  for (const ref of arrayOrEmpty(sourceArtefactRefs)) {
    if (isRecord(ref) && typeof ref.artefact_ref_id === "string") {
      ids.push(ref.artefact_ref_id);
    }
  }

  return makeIdSet(ids);
}

function cloneResultArray(value: unknown): Record<string, unknown>[] {
  return arrayOrEmpty(value).filter(isRecord);
}

function sourceRefsForResult(result: Record<string, unknown>): string[] {
  return arrayOrEmpty(result.source_artefact_ref_ids).filter((id): id is string => typeof id === "string");
}

function collectMissingSourceRefs(
  result: Record<string, unknown>,
  knownSourceArtefactIds: ReadonlySet<string>,
  syntheticPrefix: string
): string[] {
  const refs = sourceRefsForResult(result);

  if (refs.length === 0) {
    return [`${syntheticPrefix}:source_artefact_ref_ids`];
  }

  return refs.filter((refId) => !knownSourceArtefactIds.has(refId));
}

function addReasons(target: PilotBlockedReasonId[], reasonIds: readonly PilotBlockedReasonId[]): void {
  for (const reasonId of reasonIds) {
    target.push(reasonId);
  }
}

export function evaluatePilotReadiness(input: PilotReadinessEvaluatorInput): PilotReadinessEvaluatorOutput {
  const sourceArtefactIds = readSourceArtefactIds(input?.source_artefact_refs);

  const readinessResults = cloneResultArray(input?.readiness_item_results);
  const boundaryResults = cloneResultArray(input?.negative_boundary_results);

  const providedReadinessIds = makeIdSet(
    readinessResults
      .map((item) => item.item_id)
      .filter((itemId): itemId is string => typeof itemId === "string")
  );

  const providedBoundaryIds = makeIdSet(
    boundaryResults
      .map((item) => item.boundary_id)
      .filter((boundaryId): boundaryId is string => typeof boundaryId === "string")
  );

  const missingReadinessIds: string[] = [];
  const failedReadinessIds: string[] = [];
  const missingNegativeBoundaryIds: string[] = [];
  const failedNegativeBoundaryIds: string[] = [];
  const missingSourceArtefactIds: string[] = [];
  const blockedReasons: PilotBlockedReasonId[] = [];

  for (const readinessId of REQUIRED_READINESS_IDS) {
    if (!providedReadinessIds.has(readinessId)) {
      missingReadinessIds.push(readinessId);
      addReasons(blockedReasons, READINESS_BLOCKED_REASON_MAP[readinessId]);
    }
  }

  for (const boundaryId of REQUIRED_NEGATIVE_BOUNDARY_IDS) {
    if (!providedBoundaryIds.has(boundaryId)) {
      missingNegativeBoundaryIds.push(boundaryId);
      blockedReasons.push(NEGATIVE_BOUNDARY_BLOCKED_REASON);
    }
  }

  for (const result of readinessResults) {
    const itemIdValue = result.item_id;

    if (typeof itemIdValue !== "string" || !isRequiredReadinessId(itemIdValue)) {
      failedReadinessIds.push(typeof itemIdValue === "string" ? itemIdValue : "unknown_readiness_item");
      blockedReasons.push(NEGATIVE_BOUNDARY_BLOCKED_REASON);
      continue;
    }

    if (result.passed !== true) {
      failedReadinessIds.push(itemIdValue);
      addReasons(blockedReasons, READINESS_BLOCKED_REASON_MAP[itemIdValue]);
    }

    const missingRefs = collectMissingSourceRefs(result, sourceArtefactIds, itemIdValue);
    if (missingRefs.length > 0) {
      missingSourceArtefactIds.push(...missingRefs);
      blockedReasons.push(SOURCE_ARTEFACT_BLOCKED_REASON);
    }
  }

  for (const result of boundaryResults) {
    const boundaryIdValue = result.boundary_id;

    if (typeof boundaryIdValue !== "string" || !isRequiredNegativeBoundaryId(boundaryIdValue)) {
      failedNegativeBoundaryIds.push(typeof boundaryIdValue === "string" ? boundaryIdValue : "unknown_negative_boundary_item");
      blockedReasons.push(NEGATIVE_BOUNDARY_BLOCKED_REASON);
      continue;
    }

    if (result.passed !== true) {
      failedNegativeBoundaryIds.push(boundaryIdValue);
      blockedReasons.push(NEGATIVE_BOUNDARY_BLOCKED_REASON);
    }

    const missingRefs = collectMissingSourceRefs(result, sourceArtefactIds, boundaryIdValue);
    if (missingRefs.length > 0) {
      missingSourceArtefactIds.push(...missingRefs);
      blockedReasons.push(SOURCE_ARTEFACT_BLOCKED_REASON);
    }
  }

  const output: PilotReadinessEvaluatorOutput = {
    final_status: PILOT_READY_STATUS.COACH_READY,
    blocked_reasons: uniqueInOrder(blockedReasons),
    missing_readiness_ids: uniqueInOrder(missingReadinessIds),
    failed_readiness_ids: uniqueInOrder(failedReadinessIds),
    missing_negative_boundary_ids: uniqueInOrder(missingNegativeBoundaryIds),
    failed_negative_boundary_ids: uniqueInOrder(failedNegativeBoundaryIds),
    missing_source_artefact_ids: uniqueInOrder(missingSourceArtefactIds)
  };

  if (
    output.blocked_reasons.length > 0 ||
    output.missing_readiness_ids.length > 0 ||
    output.failed_readiness_ids.length > 0 ||
    output.missing_negative_boundary_ids.length > 0 ||
    output.failed_negative_boundary_ids.length > 0 ||
    output.missing_source_artefact_ids.length > 0
  ) {
    return {
      ...output,
      final_status: PILOT_READY_STATUS.BLOCKED
    };
  }

  return output;
}