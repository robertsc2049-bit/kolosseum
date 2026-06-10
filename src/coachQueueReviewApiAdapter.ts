import {
  buildCoachQueueReviewSurface,
  type CoachQueueReviewInputItem,
  type CoachQueueReviewOutputItem,
} from "./coachQueueReviewSurface.js";

export const coachQueueReviewApiAdapterSurfaceId =
  "coach_queue_review_api_adapter" as const;

export const coachQueueReviewApiAdapterVersion = "1.0.0" as const;

export type CoachQueueReviewApiAdapterError =
  | "coach_id_required"
  | "source_unavailable";

export interface CoachQueueReviewApiAdapterRequest {
  coach_id?: string;
}

export interface CoachQueueReviewSource {
  listCoachQueueReviewItems(): readonly CoachQueueReviewInputItem[];
}

export interface CoachQueueReviewApiAdapterOkResponse {
  ok: true;
  surface_id: typeof coachQueueReviewApiAdapterSurfaceId;
  version: typeof coachQueueReviewApiAdapterVersion;
  coach_id: string;
  items: CoachQueueReviewOutputItem[];
}

export interface CoachQueueReviewApiAdapterErrorResponse {
  ok: false;
  surface_id: typeof coachQueueReviewApiAdapterSurfaceId;
  version: typeof coachQueueReviewApiAdapterVersion;
  error: CoachQueueReviewApiAdapterError;
}

export type CoachQueueReviewApiAdapterResponse =
  | CoachQueueReviewApiAdapterOkResponse
  | CoachQueueReviewApiAdapterErrorResponse;

function cloneInputItem(
  item: CoachQueueReviewInputItem,
): CoachQueueReviewInputItem {
  return {
    queue_item_id: item.queue_item_id,
    coach_id: item.coach_id,
    athlete_id: item.athlete_id,
    coach_athlete_link_status: item.coach_athlete_link_status,
    latest_session_record_status: item.latest_session_record_status,
    latest_checkin_record_status: item.latest_checkin_record_status,
    latest_coach_note_status: item.latest_coach_note_status,
    history_count_status: item.history_count_status,
    source_record_refs: [...item.source_record_refs],
  };
}

export function createInMemoryCoachQueueReviewSource(
  items: readonly CoachQueueReviewInputItem[],
): CoachQueueReviewSource {
  const storedItems = items.map((item) => cloneInputItem(item));

  return {
    listCoachQueueReviewItems(): readonly CoachQueueReviewInputItem[] {
      return storedItems.map((item) => cloneInputItem(item));
    },
  };
}

function baseErrorResponse(
  error: CoachQueueReviewApiAdapterError,
): CoachQueueReviewApiAdapterErrorResponse {
  return {
    ok: false,
    surface_id: coachQueueReviewApiAdapterSurfaceId,
    version: coachQueueReviewApiAdapterVersion,
    error,
  };
}

export function getCoachQueueReviewApiAdapterResponse(
  request: CoachQueueReviewApiAdapterRequest,
  source: CoachQueueReviewSource,
): CoachQueueReviewApiAdapterResponse {
  const coachId =
    typeof request.coach_id === "string" ? request.coach_id.trim() : "";

  if (coachId.length === 0) {
    return baseErrorResponse("coach_id_required");
  }

  let sourceItems: readonly CoachQueueReviewInputItem[];

  try {
    sourceItems = source.listCoachQueueReviewItems();
  } catch {
    return baseErrorResponse("source_unavailable");
  }

  const coachItems = sourceItems
    .filter((item) => item.coach_id === coachId)
    .map((item) => ({ ...item, source_record_refs: [...item.source_record_refs] }));
  const queueItems = buildCoachQueueReviewSurface(coachItems);

  return {
    ok: true,
    surface_id: coachQueueReviewApiAdapterSurfaceId,
    version: coachQueueReviewApiAdapterVersion,
    coach_id: coachId,
    items: queueItems,
  };
}