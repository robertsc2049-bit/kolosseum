import fs from "node:fs";

const docPath = "docs/pilot/S40_BLOCKED_STATE_SUPPORT_PACK.md";
const fixturePath = "docs/pilot/fixtures/s40_blocked_state_support_pack.valid.json";

const allowedEvents = new Set([
  "blocked_state_checked",
  "blocked_state_recorded",
  "blocked_action_refused"
]);

const allowedBlockedStates = new Set([
  "phase1_missing",
  "no_session",
  "no_link",
  "revoked_link",
  "return_missing"
]);

const allowedBlockedReasons = new Set([
  "phase1_missing",
  "session_missing",
  "coach_athlete_link_missing",
  "coach_athlete_link_revoked",
  "return_choice_missing",
  "return_point_missing"
]);

const requiredCopy = new Map([
  ["phase1_missing", "Blocked: Phase 1 declaration is missing. The pilot cannot continue until Phase 1 is accepted."],
  ["no_session", "Blocked: no live session exists for this action."],
  ["no_link", "Blocked: no accepted coach athlete link exists."],
  ["revoked_link", "Blocked: coach athlete link is revoked."],
  ["return_missing", "Blocked: return data is missing."]
]);

const requiredDocStrings = [
  "S40 - Blocked-State Support Pack",
  "phase1_missing",
  "no_session",
  "no_link",
  "revoked_link",
  "return_missing",
  "blocked_state_recorded",
  "blocked_action_refused",
  "hidden_continuation_present: false",
  "inferred_phase1_present: false",
  "inferred_link_present: false",
  "inferred_return_choice_present: false",
  "phase1_mutated: false",
  "recompilation_triggered: false",
  "legality_changed: false",
  "Live pilot blocked states are recorded factually, refuse only the requested action, and never infer missing truth, mutate Phase 1, re-run compilation, alter legality, or create advice."
];

function fail(message) {
  console.error(JSON.stringify({ ok: false, slice: "S40", message }, null, 2));
  process.exit(1);
}

if (!fs.existsSync(docPath)) fail(`Missing ${docPath}`);
if (!fs.existsSync(fixturePath)) fail(`Missing ${fixturePath}`);

const doc = fs.readFileSync(docPath, "utf8");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

for (const value of requiredDocStrings) {
  if (!doc.includes(value)) fail(`Missing required S40 doc string: ${value}`);
}

for (const copy of requiredCopy.values()) {
  if (!doc.includes(copy)) fail(`Missing required S40 operator copy: ${copy}`);
}

if (fixture.slice !== "S40") fail("Fixture slice must be S40.");
if (fixture.proof_name !== "blocked_state_support_pack") fail("Fixture proof_name mismatch.");
if (fixture.phase1_missing_blocked !== true) fail("phase1_missing_blocked must be true.");
if (fixture.no_session_blocked !== true) fail("no_session_blocked must be true.");
if (fixture.no_link_blocked !== true) fail("no_link_blocked must be true.");
if (fixture.revoked_link_blocked !== true) fail("revoked_link_blocked must be true.");
if (fixture.return_missing_blocked !== true) fail("return_missing_blocked must be true.");
if (fixture.exact_operator_copy_present !== true) fail("exact_operator_copy_present must be true.");
if (fixture.blocked_action_refused !== true) fail("blocked_action_refused must be true.");
if (fixture.hidden_continuation_present !== false) fail("hidden_continuation_present must be false.");
if (fixture.inferred_phase1_present !== false) fail("inferred_phase1_present must be false.");
if (fixture.inferred_link_present !== false) fail("inferred_link_present must be false.");
if (fixture.inferred_return_choice_present !== false) fail("inferred_return_choice_present must be false.");
if (fixture.engine_authority_created !== false) fail("engine_authority_created must be false.");
if (fixture.phase1_mutated !== false) fail("phase1_mutated must be false.");
if (fixture.recompilation_triggered !== false) fail("recompilation_triggered must be false.");
if (fixture.legality_changed !== false) fail("legality_changed must be false.");
if (fixture.engine_output_overridden !== false) fail("engine_output_overridden must be false.");
if (fixture.readiness_claim_present !== false) fail("readiness_claim_present must be false.");
if (fixture.advice_present !== false) fail("advice_present must be false.");
if (fixture.recommendation_present !== false) fail("recommendation_present must be false.");
if (fixture.judgement_present !== false) fail("judgement_present must be false.");
if (fixture.future_effect !== false) fail("future_effect must be false.");

if (!Array.isArray(fixture.blocked_cases)) fail("blocked_cases must be an array.");
if (fixture.blocked_cases.length !== fixture.blocked_case_count) fail("blocked_case_count must match blocked_cases length.");

const seenBlockedStates = new Set();
for (const blockedCase of fixture.blocked_cases) {
  if (!blockedCase.case_id) fail("blocked case_id missing.");
  if (!allowedBlockedStates.has(blockedCase.blocked_state)) fail(`blocked_state invalid: ${blockedCase.blocked_state}`);
  if (!allowedBlockedReasons.has(blockedCase.blocked_reason)) fail(`blocked_reason invalid: ${blockedCase.blocked_reason}`);
  if (blockedCase.requested_action_continued !== false) fail(`${blockedCase.case_id} must refuse requested action.`);
  if (blockedCase.operator_copy !== requiredCopy.get(blockedCase.blocked_state)) {
    fail(`${blockedCase.case_id} operator copy mismatch.`);
  }
  seenBlockedStates.add(blockedCase.blocked_state);
}

for (const requiredState of allowedBlockedStates) {
  if (!seenBlockedStates.has(requiredState)) fail(`Required blocked state missing: ${requiredState}`);
}

if (!Array.isArray(fixture.events)) fail("events must be an array.");
if (fixture.events.length !== fixture.event_count) fail("event_count must match events length.");

const ids = new Set();
for (const [index, event] of fixture.events.entries()) {
  if (!event.event_id) fail(`events[${index}].event_id missing.`);
  if (ids.has(event.event_id)) fail(`Duplicate event_id ${event.event_id}.`);
  ids.add(event.event_id);

  if (!event.pilot_id) fail(`events[${index}].pilot_id missing.`);
  if (event.actor !== "platform") fail(`events[${index}].actor must be platform.`);
  if (!allowedEvents.has(event.event_type)) fail(`events[${index}].event_type is not allowed: ${event.event_type}`);
  if (!allowedBlockedStates.has(event.blocked_state)) fail(`events[${index}].blocked_state invalid.`);
  if (!allowedBlockedReasons.has(event.blocked_reason)) fail(`events[${index}].blocked_reason invalid.`);
  if (!event.occurred_at_utc) fail(`events[${index}].occurred_at_utc missing.`);
}

for (const requiredState of allowedBlockedStates) {
  const stateEvents = fixture.events.filter((event) => event.blocked_state === requiredState);
  const stateEventTypes = new Set(stateEvents.map((event) => event.event_type));

  for (const requiredEvent of allowedEvents) {
    if (!stateEventTypes.has(requiredEvent)) {
      fail(`${requiredState} missing required event ${requiredEvent}.`);
    }
  }
}

console.log(JSON.stringify({ ok: true, slice: "S40", checked: [docPath, fixturePath] }, null, 2));