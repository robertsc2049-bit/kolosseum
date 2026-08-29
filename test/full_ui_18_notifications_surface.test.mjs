// DEV NOTE: FULL-UI-18 factual in-product notifications static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const html = read("public/app/index.html");
const css = read("public/app/styles.css");
const routeBootstrap = read("public/app/route_bootstrap.js");
const notificationService = read("src/api/product_notification_service.ts");
const notificationNoteDerivation = read("src/api/product_notification_note_derivation.ts");
const notificationRoutes = read("src/api/product_notification.routes.ts");
const serverTs = read("src/server.ts");
// DEV NOTE: the bell button, dropdown panel, loading/unavailable/empty
// states and per-item open/read-toggle controls moved to React - see
// NotificationBellPanel.tsx/useNotifications.ts/notificationsClient.ts,
// mounted at #notification-bell-root (replacing the static
// .notification-bell-wrap markup this file used to check inside
// index.html/app.js).
const notificationPanel = read("public/app-src/screens/account/NotificationBellPanel.tsx");
const notificationHook = read("public/app-src/screens/account/useNotifications.ts");
const notificationClient = read("public/app-src/api/notificationsClient.ts");

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
  assert.ok(html.includes('id="notification-bell-root"'), "Expected the React mount point for the notification bell/panel");

  assert.match(notificationPanel, /className="icon-button notification-bell"\s*\n\s*type="button"\s*\n\s*aria-label="Open notifications"/u);
  assert.match(notificationPanel, /className="notification-unread-badge"/u);
  assert.match(notificationPanel, /className="notification-panel" role="menu"/u);
  assert.match(notificationPanel, /className="button link" type="button" onClick=\{\(\) => markAllRead\(\)\}>Mark all read</u);
  assert.match(notificationPanel, /className="notification-loading">Loading notifications/u);
  assert.match(notificationPanel, /className="notification-unavailable"/u);
  assert.match(notificationPanel, /className="button" type="button" onClick=\{\(\) => retry\(\)\}>Retry</u);
  assert.match(notificationPanel, /className="notification-empty">No notifications yet\./u);
  assert.match(notificationPanel, /className="notification-list"/u);

  assert.match(notificationHook, /const loadPanelContent = useCallback\(async \(\) => \{/u);
  assert.match(notificationHook, /error: true/u);
});

test("every notification list item exposes a real focusable open control and a real focusable read-state toggle (keyboard reachability)", () => {
  assert.match(notificationPanel, /<button type="button" className="notification-item-open" onClick=\{onOpen\}>/u);
  assert.match(notificationPanel, /type="button"\s*\n\s*className="notification-item-toggle-read"/u);
  assert.doesNotMatch(notificationPanel, /onclick=/u);
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

test("notification_payload is derived, persisted and returned by the API, and actually rendered - not a phantom field", () => {
  // The server derives, persists (JSONB column round-tripped by
  // toPublicNotification) and ships notification_payload.{coach_user_id,
  // athlete_user_id} on the wire for every notification type, but until now
  // nothing in the UI ever read it: every notification of the same type
  // rendered as an identical row regardless of which coach or athlete
  // triggered it. resolveNotificationSubject() (notificationsClient.ts)
  // resolves the payload against the panel's own freshly-loaded
  // coachRelationships / athleteRelationships / pendingInvitations lists
  // (fetched by useNotifications.ts, see its own DEV NOTE), no extra
  // fetch required beyond what the hook already does on panel open.
  assert.match(notificationService, /notification_payload:\s*isRecord\(row\.notification_payload\)\s*\?\s*row\.notification_payload\s*:\s*\{\}/u);

  assert.match(notificationClient, /function resolveNotificationSubject/u);
  assert.match(notificationClient, /record\.athlete_user_id/u);
  assert.match(notificationClient, /record\.coach_user_id/u);

  // Coach-directed payloads (athlete_user_id) resolve against the coach's
  // own athlete directory; athlete-directed payloads (coach_user_id)
  // resolve against the athlete's own relationship/invitation lists.
  assert.match(notificationClient, /context\.coachRelationships/u);
  assert.match(notificationClient, /context\.athleteRelationships/u);
  assert.match(notificationClient, /context\.pendingInvitations/u);
  assert.match(notificationHook, /coachRelationships,\s*athleteRelationships,\s*pendingInvitations/u);

  // The renderer actually inserts the resolved subject into the DOM.
  assert.match(notificationPanel, /subject=\{resolveNotificationSubject\(notification,/u);
  assert.match(notificationPanel, /className="notification-item-subject"/u);
  assert.match(css, /\.notification-item-subject\b/u);
});
