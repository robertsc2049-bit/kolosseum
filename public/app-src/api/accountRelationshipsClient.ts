import { ApiRequestError, type JsonRecord, request } from "./transport";

// DEV NOTE: client functions for the five small panels app.js used to
// splice into #view-account via insertAdjacentElement("afterend", ...) on
// .two-column (pendingRelationshipInvitationsPanel/athleteRelationshipsPanel/
// coachOrgContextPanel/athleteOrgMessagesPanel/athleteCoachLinkPanel) - see
// screens/account/AccountCoachInvitationsPanel.tsx and its siblings.

export async function loadPendingRelationshipInvitations(): Promise<JsonRecord[]> {
  const response = await request("GET", "/coach-workspace/relationship-invitations");
  return Array.isArray(response.invitations) ? (response.invitations as JsonRecord[]) : [];
}

export async function acceptRelationshipInvitation(relationshipId: string, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/coach-workspace/relationship-invitations/${encodeURIComponent(relationshipId)}/accept`, {}, csrfToken);
}

export async function declineRelationshipInvitation(relationshipId: string, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/coach-workspace/relationship-invitations/${encodeURIComponent(relationshipId)}/decline`, {}, csrfToken);
}

export async function loadAthleteRelationshipsMine(): Promise<JsonRecord[]> {
  const response = await request("GET", "/coach-workspace/relationships/mine");
  return Array.isArray(response.relationships) ? (response.relationships as JsonRecord[]) : [];
}

export async function endAthleteRelationship(relationshipId: string, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/coach-workspace/relationships/${encodeURIComponent(relationshipId)}/end`, {}, csrfToken);
}

export async function loadCoachOrgMemberships(): Promise<JsonRecord[]> {
  const response = await request("GET", "/coach-workspace/org-memberships");
  return Array.isArray(response.memberships) ? (response.memberships as JsonRecord[]) : [];
}

export async function loadCoachOrgRoster(orgId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/coach-workspace/organisations/${encodeURIComponent(orgId)}/roster`);
  return Array.isArray(response.roster) ? (response.roster as JsonRecord[]) : [];
}

export async function resolveCoachOrgMembershipAction(membershipId: string, action: "accept" | "leave", csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/coach-workspace/org-memberships/${encodeURIComponent(membershipId)}/${action}`, {}, csrfToken);
}

export async function loadAthleteOrgContextMine(): Promise<JsonRecord[]> {
  const response = await request("GET", "/coach-workspace/org-context/mine").catch(() => ({ contexts: [] }));
  return Array.isArray(response.contexts) ? (response.contexts as JsonRecord[]) : [];
}

export async function loadAthleteOwnMessageThreadsMine(): Promise<JsonRecord[]> {
  const response = await request("GET", "/messages/athlete/threads");
  return Array.isArray(response.threads) ? (response.threads as JsonRecord[]) : [];
}

export async function loadAthleteOwnMessages(threadId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/messages/athlete/threads/${encodeURIComponent(threadId)}`);
  return Array.isArray(response.messages) ? (response.messages as JsonRecord[]) : [];
}

export type OrgMessageThreadEntry = { thread: JsonRecord; messages: JsonRecord[] };

export async function loadAthleteOrgMessageThreadsMine(): Promise<OrgMessageThreadEntry[]> {
  const response = await request("GET", "/messages/athlete/org-messages/threads");
  const threads = Array.isArray(response.threads) ? (response.threads as JsonRecord[]) : [];
  return Promise.all(
    threads.map(async (thread) => {
      const messagesResponse = await request("GET", `/messages/athlete/org-messages/threads/${encodeURIComponent(String(thread.thread_id))}`);
      const messages = Array.isArray(messagesResponse.messages) ? (messagesResponse.messages as JsonRecord[]) : [];
      return { thread, messages };
    })
  );
}

// DEV NOTE: ported verbatim from app.js's ATTACHMENT_*/validateAttachmentClientSide/
// sendMessageRequest - fast client-side feedback only, never the actual
// security boundary (the server's own content-sniffed validation in
// message_attachment_storage.ts).
export const ATTACHMENT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const ATTACHMENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ATTACHMENT_VIDEO_TYPES = ["video/mp4", "video/quicktime"];

export function validateAttachmentClientSide(file: File | null | undefined): string | null {
  if (!file) return null;
  const isImage = ATTACHMENT_IMAGE_TYPES.includes(file.type);
  const isVideo = ATTACHMENT_VIDEO_TYPES.includes(file.type);
  if (!isImage && !isVideo) {
    return "That file type isn't supported. Use a JPEG/PNG/WEBP photo or an MP4/MOV video.";
  }
  const maxBytes = isImage ? ATTACHMENT_MAX_IMAGE_BYTES : ATTACHMENT_MAX_VIDEO_BYTES;
  if (file.size > maxBytes) {
    return isImage ? "Photos must be 10MB or smaller." : "Videos must be 50MB or smaller.";
  }
  return null;
}

function newClientRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `crid_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// DEV NOTE: mirrors app.js's sendMessageRequest() - api()/request() always
// JSON.stringify's the body, so a message with an attachment needs a raw
// fetch instead (same pattern as athleteSessionClient.ts's
// uploadSessionVideoFeedback).
async function sendMessageRequest(path: string, bodyText: string, attachmentFile: File | null, csrfToken: string): Promise<JsonRecord> {
  if (!attachmentFile) {
    return request("POST", path, { body_text: bodyText, client_request_id: newClientRequestId() }, csrfToken);
  }

  const formData = new FormData();
  formData.append("body_text", bodyText);
  formData.append("client_request_id", newClientRequestId());
  formData.append("attachment", attachmentFile);

  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "x-kolosseum-csrf": csrfToken },
    body: formData
  });

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    throw new ApiRequestError(String(payload.error ?? payload.reason ?? "message_send_failed"), response.status, payload);
  }
  return payload;
}

export async function sendAthleteOwnMessage(coachUserId: string, bodyText: string, attachmentFile: File | null, csrfToken: string): Promise<JsonRecord> {
  return sendMessageRequest(`/messages/athlete/coaches/${encodeURIComponent(coachUserId)}/send`, bodyText, attachmentFile, csrfToken);
}

export async function sendAthleteOrgMessage(orgId: string, bodyText: string, attachmentFile: File | null, csrfToken: string): Promise<JsonRecord> {
  return sendMessageRequest(`/messages/athlete/org-messages/organisations/${encodeURIComponent(orgId)}/send`, bodyText, attachmentFile, csrfToken);
}
