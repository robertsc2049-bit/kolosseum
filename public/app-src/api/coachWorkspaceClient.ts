// DEV NOTE: coach_athlete_detail React sub-panels (athlete strength-profile
// editor, progress insights). coach_user_id is derived server-side from the
// session on every route below (see src/api/coach_workspace.handlers.ts's
// and src/api/progress_insights.routes.ts's authenticatedCoach calls) - the
// client only ever needs to send athlete_user_id.

import { ApiRequestError, type JsonRecord, request } from "./transport";

export function loadAthleteStrengthProfile(athleteUserId: string): Promise<JsonRecord> {
  return request(
    "GET",
    `/coach-workspace/athlete-strength-profile?athlete_user_id=${encodeURIComponent(athleteUserId)}`
  );
}

export function saveAthleteStrengthProfile(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/coach-workspace/athlete-strength-profile", input, csrfToken);
}

export async function loadTemplateExercises(): Promise<JsonRecord[]> {
  const response = await request("GET", "/templates/exercises");
  return Array.isArray(response.exercises) ? (response.exercises as JsonRecord[]) : [];
}

export async function loadTemplateEquipmentCatalog(): Promise<JsonRecord[]> {
  const response = await request("GET", "/templates/exercises");
  return Array.isArray(response.equipment_catalog) ? (response.equipment_catalog as JsonRecord[]) : [];
}

export async function loadAthleteProgressInsights(athleteUserId: string): Promise<JsonRecord | null> {
  const response = await request("GET", `/progress-insights/coach/${encodeURIComponent(athleteUserId)}`);
  return response.insights && typeof response.insights === "object" ? (response.insights as JsonRecord) : null;
}

export async function loadCoachProgressRollup(): Promise<JsonRecord[]> {
  const response = await request("GET", "/progress-insights/coach-roster");
  return Array.isArray(response.roster) ? (response.roster as JsonRecord[]) : [];
}

export async function loadAthleteWeeklyCheckins(athleteUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/weekly-checkins/coach/${encodeURIComponent(athleteUserId)}`);
  return Array.isArray(response.checkins) ? (response.checkins as JsonRecord[]) : [];
}

export async function loadAthleteGoals(athleteUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/athlete-goals/coach/${encodeURIComponent(athleteUserId)}`);
  return Array.isArray(response.goals) ? (response.goals as JsonRecord[]) : [];
}

export async function loadAthleteDeviceConnections(athleteUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/device-sync/connections/coach/${encodeURIComponent(athleteUserId)}`);
  return Array.isArray(response.connections) ? (response.connections as JsonRecord[]) : [];
}

export async function loadAthleteDeviceMetrics(athleteUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/device-sync/metrics/coach/${encodeURIComponent(athleteUserId)}`);
  return Array.isArray(response.entries) ? (response.entries as JsonRecord[]) : [];
}

export async function loadAthleteBodyMetrics(athleteUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/body-metrics/coach/${encodeURIComponent(athleteUserId)}`);
  return Array.isArray(response.entries) ? (response.entries as JsonRecord[]) : [];
}

export function saveAthleteBodyMetric(
  athleteUserId: string,
  input: JsonRecord,
  csrfToken: string
): Promise<JsonRecord> {
  return request("POST", `/body-metrics/coach/${encodeURIComponent(athleteUserId)}`, input, csrfToken);
}

export async function loadAthleteProgressPhotos(athleteUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/progress-photos/coach/${encodeURIComponent(athleteUserId)}`);
  return Array.isArray(response.photos) ? (response.photos as JsonRecord[]) : [];
}

