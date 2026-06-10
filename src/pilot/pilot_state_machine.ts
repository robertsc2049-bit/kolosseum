export const PILOT_STATES = [
  "accepted",
  "commercial_pending",
  "platform_pending",
  "coach_pending",
  "athlete_pending",
  "link_pending",
  "scope_pending",
  "phase1_pending",
  "compile_pending",
  "coach_ready",
  "active",
  "paused",
  "stopped",
  "cancelled",
] as const;

export type PilotState = (typeof PILOT_STATES)[number];

export const PILOT_BLOCKED_REASONS = [
  "payment_missing",
  "workspace_missing",
  "coach_missing",
  "athlete_missing",
  "link_not_accepted",
  "scope_not_locked",
  "phase1_missing",
  "phase1_refused",
  "compile_failed",
] as const;

export type PilotBlockedReason = (typeof PILOT_BLOCKED_REASONS)[number];

export type PilotPreconditions = Readonly<{
  commercialAccepted: boolean;
  paymentAccessActive: boolean;
  workspaceCreated: boolean;
  coachAccountActive: boolean;
  athleteAccountActive: boolean;
  coachAthleteLinkAccepted: boolean;
  scopeLocked: boolean;
  phase1Accepted: boolean;
  phase1Refused: boolean;
  compilePassed: boolean;
  compileFailed: boolean;
  firstExecutableSessionExists: boolean;
  activationSignalReceived: boolean;
  pauseRequested: boolean;
  stopRequested: boolean;
  cancelRequested: boolean;
}>;

export type PilotTransitionOk = Readonly<{
  ok: true;
  from: PilotState;
  to: PilotState;
  blockedReason: PilotBlockedReason | null;
  engineOutputAltered: false;
}>;

export type PilotTransitionError = Readonly<{
  ok: false;
  error:
    | "unknown_current_state"
    | "unknown_requested_state"
    | "invalid_preconditions"
    | "illegal_transition"
    | "terminal_state";
  from: string;
  to: string;
  blockedReason: PilotBlockedReason | null;
  engineOutputAltered: false;
}>;

export type PilotTransitionResult = PilotTransitionOk | PilotTransitionError;

export const TERMINAL_PILOT_STATES: ReadonlySet<PilotState> = new Set<PilotState>([
  "stopped",
  "cancelled",
]);

export const PILOT_STATE_ORDER: Readonly<Record<PilotState, number>> = Object.freeze({
  accepted: 0,
  commercial_pending: 1,
  platform_pending: 2,
  coach_pending: 3,
  athlete_pending: 4,
  link_pending: 5,
  scope_pending: 6,
  phase1_pending: 7,
  compile_pending: 8,
  coach_ready: 9,
  active: 10,
  paused: 11,
  stopped: 12,
  cancelled: 13,
});

export const LEGAL_PILOT_TRANSITIONS: Readonly<Record<PilotState, readonly PilotState[]>> = Object.freeze({
  accepted: [
    "commercial_pending",
    "platform_pending",
    "coach_pending",
    "athlete_pending",
    "link_pending",
    "scope_pending",
    "phase1_pending",
    "compile_pending",
    "coach_ready",
    "cancelled",
  ],
  commercial_pending: [
    "platform_pending",
    "coach_pending",
    "athlete_pending",
    "link_pending",
    "scope_pending",
    "phase1_pending",
    "compile_pending",
    "coach_ready",
    "cancelled",
  ],
  platform_pending: [
    "coach_pending",
    "athlete_pending",
    "link_pending",
    "scope_pending",
    "phase1_pending",
    "compile_pending",
    "coach_ready",
    "cancelled",
  ],
  coach_pending: [
    "athlete_pending",
    "link_pending",
    "scope_pending",
    "phase1_pending",
    "compile_pending",
    "coach_ready",
    "cancelled",
  ],
  athlete_pending: [
    "link_pending",
    "scope_pending",
    "phase1_pending",
    "compile_pending",
    "coach_ready",
    "cancelled",
  ],
  link_pending: [
    "scope_pending",
    "phase1_pending",
    "compile_pending",
    "coach_ready",
    "cancelled",
  ],
  scope_pending: [
    "phase1_pending",
    "compile_pending",
    "coach_ready",
    "cancelled",
  ],
  phase1_pending: [
    "compile_pending",
    "coach_ready",
    "cancelled",
  ],
  compile_pending: [
    "coach_ready",
    "cancelled",
  ],
  coach_ready: [
    "active",
    "stopped",
    "cancelled",
  ],
  active: [
    "paused",
    "stopped",
    "cancelled",
  ],
  paused: [
    "active",
    "stopped",
    "cancelled",
  ],
  stopped: [],
  cancelled: [],
});

