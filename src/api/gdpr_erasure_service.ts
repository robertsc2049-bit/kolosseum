// DEV NOTE: GDPR erasure - carrying out a reviewed athlete/coach deletion
// request (data_deletion_requests), run only by a platform admin pressing
// Erase (product_admin_action_service.ts eraseAccountForDeletionRequest).
//
// What the person was told when they asked (data_rights_service.ts
// buildRetentionCopy) is exactly what happens:
// - KEPT: their training sessions and runtime events (audit integrity /
//   engine-truth immutability), billing records, and terms/consent
//   acknowledgements. They stay keyed by the person's opaque user id, which
//   after erasure leads to nobody - the account row is kept only as a
//   tombstone with no email, name or password.
// - DELETED: everything else that is theirs - profile, sign-in sessions,
//   onboarding declarations, relationships, assignments' links to them,
//   messages they sent (and attachments), notifications, pain/readiness/
//   maxes/stand-down events, body metrics, habits, goals, check-ins, progress
//   photos, device data, video submissions, coach notes and reviews about
//   them, push subscriptions, demo videos and clips, org memberships, support
//   reports, export/closure requests - database rows and files on disk.
// - Records about OTHER people that the erased person created (a coach's
//   programme templates and their released versions, events, an athlete's
//   strength profile or assignment a coach set) stay - they're the other
//   person's training record - now attributed to "Erased account".

import fs from "node:fs";
import path from "node:path";

import type { PoolClient } from "pg";

import { STORAGE_ROOT as MESSAGE_ATTACHMENT_ROOT } from "./message_attachment_storage.js";
import { STORAGE_ROOT as VIDEO_SUBMISSION_ROOT } from "./video_submission_storage.js";
import { STORAGE_ROOT as PROGRESS_PHOTO_ROOT } from "./progress_photo_storage.js";
import { STORAGE_ROOT as DEMO_UPLOAD_ROOT } from "./exercise_demo_video_storage.js";

// Kept whoever they belong to: legal acknowledgements and audit records.
const ALWAYS_KEPT_RECORD_TYPES = ["beta16_acknowledgement", "audit_record"];
// A coach's content other people train from - kept when they're erased.
const AUTHORED_CONTENT_RECORD_TYPES = [
  "beta18_programme_template",
  "programme_template_release",
  "beta19_coach_event",
  "attendance_event",
  "attendance_event_occurrence"
];
// A relationship can't outlive one side of it.
const RELATIONSHIP_RECORD_TYPES = ["beta17_coach_relationship", "beta17_relationship_athlete_ended"];

export type ErasureFiles = Readonly<{
  messageIds: readonly string[];
  submissionIds: readonly string[];
  demoStorageKeys: readonly string[];
  userId: string;
}>;

export type ErasureCounts = Readonly<Record<string, number>>;

const SAFE_ID = /^[A-Za-z0-9_-]{1,200}$/u;

async function count(client: PoolClient, sql: string, params: unknown[]): Promise<number> {
  return (await client.query(sql, params)).rowCount ?? 0;
}

