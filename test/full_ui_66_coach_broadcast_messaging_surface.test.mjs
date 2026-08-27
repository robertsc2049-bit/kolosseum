// DEV NOTE: FULL-UI-66 coach broadcast messaging static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/coach_broadcast_messaging_service.ts");
const routes = read("src/api/messaging.routes.ts");
const appJs = read("public/app/app.js");
const indexHtml = read("public/app/index.html");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));
// DEV NOTE: the broadcast form and its live read-by-N-of-M receipt moved to
// React - see CoachBroadcastPanel.tsx/useCoachBroadcast.ts/
// coachWorkspaceClient.ts's sendCoachBroadcast/loadBroadcastReadStatus.
const broadcastPanel = read("public/app-src/screens/coach/CoachBroadcastPanel.tsx");
const useCoachBroadcast = read("public/app-src/screens/coach/useCoachBroadcast.ts");
const coachWorkspaceClient = read("public/app-src/api/coachWorkspaceClient.ts");

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("the broadcast route is mounted at /messages/coach/broadcast, coach-only and mutation-gated", () => {
  assert.match(routes, /messagingRouter\.post\(\s*\n?\s*"\/coach\/broadcast"/u);
  assert.match(routes, /const coachUserId = await authenticatedCoach\(request, true\);\s*\n\s*const result = await sendCoachBroadcastMessage/u);
});

test("the broadcast error type is registered in the router's own error handler", () => {
  assert.match(routes, /CoachBroadcastMessagingError/u);
  assert.match(routes, /error instanceof CoachBroadcastMessagingError/u);
});

test("broadcast has no separate record type or delivery path - it fans out over the existing per-athlete send", () => {
  assert.match(service, /listConnectedCoachAthletes/u);
  assert.match(service, /sendCoachAthleteMessage/u);
  // getBroadcastReadStatus's own read-only SELECT (below) is the one
  // deliberate exception - it never INSERTs, and delivery still goes
  // exclusively through sendCoachAthleteMessage.
  assert.doesNotMatch(service, /INSERT INTO/u);
});

test("the athlete list is always resolved fresh from the coach's own accepted relationships, never client-supplied", () => {
  assert.doesNotMatch(service, /request\.body|athlete_user_ids?\s*:\s*unknown/u);
  assert.match(service, /listConnectedCoachAthletes\(coachUserId\)/u);
});

test("an empty or over-length body_text is rejected before any send is attempted", () => {
  assert.match(service, /coach_broadcast_messaging_body_text_invalid/u);
  assert.match(service, /bodyText\.length > 4000/u);
});

test("no coach-broadcast file imports any engine-truth service", () => {
  for (const source of [service, routes]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
  }
});

test("the coach workspace has a real broadcast control wired to the route", () => {
  assert.match(indexHtml, /id="coach-broadcast-root"/u);
  assert.doesNotMatch(indexHtml, /id="coachBroadcastForm"/u);

  assert.match(broadcastPanel, /export function CoachBroadcastPanel/u);
  assert.match(broadcastPanel, /useCoachBroadcast/u);
  assert.match(coachWorkspaceClient, /export function sendCoachBroadcast/u);
  assert.match(coachWorkspaceClient, /"\/messages\/coach\/broadcast"/u);
  assert.match(useCoachBroadcast, /sendCoachBroadcast\(trimmed, csrfToken\)/u);
});

test("every fan-out send in one broadcast shares the same server-generated client_request_id, turning it into a free broadcast_id - never client-supplied, never a new column", () => {
  assert.match(service, /function randomId/u);
  assert.match(service, /const broadcastId = randomId\("broadcast"\);/u);
  assert.match(service, /sendCoachAthleteMessage\("coach", coachUserId, athleteUserId, bodyText, broadcastId, null\)/u);
  assert.match(service, /broadcast_id: broadcastId/u);
});

test("read status is re-derived live from each athlete's own thread's athlete_last_read_at marker, never a stored/cached read flag", () => {
  assert.match(service, /export async function getBroadcastReadStatus/u);
  assert.match(service, /FROM product_messages m/u);
  assert.match(service, /JOIN product_message_threads t ON t\.thread_id = m\.thread_id/u);
  assert.match(service, /m\.client_request_id = \$2/u);
  assert.match(service, /readAt\.getTime\(\) >= createdAt\.getTime\(\)/u);
});

test("the read-status route is mounted read-only under the coach broadcast prefix, coach-only", () => {
  assert.match(routes, /messagingRouter\.get\(\s*\n?\s*"\/coach\/broadcasts\/:broadcast_id\/read-status"/u);
  assert.match(routes, /const coachUserId = await authenticatedCoach\(request, false\);\s*\n\s*const status = await getBroadcastReadStatus/u);
});

test("the coach workspace shows a live read-by-N-of-M receipt after sending a broadcast, with a manual refresh control", () => {
  assert.match(broadcastPanel, /Read by \{readStatus\.readCount\} of \{readStatus\.sentCount\}/u);
  assert.match(broadcastPanel, />\s*Refresh\s*<\/button>/u);

  assert.match(coachWorkspaceClient, /export function loadBroadcastReadStatus/u);
  assert.match(coachWorkspaceClient, /\/messages\/coach\/broadcasts\/\$\{encodeURIComponent\(broadcastId\)\}\/read-status/u);
  assert.match(useCoachBroadcast, /refreshReadStatus/u);
  // Athlete display names for the read list are resolved via an
  // independent relationships fetch (React never reads legacy's
  // state.coachAthletes) - JSX escapes rendered text by default, so there's
  // no equivalent escapeHtml call to assert on here.
  assert.match(useCoachBroadcast, /loadCoachRelationships/u);
});

test("the FULL-UI-66 manifest function is declared as implemented with real tests inside the existing messaging area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "messaging");
  assert.ok(area, "expected the existing messaging product area");

  const fn = area.functions.find((entry) => entry.function_id === "coach_broadcast_message");
  assert.ok(fn, "expected a coach_broadcast_message function");
  assert.equal(fn.state, "implemented");
  assert.equal(fn.direct_test, "test/full_ui_66_coach_broadcast_messaging_surface.test.mjs");
  assert.equal(fn.integration_test, "test/full_ui_66c_coach_broadcast_messaging_persistent.integration.test.mjs");
  assert.notEqual(fn.persistence, "localStorage_only");
  assert.deepEqual(fn.actors, ["coach"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-66" && slice.state === "implemented"));
});
