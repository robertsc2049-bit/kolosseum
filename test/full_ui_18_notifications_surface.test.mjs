// DEV NOTE: FULL-UI-18 factual in-product notifications static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("public/app/index.html");
const css = read("public/app/styles.css");
const js = read("public/app/app.js");
const routeBootstrap = read("public/app/route_bootstrap.js");
const notificationService = read("src/api/product_notification_service.ts");
const notificationNoteDerivation = read("src/api/product_notification_note_derivation.ts");
const notificationRoutes = read("src/api/product_notification.routes.ts");
const serverTs = read("src/server.ts");

test("notification routes are mounted and delegate to the notification service", () => {
  assert.match(serverTs, /productNotificationRouter/u);
  assert.match(notificationRoutes, /"\/notifications"/u);
  assert.match(notificationRoutes, /"\/notifications\/unread-count"/u);
  assert.match(notificationRoutes, /"\/notifications\/:notification_id\/read"/u);
  assert.match(notificationRoutes, /"\/notifications\/:notification_id\/unread"/u);
  assert.match(notificationRoutes, /"\/notifications\/mark-all-read"/u);

  assert.match(notificationRoutes, /listNotificationsForRecipient/u);
  assert.match(notificationRoutes, /getUnreadNotificationCount/u);
  assert.match(notificationRoutes, /markNotificationRead/u);
  assert.match(notificationRoutes, /markNotificationUnread/u);
  assert.match(notificationRoutes, /markAllNotificationsRead/u);
});

test("every declared notification type is derived from an explicit, already-durable product event", () => {
  const declaredTypes = [
    "relationship_invited", "relationship_accepted", "relationship_declined", "relationship_revoked",
    "assignment_created", "assignment_replaced", "assignment_cancelled",
    "event_linked", "event_unlinked", "event_cancelled",
    "programme_available", "session_completed", "coach_note_visible", "billing_action_required"
  ];

  const combinedSource = notificationService + notificationNoteDerivation;
  for (const type of declaredTypes) {
    assert.match(combinedSource, new RegExp(`"${type}"`, "u"), `${type} must be a declared notification type`);
  }

  // Each derivation reads from an already-durable source table, never an
  // ephemeral in-request computation.
  assert.match(notificationService, /FROM beta_product_records/u);
  assert.match(notificationNoteDerivation, /FROM product_coach_notes/u);
  assert.match(notificationService, /FROM product_commercial_records/u);
  assert.match(notificationService, /getSessionStateQuery/u);

  // Natural-key + ON CONFLICT DO NOTHING makes repeated derivation idempotent.
  assert.match(
    notificationService,
    /ON CONFLICT \(recipient_user_id, notification_type, source_record_id\) DO NOTHING/u
  );
});

test("notifications never carry inferred urgency, priority, risk or recommendation language", () => {
  assert.doesNotMatch(notificationService, /\burgent\b|\bpriority\b|\brisk\b|\brecommend/iu);
  assert.doesNotMatch(notificationRoutes, /\burgent\b|\bpriority\b|\brisk\b|\brecommend/iu);
});

test("every deep link route_id used by a notification exists in the real product route map", () => {
  const usedRouteIds = [...notificationService.matchAll(/(?:athleteToday|coachAthleteDetail|coachAthletes|coachReviewAthlete|sharedAccount):\s*"([a-z_]+)"/gu)]
    .map(([, routeId]) => routeId);

  assert.ok(usedRouteIds.length > 0, "expected at least one deep-link route_id constant");

  for (const routeId of new Set(usedRouteIds)) {
    assert.match(
      routeBootstrap,
      new RegExp(`route_id: "${routeId}"`, "u"),
      `deep link route_id "${routeId}" must exist in PRODUCT_ROUTE_MAP`
    );
  }
});

test("read state, mark-all-read and permission (own recipient only) are enforced", () => {
  assert.match(notificationService, /read_at\s*=\s*now\(\)/u);
  assert.match(notificationService, /read\s*\?\s*"now\(\)"\s*:\s*"NULL"/u);
  assert.match(notificationService, /markAllNotificationsRead/u);

  // Every mutation is scoped by the caller's own resolved recipient id, not
  // a client-supplied one - the routes file never reads a recipient id out
  // of the request body or params.
  assert.match(notificationRoutes, /resolveProductSession/u);
  assert.doesNotMatch(notificationRoutes, /request\.body\.(recipient_user_id|user_id)/u);
  assert.match(notificationService, /WHERE recipient_user_id = \$1 AND notification_id = \$2/u);
});

test("target availability is derived, not assumed - a stale relationship makes a specific deep link unavailable without deleting the notification", () => {
  assert.match(notificationService, /target_available/u);
  assert.match(notificationService, /isCoachAthleteRelationshipActive/u);
  assert.match(notificationService, /state !== "revoked" && state !== "declined"/u);
});

test("notification bell, panel, loading, unavailable and empty states exist and are real focusable controls", () => {
  for (const id of [
    "notificationBellButton", "notificationUnreadBadge", "notificationPanel",
    "notificationMarkAllReadButton", "notificationLoading", "notificationServiceUnavailable",
    "notificationRetryButton", "notificationEmpty", "notificationList"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Expected ${id}`);
  }

  for (const id of ["notificationBellButton", "notificationMarkAllReadButton", "notificationRetryButton"]) {
    const re = new RegExp(`<button[^>]*id="${id}"[^>]*type="button"`, "u");
    assert.match(html, re, `${id} must be a real <button type="button">`);
  }

  assert.match(js, /async function loadNotificationPanelContent/u);
  assert.match(js, /elements\.notificationServiceUnavailable\.hidden = false/u);
  assert.match(html, /No notifications yet/u);
});

test("every notification list item exposes a real focusable open control and a real focusable read-state toggle (keyboard reachability)", () => {
  assert.match(js, /openButton\.type = "button"/u);
  assert.match(js, /toggleButton\.type = "button"/u);
  assert.doesNotMatch(js, /notification-item[\s\S]{0,200}onclick=/u);
});

test("notification markup does not get hidden on narrow (mobile) viewports", () => {
  const mobileHidingRules = [...css.matchAll(/@media[^{]*\{[\s\S]*?\n\}/gu)]
    .map((match) => match[0])
    .filter((block) => /max-width/u.test(block));

  for (const block of mobileHidingRules) {
    for (const selector of ["notification-bell-wrap", "notification-panel", "notification-item"]) {
      assert.doesNotMatch(
        block,
        new RegExp(`\\.${selector}[^{]*\\{[^}]*display:\\s*none`, "u"),
        `${selector} must not be hidden on narrow viewports`
      );
    }
  }

  assert.match(css, /\.notification-bell\b/u);
  assert.match(css, /\.notification-panel\b/u);
});
