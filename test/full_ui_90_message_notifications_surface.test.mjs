// DEV NOTE: FULL-UI-90 message-notification static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/product_notification_service.ts");
const schemaSql = read("schema.sql");
const notificationClient = read("public/app-src/api/notificationsClient.ts");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("coach_athlete_message_received and org_owner_message_received are recognised notification types", () => {
  assert.match(service, /"coach_athlete_message_received"/u);
  assert.match(service, /"org_owner_message_received"/u);
});

test("deriveCoachAthleteMessageNotifications covers both directions, gated on the recipient's own last-read marker, never the sender's", () => {
  const fn = service.slice(
    service.indexOf("async function deriveCoachAthleteMessageNotifications"),
    service.indexOf("async function deriveOrgOwnerMessageNotifications")
  );

  assert.match(fn, /thread_type = 'coach_athlete'/u);
  assert.match(fn, /t\.coach_user_id = \$1/u);
  assert.match(fn, /m\.sender_role = 'athlete'/u);
  assert.match(fn, /m\.created_at > COALESCE\(t\.coach_last_read_at, '-infinity'::timestamptz\)/u);

  assert.match(fn, /t\.athlete_user_id = \$1/u);
  assert.match(fn, /m\.sender_role = 'coach'/u);
  assert.match(fn, /m\.created_at > COALESCE\(t\.athlete_last_read_at, '-infinity'::timestamptz\)/u);

  assert.match(fn, /notificationType: "coach_athlete_message_received"/u);
  assert.match(service, /await deriveCoachAthleteMessageNotifications\(client, recipientUserId\);/u);
});

test("the coach-recipient direction deep-links to the coach's own athlete detail view (the target-availability guard already generically applies to this route id)", () => {
  const fn = service.slice(
    service.indexOf("async function deriveCoachAthleteMessageNotifications"),
    service.indexOf("async function deriveOrgOwnerMessageNotifications")
  );
  assert.match(fn, /deepLinkRouteId: DEEP_LINK_ROUTE_IDS\.coachAthleteDetail/u);
  assert.match(fn, /deepLinkParams: \{ athlete_id: athleteUserId \}/u);
});

test("the athlete-recipient direction deep-links to the shared account view, with no relationship-scoped target-availability check needed", () => {
  const fn = service.slice(
    service.indexOf("async function deriveCoachAthleteMessageNotifications"),
    service.indexOf("async function deriveOrgOwnerMessageNotifications")
  );
  assert.match(fn, /deepLinkRouteId: DEEP_LINK_ROUTE_IDS\.sharedAccount/u);
});

test("deriveOrgOwnerMessageNotifications covers both org-owner directions, sender is always the org owner, gated on the recipient's own last-read marker", () => {
  const fn = service.slice(
    service.indexOf("async function deriveOrgOwnerMessageNotifications"),
    service.indexOf("async function deriveNotificationsForRecipient")
  );

  assert.match(fn, /thread_type = 'org_owner_coach'/u);
  assert.match(fn, /thread_type = 'org_owner_athlete'/u);
  const senderRoleMatches = [...fn.matchAll(/m\.sender_role = 'org_owner'/gu)];
  assert.equal(senderRoleMatches.length, 2, "expected both branches to require sender_role = 'org_owner'");

  assert.match(fn, /m\.created_at > COALESCE\(t\.coach_last_read_at, '-infinity'::timestamptz\)/u);
  assert.match(fn, /m\.created_at > COALESCE\(t\.athlete_last_read_at, '-infinity'::timestamptz\)/u);

  assert.match(fn, /JOIN product_organisations o ON o\.org_id = t\.org_id/u);
  assert.match(fn, /notificationPayload: \{ org_id: cleanString\(row\.org_id\), org_name: cleanString\(row\.org_name\) \}/u);
  assert.match(fn, /notificationType: "org_owner_message_received"/u);
  assert.match(service, /await deriveOrgOwnerMessageNotifications\(client, recipientUserId\);/u);
});

test("both message source records key off the message's own message_id, so a given message can only ever produce one notification per recipient", () => {
  const coachAthleteFn = service.slice(
    service.indexOf("async function deriveCoachAthleteMessageNotifications"),
    service.indexOf("async function deriveOrgOwnerMessageNotifications")
  );
  const orgOwnerFn = service.slice(
    service.indexOf("async function deriveOrgOwnerMessageNotifications"),
    service.indexOf("async function deriveNotificationsForRecipient")
  );

  for (const fn of [coachAthleteFn, orgOwnerFn]) {
    assert.match(fn, /sourceRecordType: "product_messages"/u);
    assert.match(fn, /sourceRecordId: cleanString\(row\.message_id\)/u);
  }
});

test("the product_notifications type constraint is widened by an explicit migration, since CREATE TABLE IF NOT EXISTS never re-runs against an existing table", () => {
  assert.match(schemaSql, /product_notifications_full_ui_90_type_migration/u);
  assert.match(schemaSql, /DROP CONSTRAINT IF EXISTS product_notifications_notification_type_check/u);
  assert.match(schemaSql, /'coach_athlete_message_received'/u);
  assert.match(schemaSql, /'org_owner_message_received'/u);
});

test("the UI displays real labels for both notification types, and can resolve an org name as the notification subject", () => {
  assert.match(notificationClient, /coach_athlete_message_received: "New message"/u);
  assert.match(notificationClient, /org_owner_message_received: "New message from your organisation"/u);
  assert.match(notificationClient, /if \(record\.org_name\) \{\s*return String\(record\.org_name\);\s*\}/u);
});

test("the FULL-UI-90 manifest functions are declared as implemented with real tests inside the existing notifications area", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "notifications");
  assert.ok(area, "expected the existing notifications product area");

  for (const functionId of ["notification_coach_athlete_message", "notification_org_owner_message"]) {
    const fn = area.functions.find((entry) => entry.function_id === functionId);
    assert.ok(fn, `expected a ${functionId} function`);
    assert.equal(fn.state, "implemented");
    assert.equal(fn.direct_test, "test/full_ui_90_message_notifications_surface.test.mjs");
    assert.equal(fn.integration_test, "test/full_ui_90c_message_notifications_persistent.integration.test.mjs");
    assert.notEqual(fn.persistence, "localStorage_only");
    assert.deepEqual(fn.actors, ["athlete", "coach"]);
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-90" && slice.state === "implemented"));
});

test("messaging services themselves remain untouched - notification creation stays purely read-time derived, never a write-time hook", () => {
  for (const file of [
    "src/api/coach_athlete_messaging_service.ts",
    "src/api/org_coach_messaging_service.ts",
    "src/api/org_athlete_messaging_service.ts"
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /notification/iu, `expected ${file} to have no notification coupling`);
  }
});