// Delete everything erasable for this user inside the caller's transaction,
// returning what was deleted (row counts) and which files to remove once the
// transaction has committed.
export async function eraseUserData(client: PoolClient, userId: string): Promise<{ counts: ErasureCounts; files: ErasureFiles }> {
  const files: ErasureFiles = Object.freeze({
    userId,
    messageIds: (await client.query(
      `SELECT message_id FROM product_messages WHERE sender_user_id = $1 AND attachment_storage_key IS NOT NULL`, [userId]
    )).rows.map((row) => String(row.message_id)),
    submissionIds: (await client.query(
      `SELECT submission_id FROM product_video_submissions WHERE athlete_user_id = $1`, [userId]
    )).rows.map((row) => String(row.submission_id)),
    demoStorageKeys: (await client.query(
      `SELECT storage_key FROM product_exercise_demo_videos WHERE coach_user_id = $1 AND storage_key IS NOT NULL`, [userId]
    )).rows.map((row) => String(row.storage_key))
  });

  const counts: Record<string, number> = {};
  counts.messages = await count(client, `DELETE FROM product_messages WHERE sender_user_id = $1`, [userId]);
  counts.video_submissions = await count(client, `DELETE FROM product_video_submissions WHERE athlete_user_id = $1`, [userId]);
  counts.coach_notes_about_them = await count(client, `DELETE FROM product_coach_notes WHERE athlete_user_id = $1`, [userId]);
  counts.session_reviews_about_them = await count(client, `DELETE FROM product_session_reviews WHERE athlete_user_id = $1`, [userId]);
  counts.notifications = await count(client, `DELETE FROM product_notifications WHERE recipient_user_id = $1`, [userId]);
  counts.push_subscriptions = await count(client, `DELETE FROM product_push_subscriptions WHERE user_id = $1`, [userId]);
  counts.demo_videos = await count(client, `DELETE FROM product_exercise_demo_videos WHERE coach_user_id = $1`, [userId]);
  counts.org_memberships = await count(client, `DELETE FROM product_org_coach_memberships WHERE coach_user_id = $1`, [userId]);
  counts.account_events = await count(client, `DELETE FROM product_account_events WHERE user_id = $1`, [userId]);
  counts.support_reports = await count(client, `DELETE FROM product_support_requests WHERE user_id = $1`, [userId]);
  counts.export_requests = await count(client, `DELETE FROM data_export_requests WHERE user_id = $1`, [userId]);
  counts.closure_requests = await count(client, `DELETE FROM product_account_closure_requests WHERE user_id = $1`, [userId]);
  counts.sign_in_sessions = await count(client, `DELETE FROM product_auth_sessions WHERE user_id = $1`, [userId]);
  counts.auth_challenges = await count(client, `DELETE FROM product_auth_challenges WHERE user_id = $1`, [userId]);
  counts.test_account_marks = await count(client, `DELETE FROM product_test_accounts WHERE user_id = $1`, [userId]);
  counts.legacy_account = await count(client, `DELETE FROM beta_accounts WHERE user_id = $1`, [userId]);

  // Product records about them (every record has a subject - their own
  // records have themselves), except kept types and content they authored
  // that others train from; plus relationships they started with others.
  counts.product_records = await count(
    client,
    `
    DELETE FROM beta_product_records
    WHERE record_type <> ALL($2::text[])
      AND (
        (subject_user_id = $1 AND NOT (actor_user_id = $1 AND record_type = ANY($3::text[])))
        OR (actor_user_id = $1 AND record_type = ANY($4::text[]))
      )
    `,
    [userId, ALWAYS_KEPT_RECORD_TYPES, AUTHORED_CONTENT_RECORD_TYPES, RELATIONSHIP_RECORD_TYPES]
  );

  // The tombstone: nothing left that identifies them, and no way to sign in.
  counts.account_scrubbed = await count(
    client,
    `
    UPDATE product_accounts
    SET email_canonical = 'erased+' || user_id || '@erased.invalid',
        display_name = 'Erased account',
        account_state = 'deleted',
        password_salt = md5(random()::text || clock_timestamp()::text),
        password_hash = md5(random()::text || clock_timestamp()::text) || md5(random()::text),
        email_verified_at = NULL,
        locked_until = NULL,
        failed_sign_in_count = 0,
        updated_at = now()
    WHERE user_id = $1
    `,
    [userId]
  );

  return { counts: Object.freeze(counts), files };
}

async function removeDir(root: string, child: string): Promise<boolean> {
  if (!SAFE_ID.test(child)) return false;
  const dir = path.join(root, child);
  if (!fs.existsSync(dir)) return false;
  await fs.promises.rm(dir, { recursive: true, force: true });
  return true;
}

// After the transaction commits: remove their files. Best effort per file -
// a leftover is reported, never a reason to undo the erasure.
export async function eraseUserFiles(files: ErasureFiles): Promise<ErasureCounts> {
  const removed = { message_attachments: 0, video_submissions: 0, progress_photo_folders: 0, demo_clips: 0, failed: 0 };
  const attempt = async (key: keyof typeof removed, fn: () => Promise<boolean>) => {
    try { if (await fn()) removed[key]++; }
    catch { removed.failed++; }
  };
  for (const id of files.messageIds) await attempt("message_attachments", () => removeDir(MESSAGE_ATTACHMENT_ROOT, id));
  for (const id of files.submissionIds) await attempt("video_submissions", () => removeDir(VIDEO_SUBMISSION_ROOT, id));
  await attempt("progress_photo_folders", () => removeDir(PROGRESS_PHOTO_ROOT, files.userId));
  for (const key of files.demoStorageKeys) await attempt("demo_clips", () => removeDir(DEMO_UPLOAD_ROOT, key.split("/")[0] ?? ""));
  return Object.freeze(removed);
}
