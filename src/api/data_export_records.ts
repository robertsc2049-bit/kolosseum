// DEV NOTE: The rest of a person's data for "Download my data" (UK GDPR
// Article 15 / 20) - everything data_rights_service.ts and
// org_owner_data_rights_service.ts didn't already gather: their messages,
// notifications, support reports, account requests, session reviews, video
// submissions, package payments, tax details, demo videos, push devices,
// gym listings and packages, and every product record about them.
//
// test/data_export_coverage.test.mjs fails when a table with a user id
// column is neither read by an export nor listed there as deliberately left
// out, so new user data can't silently miss the export again.
//
// Files (message attachments, videos, demo clips) are described, not
// embedded: the person can still open them in the app.

import { pool } from "../db/pool.js";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function iso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function day(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" && value ? value.slice(0, 10) : null;
}

function attachment(row: JsonRecord): JsonRecord | null {
  if (!row.attachment_media_type) return null;
  return { media_type: row.attachment_media_type, mime_type: row.attachment_mime_type ?? null, byte_size: row.attachment_byte_size ?? null };
}

// Every product record about them (they're its subject), whatever its type,
// apart from the types an export already lists under its own category; plus
// content they wrote that other people train from (programme templates,
// events) and records they made about someone else's training that name
// them as the author. A new record type is covered without anyone having to
// remember this file.
const AUTHORED_RECORD_TYPES = [
  "beta18_programme_template",
  "programme_template_release",
  "programme_template_sharing_preference",
  "beta19_coach_event",
  "attendance_event",
  "attendance_event_occurrence",
  "attendance_event_invite"
];

export async function loadProductRecords(userId: string, alreadyExportedTypes: readonly string[]): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT record_type, record_id, subject_user_id, effective_at, record_payload
     FROM beta_product_records
     WHERE record_type <> ALL($2::text[])
       AND (subject_user_id = $1 OR (actor_user_id = $1 AND record_type = ANY($3::text[])))
     ORDER BY effective_at ASC, created_at ASC, record_id ASC`,
    [userId, alreadyExportedTypes, AUTHORED_RECORD_TYPES]
  );
  return result.rows.map((row) => ({
    record_type: row.record_type,
    record_id: row.record_id,
    about: row.subject_user_id === userId ? "you" : "someone_you_coach_or_organise",
    effective_at_iso8601: iso(row.effective_at),
    payload: isRecord(row.record_payload) ? row.record_payload : {}
  }));
}

// Every message in a conversation they're part of: ones they sent in full
// (even if Kolosseum later removed it), ones they received unless Kolosseum
// removed it. Org owners are part of every conversation of a gym they own.
export async function loadMessages(userId: string, asOrgOwner = false): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT m.message_id, m.thread_id, t.thread_type, t.org_id, m.sender_user_id, m.sender_role, m.body_text,
            m.attachment_media_type, m.attachment_mime_type, m.attachment_byte_size, m.removed_at, m.created_at
     FROM product_messages m
     JOIN product_message_threads t ON t.thread_id = m.thread_id
     WHERE ${asOrgOwner
       ? `t.thread_type IN ('org_owner_coach', 'org_owner_athlete') AND t.org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)`
       : `(t.coach_user_id = $1 OR t.athlete_user_id = $1 OR m.sender_user_id = $1)
          AND (t.thread_type = 'coach_athlete'
               OR (t.thread_type = 'org_owner_coach' AND t.coach_user_id = $1)
               OR (t.thread_type = 'org_owner_athlete' AND t.athlete_user_id = $1)
               OR m.sender_user_id = $1)`}
     ORDER BY m.created_at ASC, m.message_id ASC`,
    [userId]
  );
  return result.rows.map((row) => {
    const sent = row.sender_user_id === userId;
    const removed = row.removed_at !== null && row.removed_at !== undefined;
    return {
      message_id: row.message_id,
      thread_id: row.thread_id,
      conversation: row.thread_type,
      org_id: row.org_id ?? null,
      direction: sent ? "sent" : "received",
      sender_role: row.sender_role,
      body_text: sent || !removed ? row.body_text ?? null : null,
      attachment: sent || !removed ? attachment(row) : null,
      removed_by_kolosseum_at_iso8601: iso(row.removed_at),
      created_at_iso8601: iso(row.created_at)
    };
  });
}