function isPilotState(value: string): value is PilotState {
  return (PILOT_STATES as readonly string[]).includes(value);
}

function allBooleanPreconditions(preconditions: unknown): preconditions is PilotPreconditions {
  if (preconditions === null || typeof preconditions !== "object" || Array.isArray(preconditions)) {
    return false;
  }

  const candidate = preconditions as Record<string, unknown>;
  const requiredKeys: readonly (keyof PilotPreconditions)[] = [
    "commercialAccepted",
    "paymentAccessActive",
    "workspaceCreated",
    "coachAccountActive",
    "athleteAccountActive",
    "coachAthleteLinkAccepted",
    "scopeLocked",
    "phase1Accepted",
    "phase1Refused",
    "compilePassed",
    "compileFailed",
    "firstExecutableSessionExists",
    "activationSignalReceived",
    "pauseRequested",
    "stopRequested",
    "cancelRequested",
  ];

  const actualKeys = Object.keys(candidate);
  if (actualKeys.length !== requiredKeys.length) {
    return false;
  }

  for (const key of requiredKeys) {
    if (typeof candidate[key] !== "boolean") {
      return false;
    }
  }

  return true;
}

export function derivePilotBlockedReason(
  preconditions: PilotPreconditions,
): PilotBlockedReason | null {
  if (!preconditions.commercialAccepted || !preconditions.paymentAccessActive) {
    return "payment_missing";
  }

  if (!preconditions.workspaceCreated) {
    return "workspace_missing";
  }

  if (!preconditions.coachAccountActive) {
    return "coach_missing";
  }

  if (!preconditions.athleteAccountActive) {
    return "athlete_missing";
  }

  if (!preconditions.coachAthleteLinkAccepted) {
    return "link_not_accepted";
  }

  if (!preconditions.scopeLocked) {
    return "scope_not_locked";
  }

  if (preconditions.phase1Refused) {
    return "phase1_refused";
  }

  if (!preconditions.phase1Accepted) {
    return "phase1_missing";
  }

  if (preconditions.compileFailed) {
    return "compile_failed";
  }

  return null;
}

export function hasCoachReadyPreconditions(preconditions: PilotPreconditions): boolean {
  return (
    preconditions.commercialAccepted === true &&
    preconditions.paymentAccessActive === true &&
    preconditions.workspaceCreated === true &&
    preconditions.coachAccountActive === true &&
    preconditions.athleteAccountActive === true &&
    preconditions.coachAthleteLinkAccepted === true &&
    preconditions.scopeLocked === true &&
    preconditions.phase1Accepted === true &&
    preconditions.phase1Refused === false &&
    preconditions.compilePassed === true &&
    preconditions.compileFailed === false &&
    preconditions.firstExecutableSessionExists === true
  );
}

export function derivePilotState(
  currentState: PilotState,
  preconditions: PilotPreconditions,
): PilotState {
  if (preconditions.cancelRequested) {
    return "cancelled";
  }

  if (preconditions.stopRequested) {
    return "stopped";
  }

  if (!preconditions.commercialAccepted || !preconditions.paymentAccessActive) {
    return "commercial_pending";
  }

  if (!preconditions.workspaceCreated) {
    return "platform_pending";
  }

  if (!preconditions.coachAccountActive) {
    return "coach_pending";
  }

  if (!preconditions.athleteAccountActive) {
    return "athlete_pending";
  }

  if (!preconditions.coachAthleteLinkAccepted) {
    return "link_pending";
  }

  if (!preconditions.scopeLocked) {
    return "scope_pending";
  }

  if (preconditions.phase1Refused || !preconditions.phase1Accepted) {
    return "phase1_pending";
  }

  if (
    preconditions.compileFailed ||
    !preconditions.compilePassed ||
    !preconditions.firstExecutableSessionExists
  ) {
    return "compile_pending";
  }

  if (currentState === "active" && preconditions.pauseRequested) {
    return "paused";
  }

  if (
    (currentState === "coach_ready" || currentState === "active" || currentState === "paused") &&
    preconditions.activationSignalReceived
  ) {
    return "active";
  }

  return "coach_ready";
}