export async function loadAthleteHabits(athleteUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/habits/coach/${encodeURIComponent(athleteUserId)}`);
  return Array.isArray(response.habits) ? (response.habits as JsonRecord[]) : [];
}

// DEV NOTE: note_history is one field of the same composite
// /coach-workspace/athlete-detail response that also carries assignment/
// strength/bodyweight/event/session history - those stay legacy (rendered
// by app.js's renderAthleteDetail), so this fetches the same endpoint
// independently and reads out only note_history. See
// AthleteCoachNotesPanel.tsx's DEV NOTE for why note *creation* stays
// legacy too.
export async function loadAthleteCoachNotes(athleteUserId: string): Promise<JsonRecord[]> {
  const response = await request(
    "GET",
    `/coach-workspace/athlete-detail?athlete_user_id=${encodeURIComponent(athleteUserId)}`
  );
  const detail = response.detail && typeof response.detail === "object" ? (response.detail as JsonRecord) : {};
  return Array.isArray(detail.note_history) ? (detail.note_history as JsonRecord[]) : [];
}

// DEV NOTE: current-programme/current-event summary cards and the
// assignment/strength/bodyweight/event-link history lists (see
// useAthleteHistory.ts) read the same composite response as
// loadAthleteCoachNotes above, just different fields. templates/events are
// fetched separately purely to resolve a friendly name for
// current_assignment.template_id / current_event_link.event_id - both
// legacy routes (unlike everything else in this file) resolve
// coach_user_id from a client-supplied query param rather than the
// session, since they predate the authenticatedCoach(request, ...)
// convention (see src/api/templates.handlers.ts's getCoachTemplates). The
// coach's own user_id is read from /account/detail (session-authenticated)
// rather than reaching into legacy state.profile.coachUserId.
export async function loadAthleteHistoryDetail(athleteUserId: string): Promise<JsonRecord> {
  const response = await request(
    "GET",
    `/coach-workspace/athlete-detail?athlete_user_id=${encodeURIComponent(athleteUserId)}`
  );
  return response.detail && typeof response.detail === "object" ? (response.detail as JsonRecord) : {};
}

export async function loadCoachTemplates(coachUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/templates?coach_user_id=${encodeURIComponent(coachUserId)}`);
  return Array.isArray(response.templates) ? (response.templates as JsonRecord[]) : [];
}

export async function loadCoachEventsList(coachUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/coach-workspace/events?coach_user_id=${encodeURIComponent(coachUserId)}`);
  return Array.isArray(response.events) ? (response.events as JsonRecord[]) : [];
}

// DEV NOTE: the "Compile event" form - see useCoachEventCreate.ts/
// CoachEventCreatePanel.tsx. Session-authenticated like every other write
// in this file (coach_user_id in the payload is overridden server-side,
// same as createAthleteAssignment above - sent anyway for parity with the
// legacy payload shape createCoachEvent()'s exactKeys check expects).
export function createCoachEvent(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/coach-workspace/events", input, csrfToken);
}

// DEV NOTE: FULL-UI-09C standalone event detail/lifecycle - see
// useCoachEventDetail.ts/CoachEventDetailPanel.tsx. Ported from the now-
// deleted event_lifecycle_ui.js, whose DOM targets (#eventList/#eventForm/
// #athleteEventLinks) were removed when the Events screen migrated to
// React, leaving this real, tested, DB-backed backend feature
// (cancel/archive/re-version/link/unlink an event) with no working UI
// anywhere - every one of its functions guarded on a missing element and
// silently no-op'd on render while still firing real, wasted fetches (on
// every page load, hashchange to #/coach/events/:id, and "Refresh" click).
export function loadStandaloneEventDetail(eventId: string): Promise<JsonRecord> {
  return request("GET", `/coach-workspace/events/${encodeURIComponent(eventId)}`);
}

export function createStandaloneEventVersion(eventId: string, input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/coach-workspace/events/${encodeURIComponent(eventId)}/version`, input, csrfToken);
}

export function cancelStandaloneEvent(eventId: string, expectedCurrentRecordSha256: string, csrfToken: string): Promise<JsonRecord> {
  return request(
    "POST",
    `/coach-workspace/events/${encodeURIComponent(eventId)}/cancel`,
    { expected_current_record_sha256: expectedCurrentRecordSha256 },
    csrfToken
  );
}

export function archiveStandaloneEvent(eventId: string, expectedCurrentRecordSha256: string, csrfToken: string): Promise<JsonRecord> {
  return request(
    "POST",
    `/coach-workspace/events/${encodeURIComponent(eventId)}/archive`,
    { expected_current_record_sha256: expectedCurrentRecordSha256 },
    csrfToken
  );
}

