// DEV NOTE: FULL-UI-89 relationship-ended-by-athlete notification static
// surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/product_notification_service.ts");
const schemaSql = read("schema.sql");
const store = read("src/api/beta_product_record_store.ts");
const relationshipService = read("src/api/relationship_invitation_service.ts");
const notificationClient = read("public/app-src/api/notificationsClient.ts");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("relationship_ended_by_athlete is a recognised notification type", () => {
  assert.match(service, /"relationship_ended_by_athlete"/u);
});

test("beta17_relationship_athlete_ended is a recognised record type, distinct from the shared beta17_coach_relationship record", () => {
  assert.match(store, /"beta17_relationship_athlete_ended"/u);
  assert.match(store, /case "beta17_relationship_athlete_ended":/u);
});

test("athleteEndsRelationship writes the marker record alongside the existing revoked transition, never instead of it", () => {
  const fn = relationshipService.slice(
    relationshipService.indexOf("export async function athleteEndsRelationship"),
    relationshipService.length
  );
  assert.match(fn, /relationship_state: "revoked"/u);
  assert.match(fn, /await recordAthleteEndedRelationship\(/u);

  const recordFn = relationshipService.slice(
    relationshipService.indexOf("function recordAthleteEndedRelationship"),
    relationshipService.indexOf("export async function athleteEndsRelationship")
  );
  assert.match(recordFn, /record_type: "beta17_relationship_athlete_ended"/u);
  assert.match(recordFn, /persistBetaProductRecord/u);
});

test("the notification is derived from the dedicated marker record's subject_user_id (the coach), not inferred from the shared relationship record's actor_user_id", () => {
  const fn = service.slice(
    service.indexOf("async function deriveRelationshipEndedByAthleteNotifications"),
    service.indexOf("// --- Assignment created")
  );
  assert.match(fn, /record_type = 'beta17_relationship_athlete_ended'/u);
  assert.match(fn, /AND subject_user_id = \$1/u);
  assert.match(fn, /actor_user_id AS athlete_user_id/u);
  assert.match(service, /await deriveRelationshipEndedByAthleteNotifications\(client, recipientUserId\);/u);
});

test("the notification deep-links to the coach's own athlete list, matching relationship_declined/relationship_revoked's own precedent for a no-longer-active relationship", () => {
  assert.match(service, /deriveRelationshipEndedByAthleteNotifications[\s\S]*?deepLinkRouteId: DEEP_LINK_ROUTE_IDS\.coachAthletes/u);
});

test("both the beta_product_records and product_notifications type constraints are widened by explicit migrations, since CREATE TABLE IF NOT EXISTS never re-runs against an existing table", () => {
  assert.match(schemaSql, /beta_product_records_full_ui_89_type_migration/u);
  assert.match(schemaSql, /product_notifications_full_ui_89_type_migration/u);
  assert.match(schemaSql, /DROP CONSTRAINT IF EXISTS beta_product_records_type_check/u);
  assert.match(schemaSql, /DROP CONSTRAINT IF EXISTS product_notifications_notification_type_check/u);
  assert.match(schemaSql, /'beta17_relationship_athlete_ended'/u);
  assert.match(schemaSql, /'relationship_ended_by_athlete'/u);
});

test("the coach-facing UI displays a real label for this notification type", () => {
  assert.match(notificationClient, /relationship_ended_by_athlete: "Athlete ended the relationship"/u);
});

test("the FULL-UI-89 manifest function is declared as implemented with real tests inside the existing notifications area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "notifications");
  assert.ok(area, "expected the existing notifications product area");

  const fn = area.functions.find((entry) => entry.function_id === "notification_relationship_ended_by_athlete");
  assert.ok(fn, "expected a notification_relationship_ended_by_athlete function");
  assert.equal(fn.state, "implemented");
  assert.equal(fn.direct_test, "test/full_ui_89_relationship_ended_by_athlete_notification_surface.test.mjs");
  assert.equal(fn.integration_test, "test/full_ui_89c_relationship_ended_by_athlete_notification_persistent.integration.test.mjs");
  assert.notEqual(fn.persistence, "localStorage_only");
  assert.deepEqual(fn.actors, ["coach"]);

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-89" && slice.state === "implemented"));
});
