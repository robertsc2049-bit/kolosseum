// DEV NOTE: FULL-UI-91 org-owner message-notification static surface
// contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const service = read("src/api/product_notification_service.ts");
const schemaSql = read("schema.sql");
const serverTs = read("src/server.ts");
const orgOwnerNotificationRoutes = read("src/api/org_owner_notification.routes.ts");
const orgJs = read("public/org/org.js");
const indexHtml = read("public/org/index.html");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

test("owner_message_received_from_coach and owner_message_received_from_athlete are recognised notification types", () => {
  assert.match(service, /"owner_message_received_from_coach"/u);
  assert.match(service, /"owner_message_received_from_athlete"/u);
});

test("deriveMessageNotificationsForOrgOwner is the mirror of deriveOrgOwnerMessageNotifications, gated on the owner's own last-read marker, aggregated across every org the owner owns", () => {
  const fn = service.slice(
    service.indexOf("async function deriveMessageNotificationsForOrgOwner"),
    service.indexOf("async function deriveNotificationsForRecipient")
  );

  assert.match(fn, /thread_type = 'org_owner_coach'/u);
  assert.match(fn, /thread_type = 'org_owner_athlete'/u);
  assert.match(fn, /m\.sender_role = 'coach'/u);
  assert.match(fn, /m\.sender_role = 'athlete'/u);

  const ownerLastReadMatches = [...fn.matchAll(/m\.created_at > COALESCE\(t\.owner_last_read_at, '-infinity'::timestamptz\)/gu)];
  assert.equal(ownerLastReadMatches.length, 2, "expected both branches to gate on the owner's own last-read marker, not the coach/athlete columns");
  assert.doesNotMatch(fn, /coach_last_read_at|athlete_last_read_at/u);

  assert.match(fn, /JOIN product_organisations o ON o\.org_id = t\.org_id/u);
  const ownerFilterMatches = [...fn.matchAll(/o\.owner_user_id = \$1/gu)];
  assert.equal(ownerFilterMatches.length, 2, "expected both branches scoped to every org this owner owns, not one org_id");

  assert.match(fn, /notificationType: "owner_message_received_from_coach"/u);
  assert.match(fn, /notificationType: "owner_message_received_from_athlete"/u);
  assert.match(fn, /coach_user_id: cleanString\(row\.coach_user_id\)/u);
  assert.match(fn, /athlete_user_id: cleanString\(row\.athlete_user_id\)/u);
  assert.match(fn, /deepLinkRouteId: DEEP_LINK_ROUTE_IDS\.orgMessages/u);

  assert.match(service, /await deriveMessageNotificationsForOrgOwner\(client, recipientUserId\);/u);
});

test("both branches key off the message's own message_id, so a given message can only ever produce one notification for the owner", () => {
  const fn = service.slice(
    service.indexOf("async function deriveMessageNotificationsForOrgOwner"),
    service.indexOf("async function deriveNotificationsForRecipient")
  );
  const sourceRecordIdMatches = [...fn.matchAll(/sourceRecordId: cleanString\(row\.message_id\)/gu)];
  assert.equal(sourceRecordIdMatches.length, 2);
});

test("the stale 'org owner as recipient is out of scope' DEV NOTE was corrected, not left contradicting the code below it", () => {
  assert.doesNotMatch(service, /2 directions where an org\n?\s*owner would be the recipient.*are out of scope/su);
});

test("the org_messages deep-link route id is documented as an org-console sentinel, not a public/app/route_bootstrap.js PRODUCT_ROUTE_MAP entry", () => {
  assert.match(service, /orgMessages:\s*"org_messages"/u);
});

test("the product_notifications recipient FK is relaxed and the type constraint is widened by explicit migrations, since CREATE TABLE IF NOT EXISTS never re-runs against an existing table", () => {
  assert.match(schemaSql, /product_notifications_full_ui_91_recipient_fk_relaxation/u);
  assert.match(schemaSql, /DROP CONSTRAINT IF EXISTS product_notifications_recipient_user_id_fkey/u);
  assert.match(schemaSql, /product_notifications_full_ui_91_type_migration/u);
  assert.match(schemaSql, /'owner_message_received_from_coach'/u);
  assert.match(schemaSql, /'owner_message_received_from_athlete'/u);
});

