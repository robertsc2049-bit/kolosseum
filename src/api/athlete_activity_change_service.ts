// DEV NOTE: FULL-UI-83 athlete activity-change request/response state
// machine, generalized in slice 3 of the sport-declaration redesign to also
// carry position changes via a change_kind: "activity" | "position"
// discriminator - the propose/confirm/decline/queue/cancel machinery is
// entirely field-agnostic once the record carries which field it's
// changing. COALESCE(record_payload->>'change_kind', 'activity') resolves
// every pre-migration row (no change_kind yet) as 'activity', so the
// existing production activity-change track is unaffected, and an athlete
// can have one pending activity-change and one pending position-change
// simultaneously without either superseding the other.
//
// Only the coach-1:1-propose path needs this state machine for position -
// the athlete's own self-service position edit is immediate-only, straight
// through athlete_onboarding_service.ts's updateAthleteOnboardingPreferences
// (see PositionSelect in AthleteOnboardingPanel.tsx), and both the
// team-coach and org-owner direct-override tiers write straight through
// amendAthleteDeclaration() themselves - neither needs propose/confirm.
//
// An athlete's declared activity_id/position (src/api/athlete_onboarding_service.ts)
// are otherwise permanently frozen after onboarding completes - this lets
// them change later, self-service or coach-proposed, immediately or
// deferred until the athlete's one active session finishes. The coach's own
// write here is only ever a "proposed" record; only the athlete's own
// confirm action (or the deferred-apply hook, standing in for the athlete's
// own earlier choice) ever calls amendAthleteDeclaration() - this keeps
// every actual declaration mutation attributable to the athlete, matching
// beta17_coach_managed_service.ts's own stated boundary of never mutating
// athlete declarations directly from a coach-authored write.

import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import { persistBetaProductRecord } from "./beta_product_record_store.js";
import {
  amendAthleteDeclaration,
  assertPositionMatchesActivity,
  getAthleteDeclaredActivityAndPosition,
  validateAthleteActivityId,
  validateAthletePosition
} from "./athlete_onboarding_service.js";
import { requireCoachAthleteAccess } from "./beta19_coach_workspace_service.js";

type Json = Record<string, unknown>;
type QueryClient = Pick<PoolClient, "query">;

export const ACTIVITY_CHANGE_APPLY_AT = Object.freeze(["immediately", "after_current_session"] as const);
export type ActivityChangeApplyAt = (typeof ACTIVITY_CHANGE_APPLY_AT)[number];

const REQUEST_STATES = Object.freeze(["proposed", "declined", "cancelled", "queued", "applied"] as const);
type RequestState = (typeof REQUEST_STATES)[number];
type RequestedBy = "athlete" | "coach";
const CHANGE_KINDS = Object.freeze(["activity", "position"] as const);
type ChangeKind = (typeof CHANGE_KINDS)[number];

export class AthleteActivityChangeError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.name = "AthleteActivityChangeError";
    this.code = code;
    this.status = status;
  }
}

