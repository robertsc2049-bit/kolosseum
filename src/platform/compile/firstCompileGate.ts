export const SUPPORTED_ENGINE_COMPATIBILITY = "EB2-1.0.0" as const;

export const SUPPORTED_PHASE1_SCHEMA_VERSION =
  "kolosseum.master.phase1.input.schema.v1_0_1" as const;

export const SUPPORTED_EXECUTION_SCOPES = ["individual", "coach_managed"] as const;

export const SUPPORTED_ACTIVITIES = [
  "powerlifting",
  "rugby_union",
  "general_strength",
] as const;

export type SupportedExecutionScope = (typeof SUPPORTED_EXECUTION_SCOPES)[number];
export type SupportedActivityId = (typeof SUPPORTED_ACTIVITIES)[number];

export type PaymentAccessStatus =
  | "active"
  | "missing"
  | "inactive"
  | "suspended"
  | "expired"
  | "unknown";

export type WorkspaceStatus =
  | "active"
  | "missing"
  | "inactive"
  | "unknown";

export type AccountStatus =
  | "active"
  | "missing"
  | "inactive"
  | "suspended"
  | "unknown";

export type CoachAthleteLinkStatus =
  | "accepted"
  | "invited"
  | "revoked"
  | "expired"
  | "rejected"
  | "missing"
  | "unknown";

export type ScopeLockStatus =
  | "locked"
  | "unlocked"
  | "missing"
  | "unknown";

export type Phase1DeclarationStatus =
  | "accepted"
  | "missing"
  | "draft"
  | "invalid"
  | "refused"
  | "unknown";

export type CompileStatus =
  | "not_started"
  | "failed"
  | "running"
  | "succeeded"
  | "unknown";

export type FirstCompileBlockedReason =
  | "payment_missing"
  | "workspace_missing"
  | "coach_missing"
  | "athlete_missing"
  | "link_not_accepted"
  | "scope_not_locked"
  | "phase1_missing"
  | "phase1_invalid"
  | "phase1_refused"
  | "compile_failed"
  | "unsupported_scope"
  | "unsupported_activity"
  | "version_mismatch";

export type Phase1DeclarationAdmission = {
  status: Phase1DeclarationStatus;
  schemaVersion: string;
  schemaVersionPinned: boolean;
  declarationVersionPinned: boolean;
  engineCompatibility: string;
  executionScope: string;
  activityId: string;
};

export type ActivityAdmission = {
  activityId: string;
  registryResolved: boolean;
};

export type EngineCompatibilityAdmission = {
  engineCompatibility: string;
  enumBundleVersion: string;
  registryBundleVersion: string;
};

export type FirstCompileGateInput = {
  paymentAccess: PaymentAccessStatus;
  workspace: WorkspaceStatus;
  coachAccount: AccountStatus | "not_required";
  athleteAccount: AccountStatus;
  coachAthleteLink: CoachAthleteLinkStatus | "not_required";
  scopeLock: ScopeLockStatus;
  phase1Declaration: Phase1DeclarationAdmission;
  activity: ActivityAdmission;
  engineCompatibility: EngineCompatibilityAdmission;
  compileStatus: CompileStatus;
};

export type FirstCompileGateAllowedResult = {
  allowed: true;
  blockedReason: null;
};

export type FirstCompileGateBlockedResult = {
  allowed: false;
  blockedReason: FirstCompileBlockedReason;
};

export type FirstCompileGateResult =
  | FirstCompileGateAllowedResult
  | FirstCompileGateBlockedResult;

function blocked(blockedReason: FirstCompileBlockedReason): FirstCompileGateBlockedResult {
  return {
    allowed: false,
    blockedReason,
  };
}

function isSupportedExecutionScope(scope: string): scope is SupportedExecutionScope {
  return (SUPPORTED_EXECUTION_SCOPES as readonly string[]).includes(scope);
}

function isSupportedActivityId(activityId: string): activityId is SupportedActivityId {
  return (SUPPORTED_ACTIVITIES as readonly string[]).includes(activityId);
}

