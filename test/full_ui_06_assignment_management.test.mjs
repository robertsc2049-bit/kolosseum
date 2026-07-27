// DEV NOTE: FULL-UI-06 immutable assignment lifecycle product proof.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(relativePath) {
  return fs.readFileSync(relativePath, "utf8");
}

const html = read("public/app/index.html");
const application = read("public/app/app.js");
const styles = read("public/app/styles.css");
const service = read("src/api/beta19_coach_workspace_service.ts");
const server = read("src/server.ts");
const lifecycle = read("src/api/product_assignment.routes.ts");

test("FULL-UI-06 exposes current assignment and immutable history controls", () => {
  for (const id of [
    "athleteAssignmentCurrent",
    "athleteAssignmentHistory",
    "athleteAssignmentCancelButton",
    "assignmentCurrentState",
    "assignmentHistoryList",
    "assignmentCancelButton"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`, "u"));
  }

  assert.match(application, /function renderAssignmentLifecycleSurfaces\(/u);
  assert.match(application, /function assignmentHistoryCards\(/u);
  assert.match(application, /assignmentStateBadge/u);
});

test("FULL-UI-06 creates replace and cancel routes", () => {
  assert.match(lifecycle, /\/athlete-assignment\/:assignment_id\/replace/u);
  assert.match(lifecycle, /\/athlete-assignment\/:assignment_id\/cancel/u);
  assert.match(server, /productAssignmentRouter/u);
  assert.match(server, /app\.use\("\/coach-workspace", productAssignmentRouter\)/u);
});

test("FULL-UI-06 appends factual replacement and cancellation records", () => {
  for (const token of [
    "replaces_assignment_id",
    "cancels_assignment_id",
    'lifecycle_action: "replace"',
    'lifecycle_action: "cancel"',
    'assignment_status: "cancelled"',
    "preserves_existing_sessions",
    "preserves_prior_sessions"
  ]) {
    assert.match(lifecycle, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }

  assert.match(lifecycle, /BEGIN/u);
  assert.match(lifecycle, /COMMIT/u);
  assert.match(lifecycle, /ROLLBACK/u);
  assert.match(lifecycle, /FOR UPDATE/u);
});

test("FULL-UI-06 preserves existing sessions and only blocks future creation", () => {
  assert.match(lifecycle, /SELECT count\(\*\)::integer AS count[\s\S]*FROM sessions/u);
  assert.doesNotMatch(lifecycle, /DELETE\s+FROM\s+sessions/iu);
  assert.doesNotMatch(lifecycle, /UPDATE\s+sessions/iu);
  assert.match(lifecycle, /cancelled_before_future_session_creation/u);
  assert.match(application, /Existing compiled sessions remain/u);
  assert.match(application, /existing session[\s\S]*remain preserved/u);
});

test("FULL-UI-06 fails closed against stale assignment actions", () => {
  assert.match(lifecycle, /This assignment is no longer current/u);
  assert.match(lifecycle, /assignment_status\) !==[\s\S]*"assigned"/u);
  assert.match(lifecycle, /accepted current coach-athlete relationship/u);
  assert.match(lifecycle, /loadActiveCoachTemplateById/u);
  assert.match(lifecycle, /event_programme_week_count_mismatch|week counts do not match/u);
});

test("FULL-UI-06 projects lifecycle state into assignment reads", () => {
  assert.match(service, /lifecycle_status/u);
  assert.match(service, /is_current/u);
  assert.match(service, /current_for_athlete/u);
  assert.match(service, /currentAssignment/u);
  assert.match(service, /latestEventLinks/u);
  assert.match(application, /assignmentStatus/u);
  assert.match(application, /isCurrent/u);
});

test("FULL-UI-06 confirms exact version and separates optional event state", () => {
  assert.match(application, /version \$\{assignmentTemplateVersion\(current\)\}/u);
  assert.match(application, /event_id/u);
  assert.match(application, /No event link/u);
  assert.match(application, /globalThis\.confirm\(confirmation\)/u);
  assert.match(application, /preserved_session_count/u);
});

test("FULL-UI-06 is responsive and engine inert", () => {
  assert.match(styles, /FULL-UI-06 immutable assignment lifecycle/u);
  assert.match(styles, /@media \(max-width: 760px\)/u);
  assert.match(styles, /\.assignment-action-row/u);
  assert.doesNotMatch(lifecycle, /engine\/src|runPipelineFromDist|compileBlock|planSessionService/u);
  assert.match(lifecycle, /calls_engine: false/u);
  assert.match(lifecycle, /engine_visible: false/u);
});
