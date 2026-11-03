// DEV NOTE: FULL-UI-18 factual in-product notifications - ported from
// public/app/app.js's notification bell/panel functions.

import { coachLabel } from "../utils/coachName";
import { dayLabel } from "../utils/packages";
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
  attendance_event_occurrence_changed: "Event occurrence changed",
  activity_change_proposed: "Coach proposed an activity change",
  activity_change_applied: "Activity changed",
  athlete_position_overridden: "Position updated",
  attendance_rsvp_declined: "Athlete declined an event",
  activity_change_declined: "Athlete declined a proposed change",
  relationship_ended_by_athlete: "Athlete ended the relationship",
  coach_athlete_message_received: "New message",
  org_owner_message_received: "New message from your organisation",
  athlete_pain_reported: "Athlete reported pain",
  athlete_strength_reference_missing: "Athlete needs a max to train",
  athlete_block_completed: "Finished a block - report ready",
  coach_gym_confirmed: "Gym confirmed you coach there",
  coach_gym_declined: "Gym didn't confirm you coach there",
  coach_gym_now_listed: "Your gym is now on Kolosseum - link it",
  coaching_requested: "An athlete asked you to coach them",
  coaching_request_declined: "A coach can't take you on right now",
  checkin_scheduled: "Check-in call booked",
  checkin_cancelled: "Check-in call cancelled",
  checkin_confirmed: "Athlete confirmed a check-in call",
  checkin_move_requested: "Athlete asked to move a check-in call",
  checkin_booked: "Athlete booked a check-in call",
  checkin_cancelled_by_athlete: "Athlete cancelled a check-in call",
  package_payment_upcoming: "Package payment due soon",
  package_payment_due: "Package payment due",
  athlete_package_payment_due: "Athlete's package payment is due"
};

export function notificationTypeLabel(notification: JsonRecord): string {
  const type = String(notification.notification_type ?? "");
  // Names the block (or the whole programme) the athlete just finished.
  if (type === "athlete_block_completed") {
    const payload = (notification.notification_payload ?? {}) as JsonRecord;
    if (payload.programme_finished === true) return "Finished the programme - report ready";
    if (typeof payload.block_name === "string" && payload.block_name.trim()) return `Finished ${payload.block_name.trim()} - report ready`;
  }
  // Package reminders say which package and the paid-up date.
  if (type === "package_payment_upcoming" || type === "package_payment_due" || type === "athlete_package_payment_due") {
    const payload = (notification.notification_payload ?? {}) as JsonRecord;
    const name = typeof payload.package_name === "string" ? payload.package_name.trim() : "";
    const paidUntil = typeof payload.paid_until === "string" ? payload.paid_until : "";
    if (name && paidUntil) {
      if (type === "package_payment_upcoming") return `${name} is paid up to ${dayLabel(paidUntil)} - payment due soon`;
      if (type === "package_payment_due") return `Payment due for ${name} - paid up to ${dayLabel(paidUntil)}`;
      return `Payment due for ${name} - was paid up to ${dayLabel(paidUntil)}`;
    }
    if (name && type === "package_payment_due") return `Payment due for ${name}`;
  }
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

  // Not one of the coach's athletes yet (coaching_requested): named directly.
  if (typeof record.athlete_display_name === "string" && record.athlete_display_name) {
    return record.athlete_display_name;
  }

  // Not the athlete's coach (coaching_request_declined): named directly.
  if (typeof record.coach_display_name === "string" && record.coach_display_name) {
    return coachLabel(record);
  }

  if (record.athlete_user_id) {
    const athleteUserId = String(record.athlete_user_id);
    const athlete = context.coachRelationships.find((entry) => String(entry.athlete_user_id) === athleteUserId);
    return String(athlete?.display_name ?? "A connected athlete");
  }

  if (record.coach_user_id) {
    const coachUserId = String(record.coach_user_id);
    const accepted = context.athleteRelationships.find((entry) => String(entry.coach_user_id) === coachUserId);
    if (accepted?.coach_display_name) return coachLabel(accepted);
    const pending = context.pendingInvitations.find((entry) => String(entry.coach_user_id) === coachUserId);
    return coachLabel(pending, "A connected coach");
  }

  if (record.org_name) {
    return String(record.org_name);
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

// Phone notifications (Web Push): whether the server has push set up, its
// public key, and turning this phone's subscription on or off.
export async function loadPushConfig(): Promise<{ enabled: boolean; publicKey: string | null }> {
  const body = await request("GET", "/account/notifications/push");
  return { enabled: body.enabled === true, publicKey: typeof body.public_key === "string" ? body.public_key : null };
}

export async function savePushSubscription(subscription: JsonRecord, csrfToken: string): Promise<void> {
  await request("POST", "/account/notifications/push/subscribe", subscription, csrfToken);
}

export async function removePushSubscription(endpoint: string, csrfToken: string): Promise<void> {
  await request("POST", "/account/notifications/push/unsubscribe", { endpoint }, csrfToken);
}
