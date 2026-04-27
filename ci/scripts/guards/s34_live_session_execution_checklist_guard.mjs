import fs from "node:fs";

const docPath = "docs/pilot/S34_LIVE_SESSION_EXECUTION_CHECKLIST.md";
const fixturePath = "docs/pilot/fixtures/s34_live_session_execution_checklist.valid.json";

const allowedEvents = new Set([
  "session_started",
  "work_item_available",
  "work_item_started",
  "work_recorded",
  "work_item_completed",
  "work_item_skipped",
  "work_item_modified",
  "session_partially_completed",
  "session_completed",
  "session_stopped"
]);

const requiredDocStrings = [
  "S34 - Live Session Execution Checklist",
  "session_started",
  "work_recorded",
  "work_item_completed",
  "work_item_skipped",
  "work_item_modified",
  "session_partially_completed",
  "session_completed",
  "session_stopped",
  "append-only",
  "phase1_mutated: false",
  "recompilation_triggered: false",
  "legality_changed: false",
  "An athlete can run a live session by starting, recording work, completing work, partially completing, stopping, and producing factual Phase 6 runtime events."
];

function fail(message) {
  console.error(JSON.stringify({ ok: false, slice: "S34", message }, null, 2));
  process.exit(1);
}

if (!fs.existsSync(docPath)) fail(`Missing ${docPath}`);
if (!fs.existsSync(fixturePath)) fail(`Missing ${fixturePath}`);

const doc = fs.readFileSync(docPath, "utf8");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

for (const value of requiredDocStrings) {
  if (!doc.includes(value)) fail(`Missing required S34 doc string: ${value}`);
}

if (fixture.slice !== "S34") fail("Fixture slice must be S34.");
if (fixture.proof_name !== "live_session_execution_checklist") fail("Fixture proof_name mismatch.");
if (fixture.initial_session_state !== "in_progress") fail("Initial state must be in_progress.");
if (fixture.final_session_state !== "completed") fail("Final state must be completed.");
if (fixture.partial_session_state !== "partially_completed") fail("Partial state must be partially_completed.");
if (fixture.stopped_session_state !== "stopped") fail("Stopped state must be stopped.");
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
  if (event.event_type.startsWith("work_") && !event.work_item_id) fail(`events[${index}].work_item_id missing.`);
  if ((event.event_type === "work_recorded" || event.event_type === "work_item_modified") && !event.recorded_payload) {
    fail(`events[${index}].recorded_payload missing.`);
  }
}

const eventTypes = new Set(fixture.events.map((event) => event.event_type));
for (const required of [
  "session_started",
  "work_item_available",
  "work_item_started",
  "work_recorded",
  "work_item_completed",
  "work_item_skipped",
  "work_item_modified",
  "session_partially_completed",
  "session_completed"
]) {
  if (!eventTypes.has(required)) fail(`Required event missing: ${required}`);
}

if (!fixture.alternate_terminal_event) fail("alternate_terminal_event missing.");
if (fixture.alternate_terminal_event.event_type !== "session_stopped") fail("alternate_terminal_event must be session_stopped.");
if (fixture.alternate_terminal_event.actor !== "athlete") fail("alternate_terminal_event actor must be athlete.");

console.log(JSON.stringify({ ok: true, slice: "S34", checked: [docPath, fixturePath] }, null, 2));