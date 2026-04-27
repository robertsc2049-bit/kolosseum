import fs from "node:fs";

const docPath = "docs/pilot/S35_SPLIT_RETURN_RUNTIME_PROOF_PACK.md";
const fixturePath = "docs/pilot/fixtures/s35_split_return_runtime_proof_pack.valid.json";

const allowedEvents = new Set([
  "session_started",
  "work_item_available",
  "work_recorded",
  "session_split_recorded",
  "return_choice_available",
  "return_choice_recorded",
  "session_continued",
  "remaining_work_skipped",
  "session_partially_completed",
  "session_stopped"
]);

const allowedChoices = new Set([
  "continue_from_split_point",
  "skip_remaining_work",
  "stop_session"
]);

const requiredDocStrings = [
  "S35 - Split Return Runtime Proof Pack",
  "session_split_recorded",
  "return_choice_available",
  "return_choice_recorded",
  "session_continued",
  "remaining_work_skipped",
  "session_partially_completed",
  "session_stopped",
  "append-only",
  "phase1_mutated: false",
  "recompilation_triggered: false",
  "legality_changed: false",
  "An athlete can split a live session, return to it, continue or skip remaining work, and produce factual Phase 6 runtime events."
];

function fail(message) {
  console.error(JSON.stringify({ ok: false, slice: "S35", message }, null, 2));
  process.exit(1);
}

if (!fs.existsSync(docPath)) fail(`Missing ${docPath}`);
if (!fs.existsSync(fixturePath)) fail(`Missing ${fixturePath}`);

const doc = fs.readFileSync(docPath, "utf8");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

for (const value of requiredDocStrings) {
  if (!doc.includes(value)) fail(`Missing required S35 doc string: ${value}`);
}

if (fixture.slice !== "S35") fail("Fixture slice must be S35.");
if (fixture.proof_name !== "split_return_runtime_proof_pack") fail("Fixture proof_name mismatch.");
if (fixture.initial_session_state !== "in_progress") fail("Initial state must be in_progress.");
if (fixture.split_state !== "split_recorded") fail("split_state must be split_recorded.");
if (fixture.return_choice_available !== true) fail("return_choice_available must be true.");
if (fixture.continue_choice_recorded !== true) fail("continue_choice_recorded must be true.");
if (fixture.skip_choice_recorded !== true) fail("skip_choice_recorded must be true.");
if (fixture.stop_choice_recorded !== true) fail("stop_choice_recorded must be true.");
if (fixture.partial_session_state !== "partially_completed") fail("partial_session_state must be partially_completed.");
if (fixture.stopped_session_state !== "stopped") fail("stopped_session_state must be stopped.");
if (fixture.append_only !== true) fail("append_only must be true.");
if (fixture.phase1_mutated !== false) fail("phase1_mutated must be false.");
if (fixture.recompilation_triggered !== false) fail("recompilation_triggered must be false.");
if (fixture.legality_changed !== false) fail("legality_changed must be false.");
if (fixture.advisory_copy_present !== false) fail("advisory_copy_present must be false.");

if (!Array.isArray(fixture.events)) fail("events must be an array.");
if (fixture.events.length !== fixture.event_count) fail("event_count must match events length.");

const ids = new Set();
for (const [index, event] of fixture.events.entries()) {
  if (!event.event_id) fail(`events[${index}].event_id missing.`);
  if (ids.has(event.event_id)) fail(`Duplicate event_id ${event.event_id}.`);
  ids.add(event.event_id);

  if (event.pilot_id !== fixture.pilot_id) fail(`events[${index}].pilot_id mismatch.`);
  if (event.athlete_id !== fixture.athlete_id) fail(`events[${index}].athlete_id mismatch.`);
  if (event.session_id !== fixture.session_id) fail(`events[${index}].session_id mismatch.`);
  if (event.actor !== "athlete") fail(`events[${index}].actor must be athlete.`);
  if (!allowedEvents.has(event.event_type)) fail(`events[${index}].event_type is not allowed: ${event.event_type}`);
  if (!event.occurred_at_utc) fail(`events[${index}].occurred_at_utc missing.`);

  if (event.event_type === "session_split_recorded" && !event.split_point) {
    fail(`events[${index}].split_point missing.`);
  }

  if (event.event_type === "return_choice_recorded" && !allowedChoices.has(event.return_choice)) {
    fail(`events[${index}].return_choice invalid.`);
  }

  if (event.return_choice && !allowedChoices.has(event.return_choice)) {
    fail(`events[${index}].return_choice outside allowed set.`);
  }
}

const eventTypes = new Set(fixture.events.map((event) => event.event_type));
for (const required of [
  "session_started",
  "work_item_available",
  "session_split_recorded",
  "return_choice_available",
  "return_choice_recorded",
  "session_continued",
  "remaining_work_skipped",
  "session_partially_completed"
]) {
  if (!eventTypes.has(required)) fail(`Required event missing: ${required}`);
}

const returnChoiceAvailableIndex = fixture.events.findIndex((event) => event.event_type === "return_choice_available");
const returnChoiceRecordedIndex = fixture.events.findIndex((event) => event.event_type === "return_choice_recorded");
if (returnChoiceAvailableIndex < 0 || returnChoiceRecordedIndex < 0) fail("Return choice availability or recording missing.");
if (returnChoiceRecordedIndex <= returnChoiceAvailableIndex) fail("return_choice_recorded must occur after return_choice_available.");

if (!fixture.alternate_terminal_event) fail("alternate_terminal_event missing.");
if (fixture.alternate_terminal_event.event_type !== "session_stopped") fail("alternate_terminal_event must be session_stopped.");
if (fixture.alternate_terminal_event.actor !== "athlete") fail("alternate_terminal_event actor must be athlete.");
if (fixture.alternate_terminal_event.return_choice !== "stop_session") fail("alternate_terminal_event return_choice must be stop_session.");

console.log(JSON.stringify({ ok: true, slice: "S35", checked: [docPath, fixturePath] }, null, 2));