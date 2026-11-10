// Something happened for this account elsewhere - another person's action
// (a coaching request, an invitation, an assignment, a finished session,
// a note). Notifications are worked out when they're read, so the server
// can't push them; instead the always-mounted bell (useNotifications.ts)
// re-checks its unread count every minute while the app is visible, and
// when the tab comes back into view. When the count goes up it clears the
// shared read cache and fires this event, and the panels that show other
// people's actions refetch: coaching requests, coach invitations, the
// athlete roster, the review queue and the athlete's Today.
export const NOTIFICATIONS_ARRIVED_EVENT = "kolosseum:notifications-arrived";

export const NOTIFICATION_RECHECK_MS = 60_000;
