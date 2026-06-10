import fs from "node:fs";

const docPath = "docs/pilot/S36_PARTIAL_COMPLETION_HANDLING_PACK.md";
const fixturePath = "docs/pilot/fixtures/s36_partial_completion_handling_pack.valid.json";

const allowedEvents = new Set([
  "session_started",
  "work_item_completed",
  "work_item_skipped",
  "work_item_modified",
  "work_item_incomplete",
  "session_partially_completed"
]);

const allowedIncompleteReasons = new Set([
  "session_ended_before_work_item",
  "athlete_stopped_before_completion",
  "remaining_work_not_done",
  "work_item_skipped",
  "work_item_modified_not_completed"
]);

const requiredDocStrings = [
  "S36 - Partial Completion Handling Pack",
  "work_item_incomplete",
  "session_partially_completed",
  "catch_up_claim_present: false",
  "judgement_present: false",
  "readiness_claim_present: false",
  "recommendation_present: false",
  "future_session_adjusted: false",
  "phase1_mutated: false",
  "recompilation_triggered: false",
  "legality_changed: false",
  "A partial session records completed, skipped, modified, and incomplete work as factual Phase 6 runtime state only."
];

const forbiddenDocPatterns = [
  /\bcatch-up required\b/i,
  /\bsession failed\b/i,
  /\bpoor adherence\b/i,
  /\breadiness impact\b/i,
  /\bprogression adjusted\b/i,
  /\bunderperformed\b/i
];

function fail(message) {
  console.error(JSON.stringify({ ok: false, slice: "S36", message }, null, 2));
  process.exit(1);
}

if (!fs.existsSync(docPath)) fail(`Missing ${docPath}`);
if (!fs.existsSync(fixturePath)) fail(`Missing ${fixturePath}`);

const doc = fs.readFileSync(docPath, "utf8");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

for (const value of requiredDocStrings) {
  if (!doc.includes(value)) fail(`Missing required S36 doc string: ${value}`);
}

const allowedForbiddenContextHeaders = [
  "## Forbidden Copy",
  "The following wording classes are forbidden:"
];

const scrubbedDoc = doc
  .split("\n")
  .filter((line) => !allowedForbiddenContextHeaders.some((allowed) => line.includes(allowed)))
  .filter((line) => !line.trim().startsWith("- "))
  .join("\n");

for (const pattern of forbiddenDocPatterns) {
  const hit = scrubbedDoc.match(pattern);
  if (hit) fail(`Forbidden S36 copy outside forbidden-copy list: ${hit[0]}`);
}

if (fixture.slice !== "S36") fail("Fixture slice must be S36.");
if (fixture.proof_name !== "partial_completion_handling_pack") fail("Fixture proof_name mismatch.");
if (fixture.initial_session_state !== "in_progress") fail("Initial state must be in_progress.");
if (fixture.final_session_state !== "partially_completed") fail("Final state must be partially_completed.");
if (fixture.completed_work_item_count < 1) fail("completed_work_item_count must be at least 1.");
if (fixture.incomplete_work_item_count < 1) fail("incomplete_work_item_count must be at least 1.");
if (fixture.catch_up_claim_present !== false) fail("catch_up_claim_present must be false.");
if (fixture.judgement_present !== false) fail("judgement_present must be false.");
if (fixture.readiness_claim_present !== false) fail("readiness_claim_present must be false.");
if (fixture.recommendation_present !== false) fail("recommendation_present must be false.");
if (fixture.future_session_adjusted !== false) fail("future_session_adjusted must be false.");
if (fixture.append_only !== true) fail("append_only must be true.");
if (fixture.phase1_mutated !== false) fail("phase1_mutated must be false.");
if (fixture.recompilation_triggered !== false) fail("recompilation_triggered must be false.");
if (fixture.legality_changed !== false) fail("legality_changed must be false.");

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

  if (event.event_type.startsWith("work_item_") && !event.work_item_id) {
    fail(`events[${index}].work_item_id missing.`);
  }

  if (event.event_type === "work_item_incomplete" && !allowedIncompleteReasons.has(event.incomplete_reason)) {
    fail(`events[${index}].incomplete_reason invalid.`);
  }
}

const eventTypes = new Set(fixture.events.map((event) => event.event_type));
for (const required of [
  "session_started",
  "work_item_completed",
  "work_item_incomplete",
  "session_partially_completed"
]) {
  if (!eventTypes.has(required)) fail(`Required event missing: ${required}`);
}

console.log(JSON.stringify({ ok: true, slice: "S36", checked: [docPath, fixturePath] }, null, 2));