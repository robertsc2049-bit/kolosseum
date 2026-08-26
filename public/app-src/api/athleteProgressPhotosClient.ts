import { ApiRequestError, type JsonRecord } from "./transport";

export const PROGRESS_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PROGRESS_PHOTO_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateProgressPhotoClientSide(file: File | undefined): string | null {
  if (!file) return "Choose a photo to upload.";
  if (!PROGRESS_PHOTO_IMAGE_TYPES.includes(file.type)) {
    return "That file type isn't supported. Use a JPEG/PNG/WEBP photo.";
  }
  if (file.size > PROGRESS_PHOTO_MAX_BYTES) {
    return "Photos must be 10MB or smaller.";
  }
  return null;
}

export async function loadProgressPhotosSelf(): Promise<JsonRecord[]> {
  const response = await fetch("/progress-photos", { credentials: "same-origin" });
  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    throw new ApiRequestError(String(payload.error ?? "progress_photos_load_failed"), response.status, payload);
  }
  return Array.isArray(payload.photos) ? (payload.photos as JsonRecord[]) : [];
}

export type UploadProgressPhotoInput = {
  file: File;
  takenAtIso8601?: string;
  caption?: string;
};

// DEV NOTE: ported verbatim from app.js's uploadProgressPhoto() - multipart
// upload bypasses api/transport.ts's request() helper entirely (it always
// sends JSON), same as legacy bypassed its own api() wrapper, so the
// browser can set its own multipart/form-data boundary header.
export async function uploadProgressPhotoSelf(input: UploadProgressPhotoInput, csrfToken: string): Promise<JsonRecord> {
  const formData = new FormData();
  formData.append("photo", input.file);
  if (input.takenAtIso8601) formData.append("taken_at_iso8601", input.takenAtIso8601);
  if (input.caption) formData.append("caption", input.caption);

  const response = await fetch("/progress-photos", {
    method: "POST",
    credentials: "same-origin",
    headers: { "x-kolosseum-csrf": csrfToken },
    body: formData
  });

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    throw new ApiRequestError(String(payload.error ?? "progress_photo_upload_failed"), response.status, payload);
  }
  return payload.photo as JsonRecord;
}
