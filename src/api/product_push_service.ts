// DEV NOTE: Web Push for in-product notifications. A signed-in athlete or
// coach turns notifications on for a phone (its browser push subscription is
// stored against them); a background sweep then derives each subscriber's
// notifications - the same derivation the bell runs - and pushes the new
// unread ones. The push says only what kind of notification it is (no names,
// no message text) and opens the app; the detail stays behind sign-in.

import { pool } from "../db/pool.js";
import { deriveUnreadNotificationsSince } from "./product_notification_service.js";
import { type VapidConfig, isAllowedPushEndpoint, sendWebPush, vapidConfigFromEnv } from "./web_push.js";

export class ProductPushError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ProductPushError";
    this.status = status;
  }
}

// What the phone shows. Mirrors NOTIFICATION_TYPE_LABELS in
// public/app-src/api/notificationsClient.ts (a test keeps them equal).
export const PUSH_TITLES: Readonly<Record<string, string>> = Object.freeze({
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
  athlete_pain_reported: "Athlete reported pain"
});

export function pushPayloadFor(notificationType: string): Readonly<Record<string, string>> {
  return Object.freeze({
    title: PUSH_TITLES[notificationType] ?? "New notification",
    body: "Open Kolosseum to see it.",
    url: "/app/",
    tag: notificationType
  });
}

export function pushConfig(): Readonly<{ enabled: boolean; public_key: string | null }> {
  const config = vapidConfigFromEnv();
  return Object.freeze({ enabled: config !== null, public_key: config?.publicKey ?? null });
}

function cleanKey(value: unknown, max: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 && text.length <= max && /^[A-Za-z0-9_-]+=*$/u.test(text) ? text : "";
}

export async function savePushSubscription(userId: string, input: unknown): Promise<void> {
  if (vapidConfigFromEnv() === null) throw new ProductPushError("push_not_configured", 409);
  const body = (input && typeof input === "object" ? input : {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint || endpoint.length > 2048 || !isAllowedPushEndpoint(endpoint)) throw new ProductPushError("push_endpoint_invalid");
  const p256dh = cleanKey(body.keys?.p256dh, 200);
  const auth = cleanKey(body.keys?.auth, 100);
  if (!p256dh || !auth) throw new ProductPushError("push_keys_invalid");
  // Signing in as someone else on the same phone moves the phone to them;
  // only notifications from now on are pushed.
  await pool.query(
    `
    INSERT INTO product_push_subscriptions (endpoint, user_id, p256dh, auth)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (endpoint) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          p256dh = EXCLUDED.p256dh,
          auth = EXCLUDED.auth,
          last_pushed_at = CASE WHEN product_push_subscriptions.user_id = EXCLUDED.user_id
                                THEN product_push_subscriptions.last_pushed_at ELSE now() END
    `,
    [endpoint, userId, p256dh, auth]
  );
}

export async function deletePushSubscription(userId: string, input: unknown): Promise<void> {
  const endpoint = typeof (input as { endpoint?: unknown } | null)?.endpoint === "string" ? String((input as { endpoint: string }).endpoint).trim() : "";
  if (!endpoint) throw new ProductPushError("push_endpoint_invalid");
  await pool.query(`DELETE FROM product_push_subscriptions WHERE endpoint = $1 AND user_id = $2`, [endpoint, userId]);
}

export async function pushSubscriptionCount(userId: string): Promise<number> {
  const result = await pool.query(`SELECT count(*)::int AS n FROM product_push_subscriptions WHERE user_id = $1`, [userId]);
  return Number(result.rows[0]?.n ?? 0);
}

type SubscriptionRow = { endpoint: string; user_id: string; p256dh: string; auth: string; last_pushed_at: string };

// One pass: for each subscribed phone, push the notifications recorded since
// its last push. Returns how many were sent. Never throws for one bad phone.
export async function runPushSweep(
  config: VapidConfig | null = vapidConfigFromEnv(),
  send: typeof sendWebPush = sendWebPush
): Promise<number> {
  if (!config) return 0;
  const subscriptions = (await pool.query(
    `SELECT endpoint, user_id, p256dh, auth, last_pushed_at::text AS last_pushed_at FROM product_push_subscriptions ORDER BY user_id, endpoint`
  )).rows as SubscriptionRow[];
  let sent = 0;
  for (const subscription of subscriptions) {
    try {
      // As text, so the comparison keeps Postgres's microseconds (a JS Date
      // would round them away and re-select the last one pushed).
      const fresh = await deriveUnreadNotificationsSince(subscription.user_id, subscription.last_pushed_at);
      if (fresh.length === 0) continue;
      let gone = false;
      for (const notification of fresh) {
        const result = await send(subscription, pushPayloadFor(notification.notification_type), config);
        if (result.gone) { gone = true; break; }
        if (result.ok) sent++;
      }
      if (gone) {
        await pool.query(`DELETE FROM product_push_subscriptions WHERE endpoint = $1`, [subscription.endpoint]);
        continue;
      }
      // Advance to the newest one's exact database timestamp.
      await pool.query(
        `
        UPDATE product_push_subscriptions
        SET last_pushed_at = GREATEST(last_pushed_at, (SELECT created_at FROM product_notifications WHERE notification_id = $2))
        WHERE endpoint = $1
        `,
        [subscription.endpoint, fresh[fresh.length - 1].notification_id]
      );
    }
    catch {
      // A failed phone (network, push service down) is retried next sweep.
    }
  }
  return sent;
}

const PUSH_SWEEP_INTERVAL_MS = 60_000;
let sweepTimer: ReturnType<typeof setInterval> | null = null;
let sweeping = false;

// Started by the server when push is configured. One sweep at a time.
export function startPushSweeps(): void {
  if (sweepTimer || vapidConfigFromEnv() === null) return;
  sweepTimer = setInterval(() => {
    if (sweeping) return;
    sweeping = true;
    runPushSweep().catch(() => 0).finally(() => { sweeping = false; });
  }, PUSH_SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
}
