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
// DEV NOTE: the profile-embedded "Assign from athlete profile" panel moved
// to React - see AthleteProfileAssignmentPanel.tsx/
// useAthleteProfileAssignment.ts. The standalone, unreachable #view-assign
// twin (assignmentCurrentState/assignmentHistoryList/assignmentCancelButton/
// recordAssignment()/cancelAssignmentForAthlete()) is deleted outright -
// it was never reachable (no nav button, no route, no data-view="assign"
// trigger). assignmentHistoryCards/renderAssignmentCurrent/
// renderAssignmentLifecycleSurfaces (and the plain-data helpers only they
// used - assignmentRecordsForAthlete/currentAssignmentForAthlete/
// assignmentTemplateRecord/Name/Version/assignmentStateBadge) are gone too:
// refreshCoachAssignments()'s render call was their only remaining live
// caller once both DOM twins it targeted were deleted, so the whole cluster
// had zero observable effect - see app.js's own DEV NOTE at the former
// #view-assign site.
const assignmentPanel = read("public/app-src/screens/coach/AthleteProfileAssignmentPanel.tsx");
const assignmentHook = read("public/app-src/screens/coach/useAthleteProfileAssignment.ts");

test("FULL-UI-06 exposes current assignment and immutable history controls", () => {
  assert.match(html, /id="athlete-profile-assignment-root"/u);
  assert.doesNotMatch(html, /id="athleteAssignmentCurrent"/u);
  assert.doesNotMatch(html, /id="view-assign"/u);
  assert.doesNotMatch(html, /id="assignmentCurrentState"/u);

  assert.doesNotMatch(application, /function renderAssignmentLifecycleSurfaces\(/u);
  assert.doesNotMatch(application, /function assignmentHistoryCards\(/u);

  assert.match(assignmentPanel, /Current assignment/u);
  assert.match(assignmentPanel, /Assignment history/u);
  assert.match(assignmentPanel, /Cancel future assignment/u);
  assert.match(assignmentHook, /function currentAssignmentOf\(/u);
  assert.match(assignmentHook, /replaceAthleteAssignment\(/u);
  assert.match(assignmentHook, /cancelAthleteAssignment\(/u);
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
  assert.match(assignmentHook, /existing session\$\{preservedCount === 1 \? "" : "s"\} remain attached to the earlier assignment/u);
  assert.match(assignmentHook, /existing session\$\{preserved === 1 \? "" : "s"\} remain preserved/u);
});

test("FULL-UI-06 fails closed against stale assignment actions", () => {
  assert.match(lifecycle, /This assignment is no longer current/u);
  assert.match(lifecycle, /assignment_status\) !==[\s\S]*"assigned"/u);
  assert.match(lifecycle, /accepted current coach-athlete relationship/u);
  assert.match(lifecycle, /loadActiveCoachTemplateById/u);
  assert.match(lifecycle, /event_programme_week_count_mismatch|week counts do not match/u);
});

// linkReplacementEvent writes the exact same beta19_event_athlete_link
// record linkAthleteToStandaloneEvent does, but built its own record
// inline rather than calling through that already-guarded function - so
// replacing an assignment with a new event link was the one write path
// that could create a same-date double-booking the direct link route
// already refuses.
test("FULL-UI-06 replacing an assignment with a new event link is guarded by the same same-date conflict check as the direct link route", () => {
  assert.match(lifecycle, /import \{\s*\n\s*FullUi09cEventLifecycleError,\s*\n\s*assertNoDateConflict,\s*\n\s*latestOwnedEvent\s*\n\s*\} from "\.\/full_ui_09c_event_lifecycle_service\.js";/u);
  assert.match(lifecycle, /const targetEvent = await latestOwnedEvent\(client, input\.coach_user_id, input\.event_id\);/u);
  assert.match(lifecycle, /await assertNoDateConflict\(client, input\.coach_user_id, input\.athlete_user_id, targetEvent\);/u);
  assert.match(
    lifecycle,
    /if \(error instanceof FullUi09cEventLifecycleError && error\.reason === "event_link_date_conflict"\) \{\s*\n\s*throw conflict\(/u
  );
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
  assert.match(assignmentHook, /version \$\{templateVersion\}/u);
  assert.match(assignmentHook, /event_id/u);
  assert.match(assignmentPanel, /No event link/u);
  assert.match(assignmentPanel, /window\.confirm\(confirmation\)/u);
  assert.match(assignmentHook, /preserved_session_count/u);
});

test("FULL-UI-06 is responsive and engine inert", () => {
  assert.match(styles, /FULL-UI-06 immutable assignment lifecycle/u);
  assert.match(styles, /@media \(max-width: 760px\)/u);
  assert.match(styles, /\.assignment-action-row/u);
  assert.doesNotMatch(lifecycle, /engine\/src|runPipelineFromDist|compileBlock|planSessionService/u);
  assert.match(lifecycle, /calls_engine: false/u);
  assert.match(lifecycle, /engine_visible: false/u);
});