export async function loadNotifications(userId: string): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT notification_id, notification_type, notification_payload, occurred_at, read_at
     FROM product_notifications WHERE recipient_user_id = $1 ORDER BY occurred_at ASC, notification_id ASC`,
    [userId]
  );
  return result.rows.map((row) => ({
    notification_id: row.notification_id,
    notification_type: row.notification_type,
    payload: isRecord(row.notification_payload) ? row.notification_payload : {},
    occurred_at_iso8601: iso(row.occurred_at),
    read_at_iso8601: iso(row.read_at)
  }));
}

// Problems they reported, with what the app captured alongside.
export async function loadSupportRequests(userId: string, asOrgOwner = false): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT correlation_id, route_hash, occurred_at, description, browser_context, failure_context, status, created_at
     FROM ${asOrgOwner ? "org_owner_support_requests" : "product_support_requests"} WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows.map((row) => ({
    reference: row.correlation_id,
    screen: row.route_hash,
    occurred_at_iso8601: iso(row.occurred_at),
    description: row.description,
    browser_context: isRecord(row.browser_context) ? row.browser_context : {},
    failure_context: isRecord(row.failure_context) ? row.failure_context : {},
    status: row.status,
    created_at_iso8601: iso(row.created_at)
  }));
}

// Requests they made about their account: to close it, to have their data
// deleted, and earlier copies of their data.
export async function loadAccountRequests(userId: string, asOrgOwner = false): Promise<JsonRecord[]> {
  const [closures, deletions, exports] = await Promise.all([
    pool.query(`SELECT closure_request_id, request_state, requested_at, completed_at FROM ${asOrgOwner ? "org_owner_closure_requests" : "product_account_closure_requests"} WHERE user_id = $1`, [userId]),
    pool.query(`SELECT deletion_request_id, reason_code, queue_status, requested_at FROM ${asOrgOwner ? "org_owner_data_deletion_requests" : "data_deletion_requests"} WHERE user_id = $1`, [userId]),
    pool.query(`SELECT export_request_id, status, requested_at, downloaded_at FROM ${asOrgOwner ? "org_owner_data_export_requests" : "data_export_requests"} WHERE user_id = $1`, [userId])
  ]);
  return [
    ...closures.rows.map((row) => ({ request: "close_account", request_id: row.closure_request_id, status: row.request_state, requested_at_iso8601: iso(row.requested_at), completed_at_iso8601: iso(row.completed_at) })),
    ...deletions.rows.map((row) => ({ request: "delete_data", request_id: row.deletion_request_id, reason: row.reason_code, status: row.queue_status, requested_at_iso8601: iso(row.requested_at) })),
    ...exports.rows.map((row) => ({ request: "copy_of_data", request_id: row.export_request_id, status: row.status, requested_at_iso8601: iso(row.requested_at), downloaded_at_iso8601: iso(row.downloaded_at) }))
  ].sort((a, b) => String(a.requested_at_iso8601).localeCompare(String(b.requested_at_iso8601)));
}

// A coach's review of an athlete's session - in both their copies.
export async function loadSessionReviews(userId: string): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT review_record_id, coach_user_id, session_id, review_status, reviewed_at, recorded_at, review_payload
     FROM product_session_reviews WHERE coach_user_id = $1 OR athlete_user_id = $1 ORDER BY recorded_at ASC`,
    [userId]
  );
  return result.rows.map((row) => ({
    review_record_id: row.review_record_id,
    role: row.coach_user_id === userId ? "coach" : "athlete",
    session_id: row.session_id,
    review_status: row.review_status,
    reviewed_at_iso8601: iso(row.reviewed_at),
    recorded_at_iso8601: iso(row.recorded_at),
    review: isRecord(row.review_payload) ? row.review_payload : {}
  }));
}

