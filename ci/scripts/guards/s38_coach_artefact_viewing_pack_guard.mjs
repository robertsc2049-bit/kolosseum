
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import fs from "node:fs";

const docPath = "docs/pilot/S38_COACH_ARTEFACT_VIEWING_PACK.md";
const fixturePath = "docs/pilot/fixtures/s38_coach_artefact_viewing_pack.valid.json";

const allowedEvents = new Set([
  "coach_artefact_view_requested",
  "coach_athlete_link_verified",
  "coach_artefact_view_rendered"
]);

const allowedArtefactTypes = new Set([
  "phase1_acceptance_summary",
  "session_assignment_record",
  "session_availability_record",
  "session_started_event",
  "work_item_event",
  "session_partially_completed_event",
  "session_completed_event",
  "session_stopped_event",
  "split_return_event"
]);

const allowedDisplayedFields = new Set([
  "artefact_id",
  "artefact_type",
  "coach_id",
  "athlete_id",
  "link_id",
  "session_id",
  "event_id",
  "event_type",
  "occurred_at_utc",
  "created_at_utc",
  "status",
  "factual_payload",
  "source_record_id"
]);

const blockedLinkStatuses = new Set(["missing", "pending", "refused", "revoked", "expired"]);

const requiredDocStrings = [
  "S38 - Coach Artefact Viewing Pack",
  "factual artefacts",
  "no analytics",
  "no readiness",
  "no advice",
  "coach_artefact_view_requested",
  "coach_athlete_link_verified",
  "coach_artefact_view_rendered",
  "view_mode: read_only",
  "visibility_status: visible_to_linked_coach",
  "factual_artefacts_only: true",
  "analytics_present: false",
  "readiness_claim_present: false",
  "advice_present: false",
  "recommendation_present: false",
  "judgement_present: false",
  "A coach can view factual artefacts for an accepted linked athlete in read-only mode only, with no analytics, readiness, advice, recommendation, judgement, or engine authority."
];

function fail(message) {
  console.error(JSON.stringify({ ok: false, slice: "S38", message }, null, 2));
  process.exit(1);
}

if (!fs.existsSync(docPath)) fail(`Missing ${docPath}`);
if (!fs.existsSync(fixturePath)) fail(`Missing ${fixturePath}`);

const doc = fs.readFileSync(docPath, "utf8");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

for (const value of requiredDocStrings) {
  if (!doc.includes(value)) fail(`Missing required S38 doc string: ${value}`);
}

if (fixture.slice !== "S38") fail("Fixture slice must be S38.");
if (fixture.proof_name !== "coach_artefact_viewing_pack") fail("Fixture proof_name mismatch.");
if (!fixture.coach_id) fail("coach_id missing.");
if (!fixture.athlete_id) fail("athlete_id missing.");
if (!fixture.link_id) fail("link_id missing.");
if (!fixture.artefact_id) fail("artefact_id missing.");
if (!allowedArtefactTypes.has(fixture.artefact_type)) fail("artefact_type invalid.");
if (fixture.link_status !== "accepted") fail("link_status must be accepted.");
if (fixture.view_mode !== "read_only") fail("view_mode must be read_only.");
if (fixture.visibility_status !== "visible_to_linked_coach") fail("visibility_status must be visible_to_linked_coach.");
if (fixture.factual_artefacts_only !== true) fail("factual_artefacts_only must be true.");
if (fixture.analytics_present !== false) fail("analytics_present must be false.");
if (fixture.readiness_claim_present !== false) fail("readiness_claim_present must be false.");
if (fixture.advice_present !== false) fail("advice_present must be false.");
if (fixture.recommendation_present !== false) fail("recommendation_present must be false.");
if (fixture.judgement_present !== false) fail("judgement_present must be false.");
if (fixture.score_present !== false) fail("score_present must be false.");
if (fixture.ranking_present !== false) fail("ranking_present must be false.");
if (fixture.safety_claim_present !== false) fail("safety_claim_present must be false.");
if (fixture.medical_claim_present !== false) fail("medical_claim_present must be false.");
if (fixture.unlinked_artefact_view_blocked !== true) fail("unlinked_artefact_view_blocked must be true.");
if (fixture.pending_link_view_blocked !== true) fail("pending_link_view_blocked must be true.");
if (fixture.revoked_link_view_blocked !== true) fail("revoked_link_view_blocked must be true.");
if (fixture.engine_authority_created !== false) fail("engine_authority_created must be false.");
if (fixture.phase1_mutated !== false) fail("phase1_mutated must be false.");
if (fixture.recompilation_triggered !== false) fail("recompilation_triggered must be false.");
if (fixture.legality_changed !== false) fail("legality_changed must be false.");
if (fixture.engine_output_overridden !== false) fail("engine_output_overridden must be false.");