test("a dedicated org-owner notification router mirrors the coach/athlete one, authenticated via authenticatedOrgOwner, and is mounted at /org", () => {
  assert.match(orgOwnerNotificationRoutes, /import \{ authenticatedOrgOwner \} from "\.\/org_owner_auth\.js";/u);
  for (const route of [
    '"/notifications"',
    '"/notifications/unread-count"',
    '"/notifications/:notification_id/read"',
    '"/notifications/:notification_id/unread"',
    '"/notifications/mark-all-read"'
  ]) {
    assert.ok(orgOwnerNotificationRoutes.includes(route), `expected route ${route}`);
  }
  const authCalls = [...orgOwnerNotificationRoutes.matchAll(/authenticatedOrgOwner\(request,\s*(?:false|true)\)/gu)];
  assert.equal(authCalls.length, 5, "every one of the 5 endpoints must resolve identity from authenticatedOrgOwner");
  assert.doesNotMatch(orgOwnerNotificationRoutes, /request\.body\.user_id|request\.query\.user_id/u);

  assert.match(serverTs, /import \{ orgOwnerNotificationRouter \} from "\.\/api\/org_owner_notification\.routes\.js";/u);
  assert.match(serverTs, /app\.use\("\/org", orgOwnerNotificationRouter\);/u);
});

test("messaging services stay untouched - notification creation remains purely read-time derived, never a write-time hook", () => {
  for (const file of [
    "src/api/coach_athlete_messaging_service.ts",
    "src/api/org_coach_messaging_service.ts",
    "src/api/org_athlete_messaging_service.ts"
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /notification/iu, `expected ${file} to have no notification coupling`);
  }
});

test("the org console has a persistent bell/badge, minimal by design - grouped by organisation, no per-notification read/unread UI, no polling", () => {
  assert.match(indexHtml, /id="orgNotificationBellButton"/u);
  assert.match(indexHtml, /id="orgNotificationUnreadBadge"/u);
  assert.match(indexHtml, /id="orgNotificationPanel"/u);
  // The bell/badge markup lives inside the one persistent authenticated
  // section - confirmed only sign-in/sign-out ever toggle its hidden state.
  const workspaceSection = indexHtml.slice(
    indexHtml.indexOf('id="orgWorkspaceSection"'),
    indexHtml.indexOf("</section>", indexHtml.indexOf('id="orgWorkspaceSection"'))
  );
  assert.match(workspaceSection, /id="orgNotificationBellButton"/u);

  assert.match(orgJs, /async function refreshNotificationBadge\(/u);
  assert.match(orgJs, /async function openNotificationPanel\(/u);
  assert.match(orgJs, /GET",\s*"\/org\/notifications\/unread-count"/u);
  assert.match(orgJs, /GET",\s*"\/org\/notifications"/u);
  assert.match(orgJs, /POST",\s*"\/org\/notifications\/mark-all-read"/u);

  // No per-notification read/unread toggle UI and no polling - the
  // per-thread badge already shipped for FULL-UI-90/messaging gives that
  // precision inside one org's thread list; this bell is a coarser nudge.
  assert.doesNotMatch(orgJs, /notifications\/[^"]*\/read"|notifications\/[^"]*\/unread"/u);
  assert.doesNotMatch(orgJs, /setInterval/u);

  assert.match(orgJs, /refreshNotificationBadge\(\)/u);
  assert.match(orgJs, /el\("orgNotificationBellButton"\)\.addEventListener\("click"/u);
});

test("the FULL-UI-91 manifest functions are declared as implemented in the organisation_billing area (org-owner-actor functions), with real tests", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "organisation_billing");
  assert.ok(area, "expected the existing organisation_billing product area");

  for (const functionId of ["org_owner_notification_coach_message", "org_owner_notification_athlete_message"]) {
    const fn = area.functions.find((entry) => entry.function_id === functionId);
    assert.ok(fn, `expected a ${functionId} function`);
    assert.equal(fn.state, "implemented");
    assert.equal(fn.direct_test, "test/full_ui_91_org_owner_message_notifications_surface.test.mjs");
    assert.equal(fn.integration_test, "test/full_ui_91c_org_owner_message_notifications_persistent.integration.test.mjs");
    assert.notEqual(fn.persistence, "localStorage_only");
    assert.deepEqual(fn.actors, ["org_owner"]);
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-91" && slice.state === "implemented"));
});
