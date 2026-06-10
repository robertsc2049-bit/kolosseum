
// DEV NOTE: Application source surface. Keep product/UI behaviour separated from deterministic
// engine truth. UI, notes, and workflow convenience must not change canonical engine inputs or
// outputs unless routed through an explicit validated contract.

export const coachQueueReviewStatusOrder = {
  review_required: 0,
  blocked: 1,
  available: 2,
} as const;

export const allowedCoachAthleteLinkStatuses = [
  "linked",
  "revoked",
  "missing",
] as const;

export const allowedLatestSessionRecordStatuses = [
  "record_available",
  "review_required",
  "missing",
] as const;

export const allowedLatestCheckinRecordStatuses = [
  "record_available",
  "missing",
] as const;

export const allowedLatestCoachNoteStatuses = [
  "note_available",
  "none",
] as const;

export const allowedHistoryCountStatuses = [
  "counts_available",
  "missing",
] as const;

export const allowedCoachQueueBlockedReasons = [
  "coach_athlete_link_revoked",
  "coach_athlete_link_missing",
  "source_record_missing",
  "unknown_queue_item_field",
  "unknown_queue_item_status",
] as const;

export type CoachAthleteLinkStatus =
  (typeof allowedCoachAthleteLinkStatuses)[number];

export type LatestSessionRecordStatus =
  (typeof allowedLatestSessionRecordStatuses)[number];

export type LatestCheckinRecordStatus =
  (typeof allowedLatestCheckinRecordStatuses)[number];

export type LatestCoachNoteStatus =
  (typeof allowedLatestCoachNoteStatuses)[number];

export type HistoryCountStatus =
  (typeof allowedHistoryCountStatuses)[number];

export type CoachQueueStatus = keyof typeof coachQueueReviewStatusOrder;

export type CoachQueueBlockedReason =
  (typeof allowedCoachQueueBlockedReasons)[number];

export interface CoachQueueReviewInputItem {
  queue_item_id: string;
  coach_id: string;
  athlete_id: string;
  coach_athlete_link_status: CoachAthleteLinkStatus;
  latest_session_record_status: LatestSessionRecordStatus;
  latest_checkin_record_status: LatestCheckinRecordStatus;
  latest_coach_note_status: LatestCoachNoteStatus;
  history_count_status: HistoryCountStatus;
  source_record_refs: string[];
}

export interface CoachQueueReviewOutputItem {
  queue_item_id: string;
  coach_id: string;
  athlete_id: string;
  queue_status: CoachQueueStatus;
  review_required: boolean;
  blocked_reasons: CoachQueueBlockedReason[];
  source_record_refs: string[];
}

const allowedInputKeys = new Set([
  "queue_item_id",
  "coach_id",
  "athlete_id",
  "coach_athlete_link_status",
  "latest_session_record_status",
  "latest_checkin_record_status",
  "latest_coach_note_status",
  "history_count_status",
  "source_record_refs",
]);

function includesString(values: readonly string[], value: unknown): value is string {
  return typeof value === "string" && values.includes(value);
}

function hasUnknownField(item: Record<string, unknown>): boolean {
  return Object.keys(item).some((key) => !allowedInputKeys.has(key));
}

function hasUnknownStatus(item: Record<string, unknown>): boolean {
  return (
    !includesString(
      allowedCoachAthleteLinkStatuses,
      item.coach_athlete_link_status,
    ) ||
    !includesString(
      allowedLatestSessionRecordStatuses,
      item.latest_session_record_status,
    ) ||
    !includesString(
      allowedLatestCheckinRecordStatuses,
      item.latest_checkin_record_status,
    ) ||
    !includesString(
      allowedLatestCoachNoteStatuses,
      item.latest_coach_note_status,
    ) ||
    !includesString(allowedHistoryCountStatuses, item.history_count_status)
  );
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getSourceRecordRefs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function buildOneCoachQueueReviewItem(
  item: Record<string, unknown>,
): CoachQueueReviewOutputItem {
  const blockedReasons: CoachQueueBlockedReason[] = [];

  if (hasUnknownField(item)) {
    blockedReasons.push("unknown_queue_item_field");
  }

  if (hasUnknownStatus(item)) {
    blockedReasons.push("unknown_queue_item_status");
  }

  const sourceRecordRefs = getSourceRecordRefs(item.source_record_refs);

  if (sourceRecordRefs.length === 0) {
    blockedReasons.push("source_record_missing");
  }

  if (item.coach_athlete_link_status === "revoked") {
    blockedReasons.push("coach_athlete_link_revoked");
  }

  if (item.coach_athlete_link_status === "missing") {
    blockedReasons.push("coach_athlete_link_missing");
  }

  const blocked = blockedReasons.length > 0;
  const reviewRequired =
    !blocked && item.latest_session_record_status === "review_required";

  const queueStatus: CoachQueueStatus = blocked
    ? "blocked"
    : reviewRequired
      ? "review_required"
      : "available";

  return {
    queue_item_id: getString(item.queue_item_id),
    coach_id: getString(item.coach_id),
    athlete_id: getString(item.athlete_id),
    queue_status: queueStatus,
    review_required: reviewRequired,
    blocked_reasons: blockedReasons,
    source_record_refs: sourceRecordRefs,
  };
}

export function buildCoachQueueReviewSurface(
  inputItems: readonly Record<string, unknown>[],
): CoachQueueReviewOutputItem[] {
  return inputItems
    .map((item) => buildOneCoachQueueReviewItem(item))
    .sort((left, right) => {
      const statusDelta =
        coachQueueReviewStatusOrder[left.queue_status] -
        coachQueueReviewStatusOrder[right.queue_status];

      if (statusDelta !== 0) {
        return statusDelta;
      }

      const athleteDelta = left.athlete_id.localeCompare(right.athlete_id);

      if (athleteDelta !== 0) {
        return athleteDelta;
      }

      return left.queue_item_id.localeCompare(right.queue_item_id);
    });
}