// Videos an athlete sent their coach, and the coach's feedback on them.
export async function loadVideoSubmissions(userId: string): Promise<JsonRecord[]> {
  const [submissions, feedback] = await Promise.all([
    pool.query(
      `SELECT submission_id, coach_user_id, session_id, exercise_label, caption, attachment_mime_type, attachment_byte_size, review_status, reviewed_at, created_at
       FROM product_video_submissions WHERE athlete_user_id = $1 OR coach_user_id = $1 ORDER BY created_at ASC`,
      [userId]
    ),
    pool.query(
      `SELECT f.feedback_id, f.submission_id, f.feedback_text, f.created_at
       FROM product_video_submission_feedback f JOIN product_video_submissions s ON s.submission_id = f.submission_id
       WHERE s.athlete_user_id = $1 OR s.coach_user_id = $1 ORDER BY f.created_at ASC`,
      [userId]
    )
  ]);
  return submissions.rows.map((row) => ({
    submission_id: row.submission_id,
    role: row.coach_user_id === userId ? "coach" : "athlete",
    session_id: row.session_id,
    exercise: row.exercise_label,
    caption: row.caption ?? null,
    video: { mime_type: row.attachment_mime_type, byte_size: row.attachment_byte_size },
    review_status: row.review_status,
    reviewed_at_iso8601: iso(row.reviewed_at),
    created_at_iso8601: iso(row.created_at),
    feedback: feedback.rows
      .filter((f) => f.submission_id === row.submission_id)
      .map((f) => ({ feedback_id: f.feedback_id, text: f.feedback_text, created_at_iso8601: iso(f.created_at) }))
  }));
}

