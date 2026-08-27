// DEV NOTE: athlete-facing Today screen (FULL-UI-14C) - a separate API
// area from coach-workspace, hence its own client file. FULL-UI-15C session
// execution (start/complete/skip/pain/RPE/substitution/split/return/video
// feedback) was added here rather than a third file since it already shared
// loadAthleteSessionState() with Today's own read-only preview.

import { ApiRequestError, type JsonRecord, request } from "./transport";

export async function loadAthleteTodaySnapshot(athleteUserId: string): Promise<JsonRecord> {
  return request("POST", "/sessions/beta-athlete-today", { athlete_user_id: athleteUserId });
}

export async function loadAthleteSessionState(sessionId: string): Promise<JsonRecord> {
  return request("GET", `/sessions/${encodeURIComponent(sessionId)}/state`);
}

export function newClientRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `crid_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function startAthleteSession(sessionId: string, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/sessions/${encodeURIComponent(sessionId)}/start`, {}, csrfToken);
}

export async function postAthleteSessionEvent(
  sessionId: string,
  event: JsonRecord,
  csrfToken: string,
  clientRequestId: string = newClientRequestId()
): Promise<JsonRecord> {
  return request(
    "POST",
    `/sessions/${encodeURIComponent(sessionId)}/events`,
    { ...event, client_request_id: clientRequestId },
    csrfToken
  );
}

export async function requestSessionSubstitution(
  sessionId: string,
  exerciseId: string,
  unavailableEquipmentIds: string[],
  csrfToken: string
): Promise<JsonRecord> {
  return request(
    "POST",
    `/sessions/${encodeURIComponent(sessionId)}/substitution-request`,
    { exercise_id: exerciseId, unavailable_equipment_ids: unavailableEquipmentIds },
    csrfToken
  );
}

export async function loadExerciseContent(exerciseId: string): Promise<JsonRecord> {
  return request("GET", `/exercises/${encodeURIComponent(exerciseId)}/content`);
}

export async function loadExerciseReferenceMedia(exerciseId: string): Promise<JsonRecord> {
  return request("GET", `/exercises/${encodeURIComponent(exerciseId)}/reference-media`);
}

export const ATTACHMENT_VIDEO_TYPES = ["video/mp4", "video/quicktime"];
export const ATTACHMENT_MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export function validateSessionVideoFeedbackClientSide(file: File | undefined): string | null {
  if (!file) return "Choose a video to upload.";
  if (!ATTACHMENT_VIDEO_TYPES.includes(file.type)) {
    return "That file type isn't supported. Use an MP4/MOV video.";
  }
  if (file.size > ATTACHMENT_MAX_VIDEO_BYTES) {
    return "Videos must be 50MB or smaller.";
  }
  return null;
}

export type UploadSessionVideoFeedbackInput = {
  sessionId: string;
  exerciseId: string;
  exerciseLabel: string;
  file: File;
  caption?: string;
};

// DEV NOTE: ported from app.js's uploadExerciseVideo() - bypasses
// api/transport.ts's request() (always JSON) the same way
// athleteProgressPhotosClient.ts's uploadProgressPhotoSelf() does, so the
// browser sets its own multipart/form-data boundary header.
export async function uploadSessionVideoFeedback(
  input: UploadSessionVideoFeedbackInput,
  csrfToken: string
): Promise<JsonRecord> {
  const formData = new FormData();
  formData.append("video", input.file);
  formData.append("session_id", input.sessionId);
  formData.append("work_item_id", input.exerciseId);
  formData.append("exercise_label", input.exerciseLabel || "Exercise");
  formData.append("client_request_id", newClientRequestId());
  if (input.caption) formData.append("caption", input.caption);

  const response = await fetch("/video-feedback", {
    method: "POST",
    credentials: "same-origin",
    headers: { "x-kolosseum-csrf": csrfToken },
    body: formData
  });

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    throw new ApiRequestError(String(payload.error ?? payload.reason ?? "video_upload_failed"), response.status, payload);
  }
  return payload;
}
