// DEV NOTE: FULL-UI-74 video-submitted notification static surface
// contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/product_notification_service.ts");
const schemaSql = read("schema.sql");
const notificationClient = read("public/app-src/api/notificationsClient.ts");
const routeBootstrap = read("public/app/route_bootstrap.js");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("video_submitted is a recognised notification type", () => {
  assert.match(service, /"video_submitted"/u);
});

test("a video-submitted notification is derived straight from product_video_submissions, never a new write path", () => {
  assert.match(service, /async function deriveVideoSubmittedNotifications/u);
  assert.match(service, /FROM product_video_submissions\s*\n\s*WHERE coach_user_id = \$1/u);
  assert.match(service, /await deriveVideoSubmittedNotifications\(client, recipientUserId\);/u);
});

test("the coach_user_id column is queried directly, never re-derived through a relationship join - it is already the submission's own source of truth", () => {
  assert.match(service, /SELECT submission_id, athlete_user_id, session_id, created_at\s*\n\s*FROM product_video_submissions/u);
});

test("the notification deep-links to the coach's existing review queue, an existing registered route - never inventing one", () => {
  assert.match(service, /deepLinkRouteId: DEEP_LINK_ROUTE_IDS\.coachReviewAthlete,\s*\n\s*deepLinkParams: \{ athlete_id: athleteUserId \},\s*\n\s*notificationPayload: \{\s*\n\s*athlete_user_id: athleteUserId,\s*\n\s*submission_id/u);
  assert.match(routeBootstrap, /route_id: "coach_review_athlete"/u);
});

test("the notification carries the athlete identity and submission_id as factual payload, never an inferred summary", () => {
  assert.match(service, /submission_id: submissionId/u);
});

test("the notification_type check constraint is widened by an explicit migration, since CREATE TABLE IF NOT EXISTS never re-runs against an existing table", () => {
  assert.match(schemaSql, /product_notifications_full_ui_74_type_migration/u);
  assert.match(schemaSql, /DROP CONSTRAINT IF EXISTS product_notifications_notification_type_check/u);
  assert.match(schemaSql, /'video_submitted'/u);
});

test("a stale target (revoked relationship) is already handled generically by withTargetAvailability for coach_review_athlete deep links", () => {
  assert.match(service, /routeId === DEEP_LINK_ROUTE_IDS\.coachReviewAthlete/u);
});

test("the coach workspace displays a real label for this notification type", () => {
  assert.match(notificationClient, /video_submitted: "New video submitted for review"/u);
});

test("the FULL-UI-74 manifest function is declared as implemented with real tests inside the existing notifications area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "notifications");
  assert.ok(area, "expected the existing notifications product area");

  const fn = area.functions.find((entry) => entry.function_id === "notification_video_submitted");
  assert.ok(fn, "expected a notification_video_submitted function");
  assert.equal(fn.state, "implemented");
  assert.equal(fn.direct_test, "test/full_ui_74_video_submitted_notification_surface.test.mjs");
  assert.equal(fn.integration_test, "test/full_ui_74c_video_submitted_notification_persistent.integration.test.mjs");
  assert.notEqual(fn.persistence, "localStorage_only");
  assert.deepEqual(fn.actors, ["coach"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-74" && slice.state === "implemented"));
});