export function canTransition(
  from: PilotState,
  to: PilotState,
  preconditions: PilotPreconditions,
): boolean {
  if (TERMINAL_PILOT_STATES.has(from)) {
    return false;
  }

  if (from === to) {
    return true;
  }

  if (!LEGAL_PILOT_TRANSITIONS[from].includes(to)) {
    return false;
  }

  if (to === "coach_ready") {
    return hasCoachReadyPreconditions(preconditions);
  }

  if (to === "active") {
    return (
      (from === "coach_ready" || from === "paused") &&
      hasCoachReadyPreconditions(preconditions) &&
      preconditions.activationSignalReceived
    );
  }

  if (to === "paused") {
    return from === "active" && preconditions.pauseRequested;
  }

  if (to === "stopped") {
    return (from === "coach_ready" || from === "active" || from === "paused") && preconditions.stopRequested;
  }

  if (to === "cancelled") {
    return preconditions.cancelRequested;
  }

  const derived = derivePilotState(from, preconditions);
  return derived === to;
}

export function transitionPilotState(
  currentStateRaw: string,
  requestedStateRaw: string,
  preconditionsRaw: unknown,
): PilotTransitionResult {
  if (!isPilotState(currentStateRaw)) {
    return {
      ok: false,
      error: "unknown_current_state",
      from: currentStateRaw,
      to: requestedStateRaw,
      blockedReason: null,
      engineOutputAltered: false,
    };
  }

  if (!isPilotState(requestedStateRaw)) {
    return {
      ok: false,
      error: "unknown_requested_state",
      from: currentStateRaw,
      to: requestedStateRaw,
      blockedReason: null,
      engineOutputAltered: false,
    };
  }

  if (!allBooleanPreconditions(preconditionsRaw)) {
    return {
      ok: false,
      error: "invalid_preconditions",
      from: currentStateRaw,
      to: requestedStateRaw,
      blockedReason: null,
      engineOutputAltered: false,
    };
  }

  const blockedReason = derivePilotBlockedReason(preconditionsRaw);

  if (TERMINAL_PILOT_STATES.has(currentStateRaw)) {
    return {
      ok: false,
      error: "terminal_state",
      from: currentStateRaw,
      to: requestedStateRaw,
      blockedReason,
      engineOutputAltered: false,
    };
  }

  if (!canTransition(currentStateRaw, requestedStateRaw, preconditionsRaw)) {
    return {
      ok: false,
      error: "illegal_transition",
      from: currentStateRaw,
      to: requestedStateRaw,
      blockedReason,
      engineOutputAltered: false,
    };
  }

  return {
    ok: true,
    from: currentStateRaw,
    to: requestedStateRaw,
    blockedReason,
    engineOutputAltered: false,
  };
}

export function deriveAndTransitionPilotState(
  currentStateRaw: string,
  preconditionsRaw: unknown,
): PilotTransitionResult {
  if (!isPilotState(currentStateRaw)) {
    return {
      ok: false,
      error: "unknown_current_state",
      from: currentStateRaw,
      to: "unknown",
      blockedReason: null,
      engineOutputAltered: false,
    };
  }

  if (!allBooleanPreconditions(preconditionsRaw)) {
    return {
      ok: false,
      error: "invalid_preconditions",
      from: currentStateRaw,
      to: "unknown",
      blockedReason: null,
      engineOutputAltered: false,
    };
  }

  const requestedState = derivePilotState(currentStateRaw, preconditionsRaw);
  return transitionPilotState(currentStateRaw, requestedState, preconditionsRaw);
}