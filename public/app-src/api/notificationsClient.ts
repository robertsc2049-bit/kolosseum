// DEV NOTE: FULL-UI-18 factual in-product notifications - ported from
// public/app/app.js's notification bell/panel functions.

import { titleCase } from "../utils/format";
import { type JsonRecord, request } from "./transport";

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  relationship_invited: "Relationship invited",
  relationship_accepted: "Relationship accepted",
  relationship_declined: "Relationship declined",
  relationship_revoked: "Relationship revoked",
  assignment_created: "Assignment created",
  assignment_replaced: "Assignment replaced",
  assignment_cancelled: "Assignment cancelled",
  event_linked: "Event linked",
  event_unlinked: "Event unlinked",
  event_cancelled: "Event cancelled",
  programme_available: "Programme available",
  session_completed: "Session completed",
  coach_note_visible: "Coach note visible",
  billing_action_required: "Billing action required",
  marketplace_template_released: "Template released",
  weekly_checkin_submitted: "Weekly check-in submitted",
  video_feedback_received: "Coach feedback on your video",
  athlete_goal_achieved: "Goal achieved",
  video_submitted: "New video submitted for review",
  marketplace_template_sold: "Template sold",
  attendance_event_invited: "Invited to an event",
  attendance_event_cancelled: "Event cancelled",
  attendance_event_occurrence_changed: "Event occurrence changed"
};

export function notificationTypeLabel(notification: JsonRecord): string {
  const type = String(notification.notification_type ?? "");
  return NOTIFICATION_TYPE_LABELS[type] ?? titleCase(type);
}

// The declared, server-derived notification_payload (coach_user_id or
// athlete_user_id, depending on the notification's direction) names which
// coach or athlete triggered the event, resolved to a display name via
// whichever relationship list matches the CURRENT user's own role.
export function resolveNotificationSubject(
  notification: JsonRecord,
  context: { coachRelationships: JsonRecord[]; athleteRelationships: JsonRecord[]; pendingInvitations: JsonRecord[] }
): string | null {
  const payload = notification.notification_payload;
  if (!payload || typeof payload !== "object") return null;
  const record = payload as JsonRecord;

  if (record.athlete_user_id) {
    const athleteUserId = String(record.athlete_user_id);
    const athlete = context.coachRelationships.find((entry) => String(entry.athlete_user_id) === athleteUserId);
    return String(athlete?.display_name ?? athleteUserId);
  }

  if (record.coach_user_id) {
    const coachUserId = String(record.coach_user_id);
    const accepted = context.athleteRelationships.find((entry) => String(entry.coach_user_id) === coachUserId);
    if (accepted?.coach_display_name) return String(accepted.coach_display_name);
    const pending = context.pendingInvitations.find((entry) => String(entry.coach_user_id) === coachUserId);
    return String(pending?.coach_display_name ?? coachUserId);
  }

  return null;
}

export async function loadUnreadNotificationCount(): Promise<number> {
  const response = await request("GET", "/account/notifications/unread-count");
  return Number(response.unread_count ?? 0);
}

export async function loadNotifications(): Promise<{ notifications: JsonRecord[]; unreadCount: number }> {
  const response = await request("GET", "/account/notifications");
  return {
    notifications: Array.isArray(response.notifications) ? (response.notifications as JsonRecord[]) : [],
    unreadCount: Number(response.unread_count ?? 0)
  };
}

export async function markNotificationRead(notificationId: string, csrfToken: string): Promise<void> {
  await request("POST", `/account/notifications/${encodeURIComponent(notificationId)}/read`, {}, csrfToken);
}

export async function markNotificationUnread(notificationId: string, csrfToken: string): Promise<void> {
  await request("POST", `/account/notifications/${encodeURIComponent(notificationId)}/unread`, {}, csrfToken);
}

export async function markAllNotificationsRead(csrfToken: string): Promise<void> {
  await request("POST", "/account/notifications/mark-all-read", {}, csrfToken);
}
