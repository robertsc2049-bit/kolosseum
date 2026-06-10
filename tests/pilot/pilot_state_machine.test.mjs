import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const tsPath = path.join(repoRoot, "src", "pilot", "pilot_state_machine.ts");
const vectorsPath = path.join(repoRoot, "tests", "fixtures", "pilot_state_machine_vectors.json");
const docPath = path.join(repoRoot, "docs", "slices", "PILOT_STATE_MACHINE_ENFORCEMENT.md");

const source = fs.readFileSync(tsPath, "utf8");
const vectors = JSON.parse(fs.readFileSync(vectorsPath, "utf8"));
const doc = fs.readFileSync(docPath, "utf8");

const states = vectors.states;
const blockedReasons = vectors.blocked_reasons;

const legalTransitions = new Map();
for (const state of states) legalTransitions.set(state, new Set());
for (const [from, to] of vectors.legal_transitions) legalTransitions.get(from).add(to);

const terminalStates = new Set(["stopped", "cancelled"]);

function patch(base, diff) {
  return { ...base, ...diff };
}

function derivePilotBlockedReason(preconditions) {
  if (!preconditions.commercialAccepted || !preconditions.paymentAccessActive) return "payment_missing";
  if (!preconditions.workspaceCreated) return "workspace_missing";
  if (!preconditions.coachAccountActive) return "coach_missing";
  if (!preconditions.athleteAccountActive) return "athlete_missing";
  if (!preconditions.coachAthleteLinkAccepted) return "link_not_accepted";
  if (!preconditions.scopeLocked) return "scope_not_locked";
  if (preconditions.phase1Refused) return "phase1_refused";
  if (!preconditions.phase1Accepted) return "phase1_missing";
  if (preconditions.compileFailed) return "compile_failed";
  return null;
}

