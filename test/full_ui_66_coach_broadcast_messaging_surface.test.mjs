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
  assert.doesNotMatch(service, /INSERT INTO|pool\.query/u);
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
  assert.match(indexHtml, /id="coachBroadcastForm"/u);
  assert.match(indexHtml, /id="coachBroadcastBodyText"/u);

  assert.match(appJs, /coachBroadcastForm: document\.getElementById\("coachBroadcastForm"\)/u);
  assert.match(appJs, /async function confirmSendCoachBroadcast/u);
  assert.match(appJs, /"\/messages\/coach\/broadcast"/u);
  assert.match(appJs, /elements\.coachBroadcastForm\.addEventListener\("submit"/u);
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
