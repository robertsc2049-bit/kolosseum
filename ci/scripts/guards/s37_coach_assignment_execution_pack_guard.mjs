
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import fs from "node:fs";

const docPath = "docs/pilot/S37_COACH_ASSIGNMENT_EXECUTION_PACK.md";
const fixturePath = "docs/pilot/fixtures/s37_coach_assignment_execution_pack.valid.json";

const allowedEvents = new Set([
  "coach_assignment_requested",
  "coach_athlete_link_verified",
  "coach_assignment_recorded",
  "athlete_session_available"
]);

const allowedLinkStatuses = new Set(["accepted"]);
const blockedLinkStatuses = new Set(["missing", "pending", "refused", "revoked", "expired"]);

const requiredDocStrings = [
  "S37 - Coach Assignment Execution Pack",
  "linked athlete",
  "coach_assignment_requested",
  "coach_athlete_link_verified",
  "coach_assignment_recorded",
  "athlete_session_available",
  "assignment_scope: coach_managed",
  "linked_athlete_only: true",
  "engine_authority_created: false",
  "phase1_mutated: false",
  "recompilation_triggered: false",
  "legality_changed: false",
  "engine_output_overridden: false",
  "A coach can assign an existing lawful session target to an accepted linked athlete, making it available as factual platform state without creating engine authority."
];

function fail(message) {
  console.error(JSON.stringify({ ok: false, slice: "S37", message }, null, 2));
  process.exit(1);
}

if (!fs.existsSync(docPath)) fail(`Missing ${docPath}`);
if (!fs.existsSync(fixturePath)) fail(`Missing ${fixturePath}`);

const doc = fs.readFileSync(docPath, "utf8");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

for (const value of requiredDocStrings) {
  if (!doc.includes(value)) fail(`Missing required S37 doc string: ${value}`);
}

if (fixture.slice !== "S37") fail("Fixture slice must be S37.");
if (fixture.proof_name !== "coach_assignment_execution_pack") fail("Fixture proof_name mismatch.");
if (!fixture.coach_id) fail("coach_id missing.");
if (!fixture.athlete_id) fail("athlete_id missing.");
if (!fixture.session_id) fail("session_id missing.");
if (!fixture.link_id) fail("link_id missing.");
if (!allowedLinkStatuses.has(fixture.link_status)) fail("link_status must be accepted.");
if (fixture.assignment_scope !== "coach_managed") fail("assignment_scope must be coach_managed.");
if (fixture.availability_status !== "available_to_athlete") fail("availability_status must be available_to_athlete.");
if (fixture.linked_athlete_only !== true) fail("linked_athlete_only must be true.");
if (fixture.unlinked_assignment_blocked !== true) fail("unlinked_assignment_blocked must be true.");
if (fixture.pending_link_assignment_blocked !== true) fail("pending_link_assignment_blocked must be true.");
if (fixture.revoked_link_assignment_blocked !== true) fail("revoked_link_assignment_blocked must be true.");
if (fixture.engine_authority_created !== false) fail("engine_authority_created must be false.");
if (fixture.phase1_mutated !== false) fail("phase1_mutated must be false.");
if (fixture.recompilation_triggered !== false) fail("recompilation_triggered must be false.");
if (fixture.legality_changed !== false) fail("legality_changed must be false.");
if (fixture.engine_output_overridden !== false) fail("engine_output_overridden must be false.");
if (fixture.readiness_claim_present !== false) fail("readiness_claim_present must be false.");
if (fixture.safety_claim_present !== false) fail("safety_claim_present must be false.");
if (fixture.recommendation_present !== false) fail("recommendation_present must be false.");

if (!Array.isArray(fixture.events)) fail("events must be an array.");
if (fixture.events.length !== fixture.event_count) fail("event_count must match events length.");

const ids = new Set();
for (const [index, event] of fixture.events.entries()) {
  if (!event.event_id) fail(`events[${index}].event_id missing.`);
  if (ids.has(event.event_id)) fail(`Duplicate event_id ${event.event_id}.`);
  ids.add(event.event_id);

  if (event.coach_id !== fixture.coach_id) fail(`events[${index}].coach_id mismatch.`);
  if (event.athlete_id !== fixture.athlete_id) fail(`events[${index}].athlete_id mismatch.`);
  if (event.session_id !== fixture.session_id) fail(`events[${index}].session_id mismatch.`);
  if (event.actor !== "coach") fail(`events[${index}].actor must be coach.`);
  if (!allowedEvents.has(event.event_type)) fail(`events[${index}].event_type is not allowed: ${event.event_type}`);
  if (!event.occurred_at_utc) fail(`events[${index}].occurred_at_utc missing.`);

  if (event.event_type === "coach_athlete_link_verified") {
    if (event.link_id !== fixture.link_id) fail(`events[${index}].link_id mismatch.`);
    if (event.link_status !== "accepted") fail(`events[${index}].link_status must be accepted.`);
  }

  if (event.event_type === "coach_assignment_recorded") {
    if (event.assignment_id !== fixture.assignment_id) fail(`events[${index}].assignment_id mismatch.`);
    if (event.assignment_scope !== "coach_managed") fail(`events[${index}].assignment_scope must be coach_managed.`);
  }

  if (event.event_type === "athlete_session_available") {
    if (event.availability_status !== "available_to_athlete") fail(`events[${index}].availability_status must be available_to_athlete.`);
  }
}

const eventTypes = new Set(fixture.events.map((event) => event.event_type));
for (const required of [
  "coach_assignment_requested",
  "coach_athlete_link_verified",
  "coach_assignment_recorded",
  "athlete_session_available"
]) {
  if (!eventTypes.has(required)) fail(`Required event missing: ${required}`);
}

if (!Array.isArray(fixture.blocked_cases)) fail("blocked_cases must be an array.");
for (const blockedCase of fixture.blocked_cases) {
  if (!blockedCase.case_id) fail("blocked case_id missing.");
  if (!blockedLinkStatuses.has(blockedCase.link_status)) fail(`blocked case link_status invalid: ${blockedCase.link_status}`);
  if (blockedCase.assignment_recorded !== false) fail(`blocked case ${blockedCase.case_id} must not record assignment.`);
  if (!blockedCase.blocked_reason) fail(`blocked case ${blockedCase.case_id} missing blocked_reason.`);
}

console.log(JSON.stringify({ ok: true, slice: "S37", checked: [docPath, fixturePath] }, null, 2));