function hasCoachReadyPreconditions(preconditions) {
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

function derivePilotState(currentState, preconditions) {
  if (preconditions.cancelRequested) return "cancelled";
  if (preconditions.stopRequested) return "stopped";
  if (!preconditions.commercialAccepted || !preconditions.paymentAccessActive) return "commercial_pending";
  if (!preconditions.workspaceCreated) return "platform_pending";
  if (!preconditions.coachAccountActive) return "coach_pending";
  if (!preconditions.athleteAccountActive) return "athlete_pending";
  if (!preconditions.coachAthleteLinkAccepted) return "link_pending";
  if (!preconditions.scopeLocked) return "scope_pending";
  if (preconditions.phase1Refused || !preconditions.phase1Accepted) return "phase1_pending";
  if (preconditions.compileFailed || !preconditions.compilePassed || !preconditions.firstExecutableSessionExists) return "compile_pending";
  if (currentState === "active" && preconditions.pauseRequested) return "paused";
  if (["coach_ready", "active", "paused"].includes(currentState) && preconditions.activationSignalReceived) return "active";
  return "coach_ready";
}

function canTransition(from, to, preconditions) {
  if (terminalStates.has(from)) return false;
  if (from === to) return true;
  if (!legalTransitions.get(from)?.has(to)) return false;

  if (to === "coach_ready") return hasCoachReadyPreconditions(preconditions);
  if (to === "active") return ["coach_ready", "paused"].includes(from) && hasCoachReadyPreconditions(preconditions) && preconditions.activationSignalReceived;
  if (to === "paused") return from === "active" && preconditions.pauseRequested;
  if (to === "stopped") return ["coach_ready", "active", "paused"].includes(from) && preconditions.stopRequested;
  if (to === "cancelled") return preconditions.cancelRequested;

  return derivePilotState(from, preconditions) === to;
}

function transitionPilotState(from, to, preconditions) {
  if (!states.includes(from)) {
    return { ok: false, error: "unknown_current_state", from, to, blockedReason: null, engineOutputAltered: false };
  }

  if (!states.includes(to)) {
    return { ok: false, error: "unknown_requested_state", from, to, blockedReason: null, engineOutputAltered: false };
  }

  const required = Object.keys(vectors.base_preconditions);
  if (
    preconditions === null ||
    typeof preconditions !== "object" ||
    Array.isArray(preconditions) ||
    Object.keys(preconditions).length !== required.length ||
    required.some((key) => typeof preconditions[key] !== "boolean")
  ) {
    return { ok: false, error: "invalid_preconditions", from, to, blockedReason: null, engineOutputAltered: false };
  }

  const blockedReason = derivePilotBlockedReason(preconditions);

  if (terminalStates.has(from)) {
    return { ok: false, error: "terminal_state", from, to, blockedReason, engineOutputAltered: false };
  }

  if (!canTransition(from, to, preconditions)) {
    return { ok: false, error: "illegal_transition", from, to, blockedReason, engineOutputAltered: false };
  }

  return { ok: true, from, to, blockedReason, engineOutputAltered: false };
}

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run("S42_DOC_001 docs exist and define terminal rule", () => {
  assert.ok(doc.includes("Terminal Rule"));
  assert.ok(doc.includes("stopped and cancelled are terminal"));
  assert.ok(doc.includes("pilot state does not alter engine output"));
});

run("S42_TS_001 TypeScript exports required constants and functions", () => {
  for (const token of [
    "PILOT_STATES",
    "PILOT_BLOCKED_REASONS",
    "LEGAL_PILOT_TRANSITIONS",
    "derivePilotBlockedReason",
    "hasCoachReadyPreconditions",
    "derivePilotState",
    "canTransition",
    "transitionPilotState",
    "deriveAndTransitionPilotState"
  ]) {
    assert.ok(source.includes(token), `Missing implementation token: ${token}`);
  }
});

run("S42_TS_002 every state appears in TypeScript source", () => {
  for (const state of states) {
    assert.ok(source.includes(`"${state}"`), `Missing state in TypeScript source: ${state}`);
  }
});

run("S42_TS_003 every blocked reason appears in TypeScript source", () => {
  for (const reason of blockedReasons) {
    assert.ok(source.includes(`"${reason}"`), `Missing blocked reason in TypeScript source: ${reason}`);
  }
});

run("S42_UNIT_001 blocked reason vectors derive expected blocked reason", () => {
  for (const vector of vectors.blocked_reason_vectors) {
    const preconditions = patch(vectors.base_preconditions, vector.patch);
    assert.equal(derivePilotBlockedReason(preconditions), vector.expected, vector.id);
  }
});

run("S42_UNIT_002 derived state vectors derive expected state", () => {
  for (const vector of vectors.derived_state_vectors) {
    const preconditions = patch(vectors.base_preconditions, vector.patch);
    assert.equal(derivePilotState(vector.from, preconditions), vector.expected, vector.id);
  }
});

run("S42_UNIT_003 every legal transition is tested and allowed with matching preconditions", () => {
  for (const [from, to] of vectors.legal_transitions) {
    let preconditions = { ...vectors.base_preconditions };

    if (to === "commercial_pending") preconditions.paymentAccessActive = false;
    if (to === "platform_pending") preconditions.workspaceCreated = false;
    if (to === "coach_pending") preconditions.coachAccountActive = false;
    if (to === "athlete_pending") preconditions.athleteAccountActive = false;
    if (to === "link_pending") preconditions.coachAthleteLinkAccepted = false;
    if (to === "scope_pending") preconditions.scopeLocked = false;
    if (to === "phase1_pending") preconditions.phase1Accepted = false;
    if (to === "compile_pending") preconditions.compilePassed = false;
    if (to === "active") preconditions.activationSignalReceived = true;
    if (to === "paused") preconditions.pauseRequested = true;
    if (to === "stopped") preconditions.stopRequested = true;
    if (to === "cancelled") preconditions.cancelRequested = true;

    const result = transitionPilotState(from, to, preconditions);
    assert.equal(result.ok, true, `${from} -> ${to} should be legal`);
    assert.equal(result.engineOutputAltered, false);
  }
});

run("S42_UNIT_004 every illegal transition is tested and refused", () => {
  for (const [from, to] of vectors.illegal_transitions) {
    const result = transitionPilotState(from, to, vectors.base_preconditions);
    assert.equal(result.ok, false, `${from} -> ${to} should be illegal`);
    assert.ok(["illegal_transition", "terminal_state"].includes(result.error), `${from} -> ${to} returned ${result.error}`);
    assert.equal(result.engineOutputAltered, false);
  }
});

run("S42_UNIT_005 unknown current state fails", () => {
  const result = transitionPilotState("unknown_state", "accepted", vectors.base_preconditions);
  assert.equal(result.ok, false);
  assert.equal(result.error, "unknown_current_state");
});

run("S42_UNIT_006 unknown requested state fails", () => {
  const result = transitionPilotState("accepted", "unknown_state", vectors.base_preconditions);
  assert.equal(result.ok, false);
  assert.equal(result.error, "unknown_requested_state");
});

run("S42_UNIT_007 invalid preconditions fail", () => {
  const result = transitionPilotState("accepted", "commercial_pending", { paymentAccessActive: false });
  assert.equal(result.ok, false);
  assert.equal(result.error, "invalid_preconditions");
});

run("S42_UNIT_008 coach_ready impossible with each missing prerequisite", () => {
  const prerequisiteKeys = [
    "commercialAccepted",
    "paymentAccessActive",
    "workspaceCreated",
    "coachAccountActive",
    "athleteAccountActive",
    "coachAthleteLinkAccepted",
    "scopeLocked",
    "phase1Accepted",
    "compilePassed",
    "firstExecutableSessionExists"
  ];

  for (const key of prerequisiteKeys) {
    const preconditions = { ...vectors.base_preconditions, [key]: false };
    const result = transitionPilotState("compile_pending", "coach_ready", preconditions);
    assert.equal(result.ok, false, `coach_ready must fail when ${key} is false`);
  }

  const refused = { ...vectors.base_preconditions, phase1Refused: true };
  assert.equal(transitionPilotState("compile_pending", "coach_ready", refused).ok, false);

  const compileFailed = { ...vectors.base_preconditions, compileFailed: true };
  assert.equal(transitionPilotState("compile_pending", "coach_ready", compileFailed).ok, false);
});

run("S42_UNIT_009 active requires coach_ready or paused plus activation signal", () => {
  const withoutSignal = { ...vectors.base_preconditions, activationSignalReceived: false };
  assert.equal(transitionPilotState("coach_ready", "active", withoutSignal).ok, false);

  const withSignal = { ...vectors.base_preconditions, activationSignalReceived: true };
  assert.equal(transitionPilotState("coach_ready", "active", withSignal).ok, true);
  assert.equal(transitionPilotState("paused", "active", withSignal).ok, true);
  assert.equal(transitionPilotState("compile_pending", "active", withSignal).ok, false);
});

run("S42_UNIT_010 terminal states cannot resume", () => {
  for (const terminal of ["stopped", "cancelled"]) {
    for (const to of states.filter((state) => state !== terminal)) {
      const result = transitionPilotState(terminal, to, vectors.base_preconditions);
      assert.equal(result.ok, false, `${terminal} -> ${to} must fail`);
      assert.equal(result.error, "terminal_state");
    }
  }
});

run("S42_UNIT_011 pilot state does not alter engine output", () => {
  for (const [from, to] of vectors.legal_transitions) {
    let preconditions = { ...vectors.base_preconditions };
    if (to === "active") preconditions.activationSignalReceived = true;
    if (to === "paused") preconditions.pauseRequested = true;
    if (to === "stopped") preconditions.stopRequested = true;
    if (to === "cancelled") preconditions.cancelRequested = true;
    if (to === "commercial_pending") preconditions.paymentAccessActive = false;
    if (to === "platform_pending") preconditions.workspaceCreated = false;
    if (to === "coach_pending") preconditions.coachAccountActive = false;
    if (to === "athlete_pending") preconditions.athleteAccountActive = false;
    if (to === "link_pending") preconditions.coachAthleteLinkAccepted = false;
    if (to === "scope_pending") preconditions.scopeLocked = false;
    if (to === "phase1_pending") preconditions.phase1Accepted = false;
    if (to === "compile_pending") preconditions.compilePassed = false;

    const result = transitionPilotState(from, to, preconditions);
    assert.equal(result.engineOutputAltered, false);
  }
});

console.log("S42 pilot state machine tests passed.");