// Payments recorded against a package membership - as the coach who was
// paid, the athlete who paid, or the owner of the gym that was paid.
export async function loadPackagePayments(userId: string, asOrgOwner = false): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT pp.payment_id, pp.membership_id, pp.coach_user_id, p.name, pp.paid_until_from, pp.paid_until_to, pp.paid_in_full,
            pp.periods, pp.amount_minor, pp.currency, pp.recorded_at
     FROM product_package_payments pp
     JOIN product_package_memberships m ON m.membership_id = pp.membership_id
     JOIN product_service_packages p ON p.package_id = m.package_id
     WHERE ${asOrgOwner ? `p.org_id IN (SELECT org_id FROM product_organisations WHERE owner_user_id = $1)` : `pp.coach_user_id = $1 OR pp.athlete_user_id = $1`}
     ORDER BY pp.recorded_at ASC`,
    [userId]
  );
  return result.rows.map((row) => ({
    payment_id: row.payment_id,
    membership_id: row.membership_id,
    role: asOrgOwner ? "gym" : row.coach_user_id === userId ? "coach" : "athlete",
    package_name: row.name,
    paid_until_from: day(row.paid_until_from),
    paid_until_to: day(row.paid_until_to),
    paid_in_full: row.paid_in_full,
    periods: row.periods,
    amount_minor: row.amount_minor,
    currency: row.currency,
    recorded_at_iso8601: iso(row.recorded_at)
  }));
}

function taxRecord(row: JsonRecord): JsonRecord {
  return {
    seller_type: row.seller_type,
    legal_name: row.legal_name,
    date_of_birth: day(row.date_of_birth),
    company_number: row.company_number ?? null,
    tax_number_type: row.tax_number_type ?? null,
    tax_number: row.tax_number ?? null,
    vat_number: row.vat_number ?? null,
    address: [row.address_line1, row.address_line2, row.city, row.postcode, row.country].filter(Boolean).join(", "),
    updated_at_iso8601: iso(row.updated_at)
  };
}

// The seller details they gave for selling packages in the app.
export async function loadTaxDetails(userId: string, asOrgOwner = false): Promise<JsonRecord[]> {
  const result = asOrgOwner
    ? await pool.query(
      `SELECT t.*, o.org_name FROM product_gym_tax_details t JOIN product_organisations o ON o.org_id = t.org_id WHERE o.owner_user_id = $1`,
      [userId]
    )
    : await pool.query(`SELECT * FROM product_coach_tax_details WHERE coach_user_id = $1`, [userId]);
  return result.rows.map((row) => ({ ...(asOrgOwner ? { org_id: row.org_id, gym: row.org_name } : {}), ...taxRecord(row) }));
}

// Demo videos a coach chose or uploaded for exercises.
export async function loadExerciseDemoVideos(userId: string): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT exercise_id, provider, video_id, storage_key, created_at, updated_at
     FROM product_exercise_demo_videos WHERE coach_user_id = $1 OR set_by_user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows.map((row) => ({
    exercise_id: row.exercise_id,
    provider: row.provider,
    video: row.storage_key ? "uploaded clip" : row.video_id,
    created_at_iso8601: iso(row.created_at),
    updated_at_iso8601: iso(row.updated_at)
  }));
}

// Devices they turned notifications on for. The push address and its key
// are a secret for sending to that device, so only the service is shown.
export async function loadPushSubscriptions(userId: string): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT endpoint, created_at, last_pushed_at FROM product_push_subscriptions WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows.map((row) => {
    let service = "unknown";
    try { service = new URL(String(row.endpoint)).host; } catch { /* keep unknown */ }
    return { push_service: service, created_at_iso8601: iso(row.created_at), last_pushed_at_iso8601: iso(row.last_pushed_at) };
  });
}

// An org owner's gym listings and the packages and memberships their gyms sell.
export async function loadGymListings(userId: string): Promise<JsonRecord[]> {
  const result = await pool.query(
    `SELECT l.org_id, l.display_name, l.area, l.equipment, l.listing_status, l.review_note, l.reviewed_at, l.created_at, l.updated_at
     FROM product_gym_listings l JOIN product_organisations o ON o.org_id = l.org_id WHERE o.owner_user_id = $1 ORDER BY l.created_at ASC`,
    [userId]
  );
  return result.rows.map((row) => ({
    org_id: row.org_id,
    display_name: row.display_name,
    area: row.area,
    equipment: row.equipment ?? [],
    listing_status: row.listing_status,
    review_note: row.review_note ?? null,
    reviewed_at_iso8601: iso(row.reviewed_at),
    created_at_iso8601: iso(row.created_at),
    updated_at_iso8601: iso(row.updated_at)
  }));
}

export async function loadGymPackages(userId: string): Promise<JsonRecord[]> {
  const [packages, memberships] = await Promise.all([
    pool.query(
      `SELECT p.package_id, p.org_id, p.name, p.description, p.price_minor, p.currency, p.billing, p.includes, p.archived_at, p.created_at
       FROM product_service_packages p JOIN product_organisations o ON o.org_id = p.org_id WHERE o.owner_user_id = $1 ORDER BY p.created_at ASC`,
      [userId]
    ),
    pool.query(
      `SELECT m.membership_id, p.name, m.started_on, m.paid_until, m.paid_in_full, m.ended_at
       FROM product_package_memberships m JOIN product_service_packages p ON p.package_id = m.package_id
       JOIN product_organisations o ON o.org_id = p.org_id WHERE o.owner_user_id = $1 ORDER BY m.created_at ASC`,
      [userId]
    )
  ]);
  return [
    ...packages.rows.map((row) => ({ record: "package", package_id: row.package_id, org_id: row.org_id, name: row.name, description: row.description ?? null, price_minor: row.price_minor, currency: row.currency, billing: row.billing, includes: row.includes, archived_at_iso8601: iso(row.archived_at), created_at_iso8601: iso(row.created_at) })),
    ...memberships.rows.map((row) => ({ record: "package_membership", membership_id: row.membership_id, package_name: row.name, started_on: day(row.started_on), paid_until: day(row.paid_until), paid_in_full: row.paid_in_full, ended_at_iso8601: iso(row.ended_at) }))
  ];
}