export function linkStandaloneEventAthlete(
  eventId: string,
  athleteUserId: string,
  input: JsonRecord,
  csrfToken: string
): Promise<JsonRecord> {
  return request(
    "POST",
    `/coach-workspace/events/${encodeURIComponent(eventId)}/athletes/${encodeURIComponent(athleteUserId)}/link`,
    input,
    csrfToken
  );
}

export function unlinkStandaloneEventAthlete(eventId: string, athleteUserId: string, csrfToken: string): Promise<JsonRecord> {
  return request(
    "POST",
    `/coach-workspace/events/${encodeURIComponent(eventId)}/athletes/${encodeURIComponent(athleteUserId)}/unlink`,
    {},
    csrfToken
  );
}

// DEV NOTE: the coach's athlete directory (roster) - see
// useAthleteDirectory.ts and AthleteDirectoryPanel.tsx. Unlike the
// athlete-detail sub-panels above, this is a whole-workspace read, not
// scoped to one athlete.
export async function loadCoachRelationships(coachUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/coach-workspace/relationships?coach_user_id=${encodeURIComponent(coachUserId)}`);
  return Array.isArray(response.relationships) ? (response.relationships as JsonRecord[]) : [];
}

export async function loadCoachAssignments(coachUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/coach-workspace/assignments?coach_user_id=${encodeURIComponent(coachUserId)}`);
  return Array.isArray(response.assignments) ? (response.assignments as JsonRecord[]) : [];
}

// DEV NOTE: the "Assign from athlete profile" panel - see
// useAthleteProfileAssignment.ts/AthleteProfileAssignmentPanel.tsx. A
// standalone, unreachable (no nav button, no route) twin of this same form
// still lives in app.js as dead code (assignmentForm/recordAssignment()
// etc.) - out of scope for this slice, left for its own cleanup.
export async function loadAthleteEventLinks(athleteUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/coach-workspace/athlete-event-links?athlete_user_id=${encodeURIComponent(athleteUserId)}`);
  return Array.isArray(response.links) ? (response.links as JsonRecord[]) : [];
}

export function createAthleteAssignment(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/coach-workspace/athlete-assignment", input, csrfToken);
}

export function replaceAthleteAssignment(assignmentId: string, input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/coach-workspace/athlete-assignment/${encodeURIComponent(assignmentId)}/replace`, input, csrfToken);
}

export function cancelAthleteAssignment(assignmentId: string, input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/coach-workspace/athlete-assignment/${encodeURIComponent(assignmentId)}/cancel`, input, csrfToken);
}

// DEV NOTE: FULL-UI-17 review queue - see useCoachReview.ts. Fetches every
// review record for the coach unfiltered (matching legacy's
// refreshCoachReviewQueue()), never passing the route's optional
// athlete_user_id filter - athlete/search/status filtering all happen
// client-side, same as legacy.
export async function loadCoachReviews(coachUserId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/coach-workspace/reviews?coach_user_id=${encodeURIComponent(coachUserId)}`);
  return Array.isArray(response.records) ? (response.records as JsonRecord[]) : [];
}

export function submitCoachSessionReview(sessionId: string, input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", `/coach-workspace/session-review/${encodeURIComponent(sessionId)}`, input, csrfToken);
}

// DEV NOTE: an older "beta" route (predates the /coach-workspace family)
// mounted at /sessions - kept as-is, ported verbatim from legacy's
// recordCoachNote()/recordAthleteDetailNote() (the Review view's and the
// athlete-profile's note forms both posted here). Shared by
// useCoachReview.ts and useAthleteCoachNotes.ts. Unlike every other write
// in this file, this route is not session/authenticatedCoach-authorised -
// see beta17_coach_managed_service.ts's assertRecordIntegrity/
// permissionContext. It requires the caller to echo back two hash-signed
// "capability object" records verbatim (coach_profile, relationship)
// rather than deriving authorization from the session.
export function submitCoachNote(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/sessions/beta-coach-notes", input, csrfToken);
}

export async function loadCoachMessageUnreadCounts(): Promise<Record<string, number>> {
  const response = await request("GET", "/messages/coach/threads");
  const threads = Array.isArray(response.threads) ? (response.threads as JsonRecord[]) : [];
  const byAthlete: Record<string, number> = {};
  for (const thread of threads) {
    const athleteUserId = String(thread.athlete_user_id ?? "");
    if (athleteUserId) byAthlete[athleteUserId] = Number(thread.unread_count) || 0;
  }
  return byAthlete;
}