function hasExactEngineCompatibility(value: string): boolean {
  return value === SUPPORTED_ENGINE_COMPATIBILITY;
}

function hasExactPhase1SchemaVersion(value: string): boolean {
  return value === SUPPORTED_PHASE1_SCHEMA_VERSION;
}

export function canStartFirstCompile(
  input: Readonly<FirstCompileGateInput>,
): FirstCompileGateResult {
  if (input.paymentAccess !== "active") {
    return blocked("payment_missing");
  }

  if (input.workspace !== "active") {
    return blocked("workspace_missing");
  }

  const phase1 = input.phase1Declaration;

  if (phase1.status === "missing" || phase1.status === "draft") {
    return blocked("phase1_missing");
  }

  if (phase1.status === "refused") {
    return blocked("phase1_refused");
  }

  if (phase1.status !== "accepted") {
    return blocked("phase1_invalid");
  }

  if (
    !phase1.schemaVersionPinned ||
    !phase1.declarationVersionPinned ||
    !hasExactPhase1SchemaVersion(phase1.schemaVersion) ||
    !hasExactEngineCompatibility(phase1.engineCompatibility)
  ) {
    return blocked("version_mismatch");
  }

  if (!isSupportedExecutionScope(phase1.executionScope)) {
    return blocked("unsupported_scope");
  }

  if (!isSupportedActivityId(phase1.activityId)) {
    return blocked("unsupported_activity");
  }

  if (
    input.activity.activityId !== phase1.activityId ||
    !input.activity.registryResolved ||
    !isSupportedActivityId(input.activity.activityId)
  ) {
    return blocked("unsupported_activity");
  }

  if (
    !hasExactEngineCompatibility(input.engineCompatibility.engineCompatibility) ||
    input.engineCompatibility.enumBundleVersion !== SUPPORTED_ENGINE_COMPATIBILITY ||
    input.engineCompatibility.registryBundleVersion !== SUPPORTED_ENGINE_COMPATIBILITY
  ) {
    return blocked("version_mismatch");
  }

  if (input.athleteAccount !== "active") {
    return blocked("athlete_missing");
  }

  if (phase1.executionScope === "coach_managed") {
    if (input.coachAccount !== "active") {
      return blocked("coach_missing");
    }

    if (input.coachAthleteLink !== "accepted") {
      return blocked("link_not_accepted");
    }
  }

  if (phase1.executionScope === "individual") {
    if (input.coachAccount !== "not_required") {
      return blocked("unsupported_scope");
    }

    if (input.coachAthleteLink !== "not_required") {
      return blocked("link_not_accepted");
    }
  }

  if (input.scopeLock !== "locked") {
    return blocked("scope_not_locked");
  }

  if (input.compileStatus !== "not_started") {
    return blocked("compile_failed");
  }

  return {
    allowed: true,
    blockedReason: null,
  };
}

export type EngineCompileAdmissionProjection = {
  phase1Declaration: {
    schemaVersion: string;
    engineCompatibility: string;
    executionScope: SupportedExecutionScope;
    activityId: SupportedActivityId;
  };
};

export function projectEngineCompileAdmissionInput(
  input: Readonly<FirstCompileGateInput>,
): EngineCompileAdmissionProjection {
  const gate = canStartFirstCompile(input);

  if (!gate.allowed) {
    throw new Error(`Cannot project engine compile input while blocked: ${gate.blockedReason}`);
  }

  const phase1 = input.phase1Declaration;

  if (!isSupportedExecutionScope(phase1.executionScope)) {
    throw new Error("Unsupported execution scope after gate admission.");
  }

  if (!isSupportedActivityId(phase1.activityId)) {
    throw new Error("Unsupported activity after gate admission.");
  }

  return {
    phase1Declaration: {
      schemaVersion: phase1.schemaVersion,
      engineCompatibility: phase1.engineCompatibility,
      executionScope: phase1.executionScope,
      activityId: phase1.activityId,
    },
  };
}