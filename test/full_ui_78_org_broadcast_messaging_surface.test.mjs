// DEV NOTE: FULL-UI-78 org-owner broadcast messaging static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/org_broadcast_messaging_service.ts");
const routes = read("src/api/org_owner.routes.ts");
const orgJs = read("public/org/org.js");
const indexHtml = read("public/org/index.html");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("the broadcast routes are mounted under /organisations/:org_id/broadcast, org-owner-only and mutation-gated for sends", () => {
  assert.match(routes, /orgOwnerRouter\.post\(\s*\n?\s*"\/organisations\/:org_id\/broadcast\/coaches"/u);
  assert.match(routes, /const \{ user_id \} = await authenticatedOrgOwner\(request, true\);\s*\n\s*const result = await sendOrgCoachBroadcastMessage/u);
  assert.match(routes, /orgOwnerRouter\.post\(\s*\n?\s*"\/organisations\/:org_id\/broadcast\/athletes"/u);
  assert.match(routes, /const \{ user_id \} = await authenticatedOrgOwner\(request, true\);\s*\n\s*const result = await sendOrgAthleteBroadcastMessage/u);
});

test("the broadcast error type is registered in the org owner router's own error handler", () => {
  assert.match(routes, /OrgBroadcastMessagingError/u);
  assert.match(routes, /error instanceof OrgBroadcastMessagingError/u);
});

test("broadcast has no separate record type or delivery path - it fans out over the existing per-recipient sends", () => {
  assert.match(service, /sendOrgCoachMessageFromOwner/u);
  assert.match(service, /sendOrgAthleteMessageFromOwner/u);
  // The read-status functions' own read-only SELECTs (below) are the
  // deliberate exception - they never INSERT, and delivery still goes
  // exclusively through the existing 1:1 senders.
  assert.doesNotMatch(service, /INSERT INTO/u);
});

test("recipient lists are always resolved fresh from the org's own active-coach/accepted-athlete state, never client-supplied", () => {
  assert.doesNotMatch(service, /request\.body|coach_user_ids?\s*:\s*unknown|athlete_user_ids?\s*:\s*unknown/u);
  assert.match(service, /activeCoachIdsForOrg\(orgId\)/u);
  assert.match(service, /resolveOrgActiveCoachAcceptedAthletes\(orgId\)/u);
});

test("an empty or over-length body_text is rejected before any send is attempted", () => {
  assert.match(service, /org_broadcast_messaging_body_text_invalid/u);
  assert.match(service, /bodyText\.length > 4000/u);
});

test("the athlete broadcast is gated to shared-visibility orgs only, matching org_athlete_messaging_service.ts's own invariant", () => {
  assert.match(service, /visibilityMode !== "shared"/u);
  assert.match(service, /org_broadcast_messaging_athletes_require_shared_visibility/u);
});

test("no org-broadcast file imports any engine-truth service", () => {
  for (const source of [service, routes]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
  }
});

test("every fan-out send in one broadcast shares the same server-generated client_request_id, turning it into a free broadcast_id - never client-supplied, never a new column", () => {
  assert.match(service, /function randomId/u);
  assert.match(service, /const broadcastId = randomId\("broadcast"\);/u);
  assert.match(service, /sendOrgCoachMessageFromOwner\(ownerUserId, orgId, coachUserId, bodyText, broadcastId\)/u);
  assert.match(service, /sendOrgAthleteMessageFromOwner\(ownerUserId, orgId, athleteUserId, bodyText, broadcastId\)/u);
  assert.match(service, /broadcast_id: broadcastId/u);
});

test("read status is re-derived live from each recipient's own thread's last-read marker, never a stored/cached read flag", () => {
  assert.match(service, /export async function getOrgCoachBroadcastReadStatus/u);
  assert.match(service, /export async function getOrgAthleteBroadcastReadStatus/u);
  assert.match(service, /FROM product_messages m/u);
  assert.match(service, /JOIN product_message_threads t ON t\.thread_id = m\.thread_id/u);
  assert.match(service, /t\.coach_last_read_at/u);
  assert.match(service, /t\.athlete_last_read_at/u);
  assert.match(service, /readAt\.getTime\(\) >= createdAt\.getTime\(\)/u);
});

test("the read-status routes are mounted read-only under the broadcast prefix, org-owner-only", () => {
  assert.match(routes, /orgOwnerRouter\.get\(\s*\n?\s*"\/organisations\/:org_id\/broadcast\/coaches\/:broadcast_id\/read-status"/u);
  assert.match(routes, /const \{ user_id \} = await authenticatedOrgOwner\(request, false\);\s*\n\s*const status = await getOrgCoachBroadcastReadStatus/u);
  assert.match(routes, /orgOwnerRouter\.get\(\s*\n?\s*"\/organisations\/:org_id\/broadcast\/athletes\/:broadcast_id\/read-status"/u);
  assert.match(routes, /const \{ user_id \} = await authenticatedOrgOwner\(request, false\);\s*\n\s*const status = await getOrgAthleteBroadcastReadStatus/u);
});

test("the org owner workspace has a real broadcast control wired to both routes, with an audience-aware read-by-N-of-M receipt", () => {
  assert.match(indexHtml, /id="orgBroadcastForm"/u);
  assert.match(indexHtml, /id="orgBroadcastAudience"/u);
  assert.match(indexHtml, /id="orgBroadcastAudienceAthletesOption"/u);
  assert.match(indexHtml, /id="orgBroadcastText"/u);
  assert.match(indexHtml, /id="orgBroadcastRefreshButton"/u);

  assert.match(orgJs, /function sendBroadcast\(event\)/u);
  assert.match(orgJs, /function refreshBroadcastReadStatus\(\)/u);
  assert.match(orgJs, /\/broadcast\/\$\{audience\}/u);
  assert.match(orgJs, /Read by \$\{status\.read_count\} of \$\{status\.sent_count\}/u);
  assert.match(orgJs, /el\("orgBroadcastForm"\)\.addEventListener\("submit", \(event\) => sendBroadcast\(event\)/u);
});

test("the Athletes broadcast audience option is disabled outside shared-visibility orgs, matching the athlete-messaging boundary refreshMessages() already computes", () => {
  assert.match(orgJs, /function updateBroadcastAudienceAvailability/u);
  assert.match(orgJs, /athleteOption\.disabled = !state\.orgHasSharedVisibility/u);
  assert.match(orgJs, /state\.orgHasSharedVisibility = orgHasSharedVisibility/u);
});

test("the FULL-UI-78 manifest functions are declared as implemented with real tests inside the existing organisation_billing area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "organisation_billing");
  assert.ok(area, "expected the existing organisation_billing product area");

  for (const [functionId, actors] of [
    ["org_coach_broadcast_message", ["org_owner"]],
    ["org_athlete_broadcast_message", ["org_owner"]]
  ]) {
    const fn = area.functions.find((entry) => entry.function_id === functionId);
    assert.ok(fn, `expected a ${functionId} function`);
    assert.equal(fn.state, "implemented");
    assert.equal(fn.direct_test, "test/full_ui_78_org_broadcast_messaging_surface.test.mjs");
    assert.equal(fn.integration_test, "test/full_ui_78c_org_broadcast_messaging_persistent.integration.test.mjs");
    assert.notEqual(fn.persistence, "localStorage_only");
    assert.deepEqual(fn.actors, actors);
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-78" && slice.state === "implemented"));
});