// DEV NOTE: the 1:1 coach-athlete messaging panel (embedded in the athlete
// training-profile shell) - see useCoachAthleteMessages.ts/
// CoachAthleteMessagePanel.tsx. GET .../threads/:thread_id marks the
// thread read for this viewer as a server-side side effect of the fetch
// itself (see listCoachAthleteThreadMessages) - there's no separate
// mark-read call to make.
export async function loadCoachMessageThreads(): Promise<JsonRecord[]> {
  const response = await request("GET", "/messages/coach/threads");
  return Array.isArray(response.threads) ? (response.threads as JsonRecord[]) : [];
}

export async function loadCoachMessagesForThread(threadId: string): Promise<JsonRecord[]> {
  const response = await request("GET", `/messages/coach/threads/${encodeURIComponent(threadId)}`);
  return Array.isArray(response.messages) ? (response.messages as JsonRecord[]) : [];
}

function newClientRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `crid_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// api()/request() always JSON.stringify's the body, so a message with an
// attachment needs a raw fetch instead - mirrors app.js's (removed)
// sendMessageRequest() and accountRelationshipsClient.ts's private twin.
export async function sendCoachAthleteMessage(
  athleteUserId: string,
  bodyText: string,
  attachmentFile: File | null,
  csrfToken: string
): Promise<JsonRecord> {
  const path = `/messages/coach/athletes/${encodeURIComponent(athleteUserId)}/send`;

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

// DEV NOTE: FULL-UI-24 lawful, non-opaque-ID invitation - the coach's side
// of the invite/accept flow whose athlete-side half
// (accountRelationshipsClient.ts's loadPendingRelationshipInvitations/
// accept/decline) shipped in the previous slice. Ported from app.js's
// (removed) inviteAthleteByEmail().
export function inviteAthleteByEmail(athleteEmail: string, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/coach-workspace/relationship-invitations", { athlete_email: athleteEmail }, csrfToken);
}

export function sendCoachBroadcast(bodyText: string, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/messages/coach/broadcast", { body_text: bodyText }, csrfToken);
}

export function loadBroadcastReadStatus(broadcastId: string): Promise<JsonRecord> {
  return request("GET", `/messages/coach/broadcasts/${encodeURIComponent(broadcastId)}/read-status`);
}

// DEV NOTE: an older "beta" route (predates the /coach-workspace family) -
// a single upsert-shaped record covering relationship creation (manual
// "Add athlete" connect form) AND the audit panel's revoke/cancel
// transition, matching legacy's connectAthlete()/
// transitionCoachRelationship(), both of which built this same payload
// shape by hand and posted it here.
export function upsertCoachRelationship(input: JsonRecord, csrfToken: string): Promise<JsonRecord> {
  return request("POST", "/sessions/beta-coach-relationship", input, csrfToken);
}

export type OrgMessageThreadEntry = { thread: JsonRecord; messages: JsonRecord[] };

// DEV NOTE: read-only mirror of an org-owner<->athlete thread - see
// org_athlete_messaging_coach_visibility_surface.test.mjs. A coach can in
// principle see threads across more than one shared org, so this reads a
// thread list then fetches each thread's messages, same two-step shape as
// legacy's refreshCoachAthleteOrgMessages.
export async function loadAthleteOrgMessageThreads(athleteUserId: string): Promise<OrgMessageThreadEntry[]> {
  const threadsResponse = await request(
    "GET",
    `/messages/coach/athletes/${encodeURIComponent(athleteUserId)}/org-messages/threads`
  );
  const threads = Array.isArray(threadsResponse.threads) ? (threadsResponse.threads as JsonRecord[]) : [];

  return Promise.all(
    threads.map(async (thread) => {
      const messagesResponse = await request(
        "GET",
        `/messages/coach/org-messages/threads/${encodeURIComponent(String(thread.thread_id))}`
      );
      const messages = Array.isArray(messagesResponse.messages) ? (messagesResponse.messages as JsonRecord[]) : [];
      return { thread, messages };
    })
  );
}
