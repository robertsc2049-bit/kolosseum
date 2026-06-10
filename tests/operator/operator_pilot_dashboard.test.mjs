
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const contractPath = path.join(repoRoot, "contracts", "operator", "operator_pilot_dashboard.contract.json");
const apiPath = path.join(repoRoot, "contracts", "operator", "operator_pilot_dashboard.api.json");
const copyPath = path.join(repoRoot, "copy", "operator", "operator_pilot_dashboard.copy.json");
const docPath = path.join(repoRoot, "docs", "slices", "OPERATOR_PILOT_DASHBOARD.md");

const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const api = JSON.parse(fs.readFileSync(apiPath, "utf8"));
const copy = JSON.parse(fs.readFileSync(copyPath, "utf8"));
const doc = fs.readFileSync(docPath, "utf8");

const blockedReasons = contract.properties.blocked_reason.enum;
const dashboardStatuses = contract.properties.dashboard_status.enum;
const workspaceStatuses = contract.properties.workspace_status.enum;
const paymentStatuses = contract.properties.payment_access_status.enum;
const accountStatuses = contract.properties.coach_account_status.enum;
const linkStatuses = contract.properties.coach_athlete_link_status.enum;
const scopeStatuses = contract.properties.scope_status.enum;
const phase1Statuses = contract.properties.phase1_declaration_status.enum;
const compileStatuses = contract.properties.compile_status.enum;
const firstSessionStatuses = contract.properties.first_executable_session_status.enum;

const blockedPriority = contract["x-kolosseum"].blocked_reason_priority;
const readyPreconditions = contract["x-kolosseum"].coach_ready_preconditions;

const allowedKeys = new Set(Object.keys(contract.properties));

function validDashboard(overrides = {}) {
  return {
    schema_version: "kolosseum.operator_pilot_dashboard.v1",
    pilot_id: "pilot_001",
    generated_at: "2026-05-20T13:00:00Z",
    dashboard_status: "coach_ready",
    coach: {
      coach_user_id: "coach_001",
      display_name: "Coach Example"
    },
    athlete: {
      athlete_user_id: "athlete_001",
      display_name: "Athlete Example"
    },
    workspace_status: "created",
    payment_access_status: "access_active",
    coach_account_status: "active",
    athlete_account_status: "active",
    coach_athlete_link_status: "accepted",
    scope_status: "locked_v0",
    phase1_declaration_status: "accepted",
    compile_status: "passed",
    first_executable_session_status: "exists",
    blocked_reason: "none",
    next_factual_action: {
      copy_id: "operator_dashboard.next_action.none",
      params: {}
    },
    source_record_refs: {
      pilot_record_id: "pilot_001",
      workspace_record_id: "workspace_001",
      payment_access_record_id: "access_001",
      coach_user_record_id: "coach_001",
      athlete_user_record_id: "athlete_001",
      coach_athlete_link_record_id: "link_001",
      scope_lock_record_id: "scope_001",
      phase1_declaration_record_id: "phase1_001",
      compile_attempt_record_id: "compile_001",
      first_executable_session_record_id: "session_001"
    },
    ...overrides
  };
}

function validateClosedWorldShape(obj) {
  for (const key of contract.required) {
    assert.ok(Object.hasOwn(obj, key), `Missing required key: ${key}`);
  }

  for (const key of Object.keys(obj)) {
    assert.ok(allowedKeys.has(key), `Unexpected top-level key: ${key}`);
  }

  assert.equal(obj.schema_version, "kolosseum.operator_pilot_dashboard.v1");
  assert.ok(dashboardStatuses.includes(obj.dashboard_status), "Invalid dashboard_status");
  assert.ok(workspaceStatuses.includes(obj.workspace_status), "Invalid workspace_status");
  assert.ok(paymentStatuses.includes(obj.payment_access_status), "Invalid payment_access_status");
  assert.ok(accountStatuses.includes(obj.coach_account_status), "Invalid coach_account_status");
  assert.ok(accountStatuses.includes(obj.athlete_account_status), "Invalid athlete_account_status");
  assert.ok(linkStatuses.includes(obj.coach_athlete_link_status), "Invalid coach_athlete_link_status");
  assert.ok(scopeStatuses.includes(obj.scope_status), "Invalid scope_status");
  assert.ok(phase1Statuses.includes(obj.phase1_declaration_status), "Invalid phase1_declaration_status");
  assert.ok(compileStatuses.includes(obj.compile_status), "Invalid compile_status");
  assert.ok(firstSessionStatuses.includes(obj.first_executable_session_status), "Invalid first_executable_session_status");
  assert.ok(blockedReasons.includes(obj.blocked_reason), "Invalid blocked_reason");
  assert.equal(typeof obj.next_factual_action, "object", "next_factual_action must be object");
  assert.equal(typeof obj.next_factual_action.copy_id, "string", "next_factual_action.copy_id must be string");
  assert.equal(typeof obj.next_factual_action.params, "object", "next_factual_action.params must be object");
}

