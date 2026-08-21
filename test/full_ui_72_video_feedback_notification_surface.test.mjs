// DEV NOTE: FULL-UI-72 video-feedback notification static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/product_notification_service.ts");
const schemaSql = read("schema.sql");
const appJs = read("public/app/app.js");
const routeBootstrap = read("public/app/route_bootstrap.js");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("video_feedback_received is a recognised notification type", () => {
  assert.match(service, /"video_feedback_received"/u);
});

test("a video-feedback notification is derived from the same product_video_submission_feedback row the coach reply flow writes, never a new write path", () => {
  assert.match(service, /async function deriveVideoFeedbackNotifications/u);
  assert.match(service, /FROM product_video_submission_feedback feedback/u);
  assert.match(service, /JOIN product_video_submissions submission/u);
  assert.match(service, /WHERE submission\.athlete_user_id = \$1/u);
  assert.match(service, /await deriveVideoFeedbackNotifications\(client, recipientUserId\);/u);
});

test("the notification deep-links to the athlete's own session history detail, an existing registered route - never inventing one", () => {
  assert.match(service, /athleteHistoryDetail: "athlete_history_detail"/u);
  assert.match(service, /deepLinkRouteId: DEEP_LINK_ROUTE_IDS\.athleteHistoryDetail/u);
  assert.match(service, /deepLinkParams: \{ session_id: sessionId \}/u);
  assert.match(routeBootstrap, /route_id: "athlete_history_detail"/u);
});

test("the notification carries the coach identity and submission_id as factual payload, never an inferred summary", () => {
  assert.match(service, /coach_user_id: cleanString\(row\.coach_user_id\),\s*\n\s*submission_id: cleanString\(row\.submission_id\)/u);
});

test("the notification_type check constraint is widened by an explicit migration, since CREATE TABLE IF NOT EXISTS never re-runs against an existing table", () => {
  assert.match(schemaSql, /product_notifications_full_ui_72_type_migration/u);
  assert.match(schemaSql, /DROP CONSTRAINT IF EXISTS product_notifications_notification_type_check/u);
  assert.match(schemaSql, /'video_feedback_received'/u);
});

test("the notification is never marked stale - the athlete's own session history is always their own, independent of any coach relationship", () => {
  assert.doesNotMatch(
    service.slice(
      service.indexOf("async function withTargetAvailability"),
      service.indexOf("async function withTargetAvailability") + 800
    ),
    /athleteHistoryDetail/u
  );
});

test("the athlete workspace displays a real label for this notification type", () => {
  assert.match(appJs, /video_feedback_received: "Coach feedback on your video"/u);
});

test("the FULL-UI-72 manifest function is declared as implemented with real tests inside the existing notifications area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "notifications");
  assert.ok(area, "expected the existing notifications product area");

  const fn = area.functions.find((entry) => entry.function_id === "notification_video_feedback");
  assert.ok(fn, "expected a notification_video_feedback function");
  assert.equal(fn.state, "implemented");
  assert.equal(fn.direct_test, "test/full_ui_72_video_feedback_notification_surface.test.mjs");
  assert.equal(fn.integration_test, "test/full_ui_72c_video_feedback_notification_persistent.integration.test.mjs");
  assert.notEqual(fn.persistence, "localStorage_only");
  assert.deepEqual(fn.actors, ["athlete"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-72" && slice.state === "implemented"));
});