if (!Array.isArray(fixture.events)) fail("events must be an array.");
if (fixture.events.length !== fixture.event_count) fail("event_count must match events length.");

const ids = new Set();
for (const [index, event] of fixture.events.entries()) {
  if (!event.event_id) fail(`events[${index}].event_id missing.`);
  if (ids.has(event.event_id)) fail(`Duplicate event_id ${event.event_id}.`);
  ids.add(event.event_id);

  if (event.coach_id !== fixture.coach_id) fail(`events[${index}].coach_id mismatch.`);
  if (event.athlete_id !== fixture.athlete_id) fail(`events[${index}].athlete_id mismatch.`);
  if (event.artefact_id !== fixture.artefact_id) fail(`events[${index}].artefact_id mismatch.`);
  if (event.artefact_type !== fixture.artefact_type) fail(`events[${index}].artefact_type mismatch.`);
  if (event.actor !== "coach") fail(`events[${index}].actor must be coach.`);
  if (!allowedEvents.has(event.event_type)) fail(`events[${index}].event_type is not allowed: ${event.event_type}`);
  if (!event.occurred_at_utc) fail(`events[${index}].occurred_at_utc missing.`);

  if (event.event_type === "coach_athlete_link_verified") {
    if (event.link_id !== fixture.link_id) fail(`events[${index}].link_id mismatch.`);
    if (event.link_status !== "accepted") fail(`events[${index}].link_status must be accepted.`);
  }

  if (event.event_type === "coach_artefact_view_rendered") {
    if (event.view_mode !== "read_only") fail(`events[${index}].view_mode must be read_only.`);
    if (event.visibility_status !== "visible_to_linked_coach") fail(`events[${index}].visibility_status must be visible_to_linked_coach.`);
    if (!Number.isInteger(event.displayed_field_count) || event.displayed_field_count < 1) fail(`events[${index}].displayed_field_count invalid.`);
    if (!Array.isArray(event.displayed_fields)) fail(`events[${index}].displayed_fields must be an array.`);
    if (event.displayed_fields.length !== event.displayed_field_count) fail(`events[${index}].displayed_field_count mismatch.`);
    for (const field of event.displayed_fields) {
      if (!allowedDisplayedFields.has(field)) fail(`events[${index}].displayed field not allowed: ${field}`);
    }
  }
}

const eventTypes = new Set(fixture.events.map((event) => event.event_type));
for (const required of [
  "coach_artefact_view_requested",
  "coach_athlete_link_verified",
  "coach_artefact_view_rendered"
]) {
  if (!eventTypes.has(required)) fail(`Required event missing: ${required}`);
}

if (!Array.isArray(fixture.blocked_cases)) fail("blocked_cases must be an array.");
for (const blockedCase of fixture.blocked_cases) {
  if (!blockedCase.case_id) fail("blocked case_id missing.");
  if (blockedCase.link_status && !blockedLinkStatuses.has(blockedCase.link_status)) {
    fail(`blocked case link_status invalid: ${blockedCase.link_status}`);
  }
  if (blockedCase.view_rendered !== false) fail(`blocked case ${blockedCase.case_id} must not render view.`);
  if (!blockedCase.blocked_reason) fail(`blocked case ${blockedCase.case_id} missing blocked_reason.`);
}

console.log(JSON.stringify({ ok: true, slice: "S38", checked: [docPath, fixturePath] }, null, 2));