function deriveBlockedReason(state) {
  if (
    Object.values({
      workspace_status: state.workspace_status,
      payment_access_status: state.payment_access_status,
      coach_account_status: state.coach_account_status,
      athlete_account_status: state.athlete_account_status,
      coach_athlete_link_status: state.coach_athlete_link_status,
      scope_status: state.scope_status,
      phase1_declaration_status: state.phase1_declaration_status,
      compile_status: state.compile_status,
      first_executable_session_status: state.first_executable_session_status
    }).includes("unknown")
  ) {
    return "source_state_unknown";
  }

  if (state.payment_access_status === "access_missing") return "payment_missing";
  if (state.payment_access_status === "access_suspended") return "payment_suspended";
  if (state.workspace_status === "missing") return "workspace_missing";
  if (state.coach_account_status === "missing") return "coach_account_missing";
  if (["invited", "disabled"].includes(state.coach_account_status)) return "coach_account_inactive";
  if (state.athlete_account_status === "missing") return "athlete_account_missing";
  if (["invited", "disabled"].includes(state.athlete_account_status)) return "athlete_account_inactive";
  if (state.coach_athlete_link_status === "missing") return "coach_athlete_link_missing";
  if (["invited", "revoked", "expired", "rejected"].includes(state.coach_athlete_link_status)) return "coach_athlete_link_not_accepted";
  if (state.scope_status === "invalid") return "scope_invalid";
  if (state.scope_status === "pending") return "scope_not_locked";
  if (state.phase1_declaration_status === "missing") return "phase1_declaration_missing";
  if (["pending", "rejected", "version_mismatch"].includes(state.phase1_declaration_status)) return "phase1_declaration_not_accepted";
  if (state.compile_status === "failed") return "compile_failed";
  if (["not_started", "blocked"].includes(state.compile_status)) return "compile_not_started";
  if (state.compile_status === "passed" && state.first_executable_session_status === "missing") return "first_executable_session_missing";

  return "none";
}

function deriveDashboardStatus(state) {
  const blockedReason = deriveBlockedReason(state);

  if (blockedReason === "source_state_unknown") return "unknown";
  if (blockedReason !== "none") return "blocked";

  const ready = Object.entries(readyPreconditions).every(([key, expected]) => state[key] === expected);
  return ready ? "coach_ready" : "in_progress";
}

function forbiddenLexemes() {
  return [
    "ana" + "lytics",
    "read" + "iness",
    "recom" + "mend",
    "rank" + "ing",
    "safe" + "ty",
    "suit" + "ability",
    "opti" + "misation",
    "medi" + "cal",
    "inj" + "ury"
  ];
}

function assertNoForbiddenLexemes(value, sourceName) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  for (const token of forbiddenLexemes()) {
    assert.equal(text.toLowerCase().includes(token.toLowerCase()), false, `${sourceName} contains forbidden lexeme: ${token}`);
  }
}

function assertNoForbiddenFields(obj, sourceName) {
  const text = JSON.stringify(obj, null, 2);
  const forbiddenFields = [
    "ana" + "lytics",
    "ana" + "lytics_summary",
    "trend",
    "trend_summary",
    "read" + "iness",
    "read" + "iness_score",
    "recom" + "mendation",
    "recom" + "mended_action",
    "performance_interpretation",
    "rank" + "ing",
    "score",
    "org_id",
    "team_id",
    "gym_id",
    "unit_id",
    "organisation_runtime",
    "organization_runtime",
    "team_runtime",
    "gym_runtime",
    "unit_runtime"
  ];

  for (const field of forbiddenFields) {
    assert.equal(new RegExp(`"${field}"\\s*:`, "i").test(text), false, `${sourceName} contains forbidden field: ${field}`);
  }
}

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

run("S41_CONTRACT_001 contract is closed-world", () => {
  assert.equal(contract.additionalProperties, false);
  assert.equal(contract["x-kolosseum"].closed_world, true);
  assert.equal(contract["x-kolosseum"].operator_only, true);
  assert.equal(contract["x-kolosseum"].factual_only, true);
  assert.equal(contract["x-kolosseum"].engine_mutation, false);
});

run("S41_CONTRACT_002 valid dashboard shape passes local contract assertions", () => {
  validateClosedWorldShape(validDashboard());
});

run("S41_CONTRACT_003 extra top-level field is rejected", () => {
  const mutated = validDashboard({ ["ana" + "lytics_summary"]: {} });
  assert.throws(() => validateClosedWorldShape(mutated), /Unexpected top-level key/);
});

run("S41_CONTRACT_004 blocked reason must be controlled enum", () => {
  const mutated = validDashboard({ blocked_reason: "coach_not_ready" });
  assert.throws(() => validateClosedWorldShape(mutated), /Invalid blocked_reason/);
});

run("S41_CONTRACT_005 dashboard status must be controlled enum", () => {
  const mutated = validDashboard({ dashboard_status: "ready_for_training" });
  assert.throws(() => validateClosedWorldShape(mutated), /Invalid dashboard_status/);
});