function record(value: unknown): value is Json {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/gu, "")}`;
}
function stable(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (typeof value === "object") {
    const item = value as Json;
    return `{${Object.keys(item).sort().map((key) => `${JSON.stringify(key)}:${stable(item[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
function hash(value: unknown): string {
  return crypto.createHash("sha256").update(stable(value), "utf8").digest("hex");
}
function validateApplyAt(value: unknown): ActivityChangeApplyAt {
  const clean = text(value);
  if (!(ACTIVITY_CHANGE_APPLY_AT as readonly string[]).includes(clean)) {
    throw new AthleteActivityChangeError("activity_change_apply_at_invalid", 422);
  }
  return clean as ActivityChangeApplyAt;
}
function requestedByOf(value: unknown): RequestedBy {
  return text(value) === "coach" ? "coach" : "athlete";
}
// Pre-migration rows have no change_kind field at all - they're always an
// activity-change (the only kind that existed before this slice).
function changeKindOf(value: unknown): ChangeKind {
  return text(value) === "position" ? "position" : "activity";
}
function newValueOf(payload: Json): string {
  return changeKindOf(payload.change_kind) === "position"
    ? text(payload.new_position)
    : text(payload.new_activity_id);
}
function changeFieldsFor(changeKind: ChangeKind, newValue: string): { activity_id: string } | { position: string } {
  return changeKind === "position" ? { position: newValue } : { activity_id: newValue };
}

// DEV NOTE: this codebase has no "programme complete"/"block complete"
// concept anywhere - only individual session execution_status (completed/
// partial) exists (see src/api/session_state_write_service.ts). "Deferred"
// therefore means "until the athlete's one active in-progress session
// reaches a terminal state" - confirmed acceptable scope during design.
async function findActiveSessionId(client: QueryClient, athleteUserId: string): Promise<string | null> {
  const result = await client.query(
    `SELECT session_id FROM sessions
     WHERE beta_subject_user_id = $1 AND status = 'in_progress'
     ORDER BY created_at DESC LIMIT 1`,
    [athleteUserId]
  );
  return text(result.rows?.[0]?.session_id) || null;
}

async function latestRequestOfKind(
  client: QueryClient, athleteUserId: string, changeKind: ChangeKind
): Promise<Json | null> {
  const result = await client.query(
    `SELECT record_payload FROM beta_product_records
     WHERE record_type = 'athlete_activity_change_request' AND subject_user_id = $1
       AND COALESCE(record_payload->>'change_kind', 'activity') = $2
     ORDER BY effective_at DESC, created_at DESC LIMIT 1`,
    [athleteUserId, changeKind]
  );
  const payload = result.rows?.[0]?.record_payload;
  return record(payload) ? payload : null;
}

// Matches either the exact request_id or a row that already supersedes it -
// lets a caller pass the id of the row it's responding to and always land
// on the current tip of that chain, even if something else already moved
// it. Deliberately not filtered by change_kind - a chain's kind never
// changes across its own rows, so the request_id/supersedes_request_id
// match alone is enough; callers read change_kind off the row they get back.
async function latestInChain(client: QueryClient, athleteUserId: string, requestId: string): Promise<Json | null> {
  const result = await client.query(
    `SELECT record_payload FROM beta_product_records
     WHERE record_type = 'athlete_activity_change_request' AND subject_user_id = $1
       AND (record_payload->>'request_id' = $2 OR record_payload->>'supersedes_request_id' = $2)
     ORDER BY effective_at DESC, created_at DESC LIMIT 1`,
    [athleteUserId, requestId]
  );
  const payload = result.rows?.[0]?.record_payload;
  return record(payload) ? payload : null;
}

function buildRecord(input: {
  requestId: string;
  athleteUserId: string;
  actorUserId: string;
  requestedBy: RequestedBy;
  changeKind: ChangeKind;
  newValue: string;
  requestState: RequestState;
  queuedForSessionId: string | null;
  supersedesRequestId: string | null;
  at: string;
}): Readonly<Json> {
  const core = {
    record_type: "athlete_activity_change_request",
    request_id: input.requestId,
    athlete_user_id: input.athleteUserId,
    actor_user_id: input.actorUserId,
    requested_by: input.requestedBy,
    change_kind: input.changeKind,
    new_activity_id: input.changeKind === "activity" ? input.newValue : null,
    new_position: input.changeKind === "position" ? input.newValue : null,
    request_state: input.requestState,
    queued_for_session_id: input.queuedForSessionId,
    supersedes_request_id: input.supersedesRequestId,
    effective_at_iso8601: input.at
  };
  return Object.freeze({ ...core, record_sha256: hash(core) });
}

// A fresh top-level request (self-service, or a new coach proposal)
// supersedes any request of this athlete's own OF THE SAME KIND still
// sitting "proposed" or "queued" - otherwise a stale queued change could
// silently apply later, on top of whatever the newer request already
// decided. A pending request of the OTHER kind is left alone by design -
// an activity-change and a position-change can be pending independently.
async function supersedeAnyPendingRequestOfKind(
  client: QueryClient, athleteUserId: string, actorUserId: string, changeKind: ChangeKind, at: string
): Promise<void> {
  const latest = await latestRequestOfKind(client, athleteUserId, changeKind);
  if (!latest) return;
  const requestState = text(latest.request_state);
  if (requestState !== "queued" && requestState !== "proposed") return;
  const cancelledRecord = buildRecord({
    requestId: id("activity_change_request"), athleteUserId, actorUserId,
    requestedBy: requestedByOf(latest.requested_by),
    changeKind, newValue: newValueOf(latest), requestState: "cancelled",
    queuedForSessionId: null, supersedesRequestId: text(latest.request_id), at
  });
  await persistBetaProductRecord(cancelledRecord, client);
}

async function applyOrQueue(
  client: QueryClient,
  athleteUserId: string,
  actorUserId: string,
  requestedBy: RequestedBy,
  changeKind: ChangeKind,
  newValue: string,
  applyAt: ActivityChangeApplyAt,
  supersedesRequestId: string | null,
  declarationSource: string
): Promise<Readonly<Json>> {
  const at = new Date().toISOString();
  await supersedeAnyPendingRequestOfKind(client, athleteUserId, actorUserId, changeKind, at);

  const activeSessionId = applyAt === "after_current_session"
    ? await findActiveSessionId(client, athleteUserId)
    : null;

  if (activeSessionId) {
    const queuedRecord = buildRecord({
      requestId: id("activity_change_request"), athleteUserId, actorUserId, requestedBy,
      changeKind, newValue, requestState: "queued", queuedForSessionId: activeSessionId,
      supersedesRequestId, at
    });
    await persistBetaProductRecord(queuedRecord, client);
    return queuedRecord;
  }

  await amendAthleteDeclaration(client, athleteUserId, changeFieldsFor(changeKind, newValue), declarationSource);
  const appliedRecord = buildRecord({
    requestId: id("activity_change_request"), athleteUserId, actorUserId, requestedBy,
    changeKind, newValue, requestState: "applied", queuedForSessionId: null,
    supersedesRequestId, at
  });
  await persistBetaProductRecord(appliedRecord, client);
  return appliedRecord;
}

// --- Athlete self-service (activity only - position self-service is
// --- immediate-only, via athlete_onboarding_service.ts's preferences
// --- editor, and never needs this state machine) -------------------------

export async function requestAthleteActivityChange(
  athleteUserId: string,
  input: unknown
): Promise<Readonly<Json>> {
  if (!record(input)) throw new AthleteActivityChangeError("activity_change_request_invalid", 422);
  const newActivityId = validateAthleteActivityId(input.new_activity_id);
  const applyAt = validateApplyAt(input.apply_at);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await applyOrQueue(
      client, athleteUserId, athleteUserId, "athlete", "activity", newActivityId, applyAt,
      null, "athlete_activity_changed"
    );
    await client.query("COMMIT");
    return result;
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally { client.release(); }
}

export async function cancelQueuedActivityChange(
  athleteUserId: string,
  requestId: string
): Promise<Readonly<Json>> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const queued = await latestInChain(client, athleteUserId, requestId);
    if (!queued || text(queued.request_state) !== "queued") {
      throw new AthleteActivityChangeError("activity_change_request_not_queued", 409);
    }
    const changeKind = changeKindOf(queued.change_kind);
    const at = new Date().toISOString();
    const cancelledRecord = buildRecord({
      requestId: id("activity_change_request"), athleteUserId, actorUserId: athleteUserId,
      requestedBy: requestedByOf(queued.requested_by),
      changeKind, newValue: newValueOf(queued), requestState: "cancelled",
      queuedForSessionId: null, supersedesRequestId: text(queued.request_id), at
    });
    await persistBetaProductRecord(cancelledRecord, client);
    await client.query("COMMIT");
    return cancelledRecord;
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally { client.release(); }
}

// --- Coach-proposed, athlete-confirmed (both activity and position) ------

export async function proposeAthleteActivityChangeForCoach(
  coachUserId: string,
  input: unknown
): Promise<Readonly<Json>> {
  if (!record(input)) throw new AthleteActivityChangeError("activity_change_proposal_invalid", 422);
  const athleteUserId = text(input.athlete_user_id);
  if (!athleteUserId) throw new AthleteActivityChangeError("activity_change_proposal_athlete_required", 422);
  const newActivityId = validateAthleteActivityId(input.activity_id);

  await requireCoachAthleteAccess(coachUserId, athleteUserId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const at = new Date().toISOString();
    await supersedeAnyPendingRequestOfKind(client, athleteUserId, coachUserId, "activity", at);
    const proposalRecord = buildRecord({
      requestId: id("activity_change_request"), athleteUserId, actorUserId: coachUserId,
      requestedBy: "coach", changeKind: "activity", newValue: newActivityId, requestState: "proposed",
      queuedForSessionId: null, supersedesRequestId: null, at
    });
    await persistBetaProductRecord(proposalRecord, client);
    await client.query("COMMIT");
    return proposalRecord;
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally { client.release(); }
}

// Structurally identical to proposeAthleteActivityChangeForCoach - same
// requireCoachAthleteAccess call (the confirmed 1:1 tier) - but validates a
// position against the athlete's CURRENT activity via
// getAthleteDeclaredActivityAndPosition, since position is never itself
// projected into the phase1/engine record.
export async function proposeAthletePositionChangeForCoach(
  coachUserId: string,
  input: unknown
): Promise<Readonly<Json>> {
  if (!record(input)) throw new AthleteActivityChangeError("activity_change_proposal_invalid", 422);
  const athleteUserId = text(input.athlete_user_id);
  if (!athleteUserId) throw new AthleteActivityChangeError("activity_change_proposal_athlete_required", 422);
  const newPosition = validateAthletePosition(input.position);

  await requireCoachAthleteAccess(coachUserId, athleteUserId);
  const declared = await getAthleteDeclaredActivityAndPosition(athleteUserId);
  assertPositionMatchesActivity(newPosition, declared.activity_id ?? undefined);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const at = new Date().toISOString();
    await supersedeAnyPendingRequestOfKind(client, athleteUserId, coachUserId, "position", at);
    const proposalRecord = buildRecord({
      requestId: id("activity_change_request"), athleteUserId, actorUserId: coachUserId,
      requestedBy: "coach", changeKind: "position", newValue: newPosition, requestState: "proposed",
      queuedForSessionId: null, supersedesRequestId: null, at
    });
    await persistBetaProductRecord(proposalRecord, client);
    await client.query("COMMIT");
    return proposalRecord;
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally { client.release(); }
}

export async function respondToActivityChangeProposal(
  athleteUserId: string,
  input: unknown
): Promise<Readonly<Json>> {
  if (!record(input)) throw new AthleteActivityChangeError("activity_change_response_invalid", 422);
  const requestId = text(input.request_id);
  if (!requestId) throw new AthleteActivityChangeError("activity_change_response_request_id_required", 422);
  const response = text(input.response);
  if (response !== "confirmed" && response !== "declined") {
    throw new AthleteActivityChangeError("activity_change_response_invalid", 422);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const proposal = await latestInChain(client, athleteUserId, requestId);
    if (!proposal || text(proposal.request_state) !== "proposed") {
      throw new AthleteActivityChangeError("activity_change_proposal_not_found", 404);
    }
    const changeKind = changeKindOf(proposal.change_kind);
    const newValue = newValueOf(proposal);
    const at = new Date().toISOString();

    if (response === "declined") {
      const declinedRecord = buildRecord({
        requestId: id("activity_change_request"), athleteUserId, actorUserId: athleteUserId,
        requestedBy: "coach", changeKind, newValue, requestState: "declined",
        queuedForSessionId: null, supersedesRequestId: text(proposal.request_id), at
      });
      await persistBetaProductRecord(declinedRecord, client);
      await client.query("COMMIT");
      return declinedRecord;
    }

    const applyAt = validateApplyAt(input.apply_at);
    const declarationSource = changeKind === "position"
      ? "coach_proposed_position_change_confirmed"
      : "coach_proposed_activity_change_confirmed";
    const result = await applyOrQueue(
      client, athleteUserId, athleteUserId, "coach", changeKind, newValue, applyAt,
      text(proposal.request_id), declarationSource
    );
    await client.query("COMMIT");
    return result;
  }
  catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
  finally { client.release(); }
}

// --- Deferred-apply hook, called from the session-completion write path --

// DEV NOTE: must be cheap and safe to call unconditionally on every session
// that reaches a terminal state - a no-op the overwhelming majority of the
// time. Runs inside the CALLER's own transaction/client (session_state_write_
// service.ts's appendRuntimeEventMutation) so the queued change and the
// session that unblocked it commit atomically together. Checks both change
// kinds independently, since an athlete can have one of each queued for the
// very same session at once.
async function applyQueuedChangeOfKindIfDue(
  client: QueryClient,
  athleteUserId: string,
  sessionId: string,
  changeKind: ChangeKind
): Promise<void> {
  const result = await client.query(
    `SELECT record_payload FROM beta_product_records
     WHERE record_type = 'athlete_activity_change_request' AND subject_user_id = $1
       AND record_payload->>'queued_for_session_id' = $2
       AND record_payload->>'request_state' = 'queued'
       AND COALESCE(record_payload->>'change_kind', 'activity') = $3
     ORDER BY effective_at DESC, created_at DESC LIMIT 1`,
    [athleteUserId, sessionId, changeKind]
  );
  const queued = result.rows?.[0]?.record_payload;
  if (!record(queued)) return;

  const newValue = newValueOf(queued);
  const requestedBy = requestedByOf(queued.requested_by);
  const declarationSource = requestedBy === "coach"
    ? (changeKind === "position"
      ? "coach_proposed_position_change_applied_on_session_completion"
      : "coach_proposed_activity_change_applied_on_session_completion")
    : (changeKind === "position"
      ? "athlete_position_change_applied_on_session_completion"
      : "athlete_activity_change_applied_on_session_completion");

  await amendAthleteDeclaration(client, athleteUserId, changeFieldsFor(changeKind, newValue), declarationSource);

  const at = new Date().toISOString();
  const appliedRecord = buildRecord({
    requestId: id("activity_change_request"), athleteUserId, actorUserId: athleteUserId,
    requestedBy, changeKind, newValue, requestState: "applied", queuedForSessionId: sessionId,
    supersedesRequestId: text(queued.request_id), at
  });
  await persistBetaProductRecord(appliedRecord, client);
}

export async function applyQueuedActivityChangeIfDue(
  client: QueryClient,
  athleteUserId: string,
  sessionId: string
): Promise<void> {
  if (!athleteUserId || !sessionId) return;
  for (const changeKind of CHANGE_KINDS) {
    await applyQueuedChangeOfKindIfDue(client, athleteUserId, sessionId, changeKind);
  }
}

// --- Read-only state, for both the athlete's own account view and a ------
// --- coach's athlete-detail view -----------------------------------------

async function latestPendingRequestOfKind(athleteUserId: string, changeKind: ChangeKind): Promise<Json | null> {
  const latest = await latestRequestOfKind(pool, athleteUserId, changeKind);
  if (!latest) return null;
  const requestState = text(latest.request_state);
  if (requestState !== "proposed" && requestState !== "queued") return null;
  return latest;
}

export async function getAthleteActivityChangeState(athleteUserId: string): Promise<Readonly<Json> | null> {
  const latest = await latestPendingRequestOfKind(athleteUserId, "activity");
  if (!latest) return null;
  return Object.freeze({
    request_id: text(latest.request_id),
    requested_by: text(latest.requested_by),
    new_activity_id: newValueOf(latest),
    request_state: text(latest.request_state),
    queued_for_session_id: text(latest.queued_for_session_id) || null
  });
}

export async function getAthletePositionChangeState(athleteUserId: string): Promise<Readonly<Json> | null> {
  const latest = await latestPendingRequestOfKind(athleteUserId, "position");
  if (!latest) return null;
  return Object.freeze({
    request_id: text(latest.request_id),
    requested_by: text(latest.requested_by),
    new_position: newValueOf(latest),
    request_state: text(latest.request_state),
    queued_for_session_id: text(latest.queued_for_session_id) || null
  });
}