run("S41_CONTRACT_006 next factual action must use copy id object", () => {
  const mutated = validDashboard({ next_factual_action: "Create pilot workspace." });
  assert.throws(() => validateClosedWorldShape(mutated), /next_factual_action must be object/);
});

run("S41_UNIT_001 all preconditions true returns coach_ready", () => {
  const state = validDashboard();
  assert.equal(deriveBlockedReason(state), "none");
  assert.equal(deriveDashboardStatus(state), "coach_ready");
});

run("S41_UNIT_002 unknown source state fails closed", () => {
  const state = validDashboard({ workspace_status: "unknown" });
  assert.equal(deriveBlockedReason(state), "source_state_unknown");
  assert.equal(deriveDashboardStatus(state), "unknown");
});

run("S41_UNIT_003 payment missing blocks before workspace missing", () => {
  const state = validDashboard({
    payment_access_status: "access_missing",
    workspace_status: "missing"
  });
  assert.equal(deriveBlockedReason(state), "payment_missing");
  assert.equal(deriveDashboardStatus(state), "blocked");
});

run("S41_UNIT_004 link invited is not accepted", () => {
  const state = validDashboard({ coach_athlete_link_status: "invited" });
  assert.equal(deriveBlockedReason(state), "coach_athlete_link_not_accepted");
  assert.equal(deriveDashboardStatus(state), "blocked");
});

run("S41_UNIT_005 scope invalid blocks before scope not locked", () => {
  const state = validDashboard({ scope_status: "invalid" });
  assert.equal(deriveBlockedReason(state), "scope_invalid");
  assert.equal(deriveDashboardStatus(state), "blocked");
});

run("S41_UNIT_006 phase1 pending is not accepted", () => {
  const state = validDashboard({ phase1_declaration_status: "pending" });
  assert.equal(deriveBlockedReason(state), "phase1_declaration_not_accepted");
  assert.equal(deriveDashboardStatus(state), "blocked");
});

run("S41_UNIT_007 compile failed blocks", () => {
  const state = validDashboard({ compile_status: "failed" });
  assert.equal(deriveBlockedReason(state), "compile_failed");
  assert.equal(deriveDashboardStatus(state), "blocked");
});

run("S41_UNIT_008 first executable session missing blocks after compile pass", () => {
  const state = validDashboard({
    compile_status: "passed",
    first_executable_session_status: "missing"
  });
  assert.equal(deriveBlockedReason(state), "first_executable_session_missing");
  assert.equal(deriveDashboardStatus(state), "blocked");
});

run("S41_UNIT_009 blocked priority list contains exactly blocked enum values", () => {
  assert.deepEqual([...blockedPriority].sort(), [...blockedReasons].sort());
});

run("S41_UNIT_010 coach_ready forbidden with any unknown precondition", () => {
  for (const key of Object.keys(readyPreconditions)) {
    if (key === "blocked_reason") continue;
    const state = validDashboard({ [key]: "unknown" });
    assert.notEqual(deriveDashboardStatus(state), "coach_ready", `${key} must not allow coach_ready when unknown`);
  }
});

run("S41_API_001 route is operator-only", () => {
  assert.equal(api.route.method, "GET");
  assert.equal(api.route.path, "/api/operator/pilots/{pilot_id}/dashboard");
  assert.deepEqual(api.route.auth.allowed_roles, ["operator"]);
  assert.ok(api.route.auth.forbidden_roles.includes("coach"));
  assert.ok(api.route.auth.forbidden_roles.includes("athlete"));
  assert.ok(api.route.auth.forbidden_roles.includes("entity_admin"));
});

run("S41_API_002 forbidden state source classes are coded", () => {
  assert.ok(Array.isArray(api.forbidden_state_source_classes));
  assert.equal(api.forbidden_state_source_classes.length, 10);
  for (const value of api.forbidden_state_source_classes) {
    assert.match(value, /^FSC\d{3}$/);
  }
});

run("S41_COPY_001 copy JSON has all mapped next action ids", () => {
  for (const copyId of Object.values(copy.blocked_reason_to_next_action)) {
    assert.ok(copy.entries[copyId], `Missing copy entry: ${copyId}`);
  }
});

run("S41_COPY_002 production copy JSON does not contain forbidden lexemes", () => {
  assertNoForbiddenLexemes(copy, "copy");
});

run("S41_DOC_001 production contracts do not contain forbidden implementation fields", () => {
  assertNoForbiddenFields(contract, "contract");
  assertNoForbiddenFields(api, "api");
});

run("S41_DOC_002 production docs keep operator dashboard factual", () => {
  assert.ok(doc.includes("factual operator surface"));
  assert.ok(doc.includes("Unknown state fails closed"));
  assert.ok(doc.includes("Coach Ready Rule"));
});

run("S41_NEG_001 payment access is represented as platform state only", () => {
  const text = JSON.stringify(api, null, 2) + "\n" + doc;
  assert.ok(text.includes("must not alter engine truth") || text.includes("must not alter engine"));
  assert.ok(text.includes("payment/access"));
});

console.log("S41 operator pilot dashboard tests passed.");
