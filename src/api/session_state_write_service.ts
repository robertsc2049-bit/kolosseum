/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/session_state_write_service.ts
import { pool } from "../db/pool.js";
import { assertNextSessionEventSequence } from "../domain/session_event_sequence.js";
import {
  badRequest,
  notFound,
  internalError,
  conflict
} from "./http_errors.js";
import {
  type PlannedSession,
  ensureReturnDecisionContract,
  invalidateSessionStateCache,
  uniqStable
} from "./session_state_read_model.js";
import {
  applyWireEvent,
  deriveTrace,
  normalizeSummary,
  validateWireRuntimeEvent
} from "@kolosseum/engine/runtime/session_summary.js";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function ensureRuntimeCarrier(summary: any): any {
  if (!summary || typeof summary !== "object") return { runtime: {} };
  if (!summary.runtime || typeof summary.runtime !== "object" || Array.isArray(summary.runtime)) {
    summary.runtime = {};
  }
  return summary.runtime;
}

function readSummaryTrace(summary: any): any {
  try {
    return deriveTrace(summary as any) as any;
  } catch {
    return {};
  }
}

function runtimeIds(summary: any, key: string): string[] {
  const runtime = ensureRuntimeCarrier(summary);
  const direct = uniqStable(runtime?.[key]);
  if (direct.length > 0) return direct;
  const trace = readSummaryTrace(summary);
  return uniqStable(trace?.[key]);
}

function writeRuntimeIds(summary: any, key: string, ids: string[]): void {
  const runtime = ensureRuntimeCarrier(summary);
  runtime[key] = uniqStable(ids);
}

function writeRuntimeSetAlias(summary: any, key: string, ids: string[]): void {
  const runtime = ensureRuntimeCarrier(summary);
  runtime[key] = uniqStable(ids);
}

function unionStable(a: string[], b: string[]): string[] {
  return uniqStable([...(a ?? []), ...(b ?? [])]);
}

function stampSplitLifecycle(summary: any, decision: "continue" | "skip" | null): any {
  const runtime = ensureRuntimeCarrier(summary);
  runtime.split_entered = true;
  if (decision) {
    runtime.split_return_decision = decision;
    runtime.return_decision = decision;
  }
  return summary;
}

function readPersistedSplitDecision(summary: any): "continue" | "skip" | null {
  const runtime = ensureRuntimeCarrier(summary);
  const raw =
    runtime.split_return_decision ??
    runtime.return_decision ??
    null;

  if (raw === null || typeof raw === "undefined") return null;
  const s = String(raw).trim().toLowerCase();
  if (s.includes("continue")) { return "continue"; }
  if (s.includes("skip")) { return "skip"; }
  return null;
}

function preserveSplitLifecycle(beforeSummary: any, afterSummary: any): any {
  const next = cloneJson(afterSummary);
  const beforeRt = ensureRuntimeCarrier(beforeSummary);
  const nextRt = ensureRuntimeCarrier(next);

  if (beforeRt.split_entered === true) {
    nextRt.split_entered = true;
  }

  const priorDecision = readPersistedSplitDecision(beforeSummary);
  if (priorDecision) {
    nextRt.split_return_decision = priorDecision;
    nextRt.return_decision = priorDecision;
  }

  return next;
}

function normalizeIncomingExerciseId(exerciseId: string, planned: PlannedSession, summary: any): string {
  const raw = String(exerciseId ?? "").trim();
  if (!raw) return raw;

  const trace = readSummaryTrace(summary);
  const knownIds = new Set<string>([
    ...uniqStable(trace?.remaining_ids),
    ...uniqStable(trace?.completed_ids),
    ...uniqStable(trace?.dropped_ids)
  ]);

  const plannedExercises = Array.isArray(planned?.exercises) ? planned.exercises : [];
  for (const ex of plannedExercises) {
    const plannedId = typeof ex?.exercise_id === "string" ? ex.exercise_id : "";
    if (plannedId) knownIds.add(plannedId);
  }

  if (knownIds.has(raw)) return raw;

  if (raw.startsWith("ex_barbell_")) {
    const candidate = raw.substring("ex_barbell_".length);
    if (knownIds.has(candidate)) return candidate;
  }

  if (raw.startsWith("ex_")) {
    const candidate = raw.substring(3);
    if (knownIds.has(candidate)) return candidate;
  }

  return raw;
}

function repairReturnDecisionSummary(beforeSummary: any, afterSummary: any, eventType: string): any {
  const next = cloneJson(afterSummary);
  const runtime = ensureRuntimeCarrier(next);

  const beforeRemaining = runtimeIds(beforeSummary, "remaining_ids");
  const beforeCompleted = runtimeIds(beforeSummary, "completed_ids");
  const beforeDropped = unionStable(
    runtimeIds(beforeSummary, "dropped_ids"),
    runtimeIds(beforeSummary, "skipped_ids")
  );

  if (eventType === "RETURN_CONTINUE") {
    stampSplitLifecycle(next, "continue");
    runtime.split_active = false;
    runtime.remaining_at_split_ids = [];
    runtime.return_decision_required = false;
    runtime.return_decision_options = [];
    writeRuntimeIds(next, "remaining_ids", beforeRemaining);
    writeRuntimeIds(next, "completed_ids", beforeCompleted);
    writeRuntimeIds(next, "dropped_ids", beforeDropped);
    writeRuntimeSetAlias(next, "skipped_ids", beforeDropped);
    return next;
  }

  if (eventType === "RETURN_SKIP") {
    const frozenRemainingAtSplit = runtimeIds(beforeSummary, "remaining_at_split_ids");
    const idsToDrop = frozenRemainingAtSplit.length > 0 ? frozenRemainingAtSplit : beforeRemaining;
    const resumedRemaining = beforeRemaining.filter((id) => !idsToDrop.includes(id));
    const repairedDropped = unionStable(beforeDropped, idsToDrop);

    stampSplitLifecycle(next, "skip");
    runtime.split_active = false;
    runtime.remaining_at_split_ids = [];
    runtime.return_decision_required = false;
    runtime.return_decision_options = [];
    writeRuntimeIds(next, "remaining_ids", resumedRemaining);
    writeRuntimeIds(next, "completed_ids", beforeCompleted);
    writeRuntimeIds(next, "dropped_ids", repairedDropped);
    writeRuntimeSetAlias(next, "skipped_ids", repairedDropped);
    return next;
  }

  return next;
}

function __kolosseumWireSentinel(evt: any) {
  if (process.env.KOLOSSEUM_TEST_FORCE_WIRE_APPLY_THROW !== "1") return;
  const t = typeof evt?.type === "string" ? String(evt.type).toUpperCase() : "";
  if (!t.includes("START")) {
    throw new Error("KOLOSSEUM_TEST_FORCE_WIRE_APPLY_THROW: unhandled wire apply failure sentinel");
  }
}

function mapEngineWireApplyError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);

  if (msg.startsWith("PHASE6_RUNTIME_AWAIT_RETURN_DECISION")) {
    throw badRequest("Runtime event rejected (await return decision)", {
      failure_token: "phase6_runtime_await_return_decision",
      cause: msg
    });
  }
  if (msg.startsWith("PHASE6_RUNTIME_UNKNOWN_EVENT")) {
    throw badRequest("Runtime event rejected (unknown event type)", {
      failure_token: "phase6_runtime_unknown_event",
      cause: msg
    });
  }
  if (msg.startsWith("PHASE6_RUNTIME_INVALID_EVENT")) {
    throw badRequest("Runtime event rejected (invalid event shape)", {
      failure_token: "phase6_runtime_invalid_event",
      cause: msg
    });
  }

  throw internalError("Runtime event rejected (unexpected engine error)", { cause: msg });
}

async function allocNextSeq(client: any, session_id: string): Promise<number> {
  await client.query(
    `INSERT INTO session_event_seq(session_id, next_seq)
     VALUES ($1, 0)
     ON CONFLICT (session_id) DO NOTHING`,
    [session_id]
  );

  const r = await client.query(
    `UPDATE session_event_seq
     SET next_seq = next_seq + 1
     WHERE session_id = $1
     RETURNING next_seq`,
    [session_id]
  );

  const rowCount = Number(r?.rowCount ?? 0);
  if (rowCount !== 1) throw internalError("allocNextSeq invariant violated (expected 1 row)", { rowCount });

  const nextSeq = Number(r.rows?.[0]?.next_seq);
  if (!Number.isFinite(nextSeq) || nextSeq < 1) {
    throw internalError("allocNextSeq invariant violated (invalid next_seq)", { next_seq: r.rows?.[0]?.next_seq });
  }

  assertNextSessionEventSequence(nextSeq - 1, nextSeq);

  return nextSeq;
}

async function loadSessionForUpdate(client: any, session_id: string) {
  const r = await client.query(
    `SELECT session_id, status, planned_session, session_state_summary
     FROM sessions
     WHERE session_id = $1
     FOR UPDATE`,
    [session_id]
  );
  return (r.rowCount ?? 0) > 0 ? r.rows[0] : null;
}

function rawEventType(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const t = (raw as any).type;
  if (typeof t !== "string" || t.length === 0) return null;
  return t;
}

function isApiCompleteStep(raw: unknown): boolean {
  const t = rawEventType(raw);
  return t === "COMPLETE_STEP";
}

function isReturnDecisionEventType(t: string | null): t is "RETURN_CONTINUE" | "RETURN_SKIP" {
  return t === "RETURN_CONTINUE" || t === "RETURN_SKIP";
}

function isExerciseProgressEventType(t: string | null): t is "COMPLETE_EXERCISE" | "SKIP_EXERCISE" {
  return t === "COMPLETE_EXERCISE" || t === "SKIP_EXERCISE";
}

function isReturnDecisionGateOpen(summary: any): boolean {
  const explicit = summary?.runtime?.return_decision_required;
  if (typeof explicit === "boolean") return explicit;

  try {
    return deriveTrace(summary as any)?.return_decision_required === true;
  } catch {
    return false;
  }
}

function ensureResolvedReturnDecisionReplayRejected(summary: any, raw: unknown): void {
  const t = rawEventType(raw);
  if (!isReturnDecisionEventType(t)) return;
  if (isReturnDecisionGateOpen(summary)) return;

  throw conflict("Runtime event rejected (resolved return decision replay)", {
    failure_token: "phase6_runtime_resolved_return_decision_replay",
    cause: `PHASE6_RUNTIME_RESOLVED_RETURN_DECISION_REPLAY: ${t}`
  });
}

function ensureExerciseReplayRejected(summary: any, raw: unknown): void {
  const t = rawEventType(raw);
  if (!isExerciseProgressEventType(t)) return;

  const exerciseId = typeof (raw as any)?.exercise_id === "string" ? String((raw as any).exercise_id) : "";
  if (!exerciseId) {
    throw badRequest("Missing/invalid event");
  }

  const trace = readSummaryTrace(summary);
  const remainingIds = uniqStable(trace?.remaining_ids);
  const completedIds = uniqStable(trace?.completed_ids);
  const droppedIds = uniqStable(trace?.dropped_ids);

  if (completedIds.includes(exerciseId) || droppedIds.includes(exerciseId)) {
    throw conflict("Runtime event rejected (exercise replay after resolution)", {
      failure_token: "phase6_runtime_resolved_exercise_replay",
      cause: `PHASE6_RUNTIME_RESOLVED_EXERCISE_REPLAY: ${t}:${exerciseId}`
    });
  }

  if (remainingIds.length === 0) {
    throw conflict("Runtime event rejected (terminal exercise replay)", {
      failure_token: "phase6_runtime_terminal_exercise_replay",
      cause: `PHASE6_RUNTIME_TERMINAL_EXERCISE_REPLAY: ${t}:${exerciseId}`
    });
  }
}

export function extractRawEventFromBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;

  const directType = (body as any).type;
  if (typeof directType === "string" && directType.length > 0) {
    return body;
  }

  const nested = (body as any).event;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const nestedType = (nested as any).type;
    if (typeof nestedType === "string" && nestedType.length > 0) {
      return nested;
    }
  }

  return null;
}

export async function startSessionMutation(session_id: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const s = await loadSessionForUpdate(client, session_id);
    if (!s) throw notFound("Session not found");

    const planned = s.planned_session as PlannedSession;
    const { summary: normalized, needsUpgrade } = normalizeSummary(planned as any, s.session_state_summary);

    const upgraded0 = ensureReturnDecisionContract(normalized, deriveTrace);
    const shouldPersist0 = needsUpgrade || upgraded0.changed;

    if (upgraded0.summary.started === true) {
      await client.query(
        `UPDATE sessions
         SET status = 'in_progress',
             session_state_summary = $2::jsonb,
             updated_at = now()
         WHERE session_id = $1`,
        [session_id, JSON.stringify(shouldPersist0 ? upgraded0.summary : (s.session_state_summary ?? upgraded0.summary))]
      );

      await client.query("COMMIT");
      invalidateSessionStateCache(session_id);
      return { ok: true, session_id, started: true };
    }

    const seq = await allocNextSeq(client, session_id);
    const ev = { type: "START_SESSION" };

    await client.query(
      `INSERT INTO runtime_events(session_id, seq, event)
       VALUES ($1, $2, $3::jsonb)`,
      [session_id, seq, JSON.stringify(ev)]
    );

    let nextSummary: any;
    try {
      __kolosseumWireSentinel(ev as any);
      nextSummary = applyWireEvent(upgraded0.summary as any, ev as any, planned as any) as any;
    } catch (e: unknown) {
      mapEngineWireApplyError(e);
    }

    nextSummary.last_seq = seq;
    nextSummary = preserveSplitLifecycle(upgraded0.summary, nextSummary);
    const upgraded1 = ensureReturnDecisionContract(nextSummary, deriveTrace);

    await client.query(
      `UPDATE sessions
       SET status = 'in_progress',
           session_state_summary = $2::jsonb,
           updated_at = now()
       WHERE session_id = $1`,
      [session_id, JSON.stringify(upgraded1.summary)]
    );

    await client.query("COMMIT");
    invalidateSessionStateCache(session_id);

    return { ok: true, session_id, started: true, seq };
  } catch (err: unknown) {
    try { await client.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}

export async function appendRuntimeEventMutation(session_id: string, raw: unknown) {
  if (!raw) throw badRequest("Missing/invalid event");

  if (rawEventType(raw) === "START_SESSION") {
    throw badRequest("START_SESSION must be created via /start");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const s = await loadSessionForUpdate(client, session_id);
    if (!s) throw notFound("Session not found");

    if (
      process.env.KOLOSSEUM_HTTP_E2E_UNKNOWN_ENGINE_500 === "1" &&
      rawEventType(raw) === "E2E_FORCE_UNKNOWN_ENGINE_ERROR"
    ) {
      mapEngineWireApplyError(new Error("E2E_FORCED_UNKNOWN_ENGINE_EXCEPTION"));
    }

    const planned = s.planned_session as PlannedSession;
    const { summary: normalized, needsUpgrade } = normalizeSummary(planned as any, s.session_state_summary);

    const upgraded0 = ensureReturnDecisionContract(normalized, deriveTrace);
    const shouldPersist0 = needsUpgrade || upgraded0.changed;

    let workingSummary: any = upgraded0.summary;

    if (workingSummary.started !== true) {
      const startSeq = await allocNextSeq(client, session_id);
      const startEv = { type: "START_SESSION" };

      await client.query(
        `INSERT INTO runtime_events(session_id, seq, event)
         VALUES ($1, $2, $3::jsonb)`,
        [session_id, startSeq, JSON.stringify(startEv)]
      );

      try {
        __kolosseumWireSentinel(startEv as any);
        workingSummary = applyWireEvent(workingSummary, startEv as any, planned as any);
      } catch (e: unknown) {
        mapEngineWireApplyError(e);
      }

      workingSummary.last_seq = startSeq;
      workingSummary = preserveSplitLifecycle(upgraded0.summary, workingSummary);
      workingSummary = ensureReturnDecisionContract(workingSummary, deriveTrace).summary;

      await client.query(
        `UPDATE sessions
         SET status = 'in_progress',
             session_state_summary = $2::jsonb,
             updated_at = now()
         WHERE session_id = $1`,
        [session_id, JSON.stringify(workingSummary)]
      );
    } else if (shouldPersist0) {
      await client.query(
        `UPDATE sessions
         SET session_state_summary = $2::jsonb,
             updated_at = now()
         WHERE session_id = $1`,
        [session_id, JSON.stringify(workingSummary)]
      );
    }

    let event: any;

    if (isApiCompleteStep(raw)) {
      const trace0: any = deriveTrace(workingSummary as any) as any;
      const remaining = uniqStable(trace0?.remaining_ids);
      const nextId = remaining.length > 0 ? remaining[0] : null;
      if (!nextId) {
        throw badRequest("COMPLETE_STEP rejected (no remaining exercise)", {
          failure_token: "no_remaining_exercise"
        });
      }
      event = { type: "COMPLETE_EXERCISE", exercise_id: nextId };
    } else {
      const validated = validateWireRuntimeEvent(raw);
      if (!validated) throw badRequest("Missing/invalid event");
      event = validated;
    }

    if (typeof event?.exercise_id === "string" && event.exercise_id.length > 0) {
      event = {
        ...event,
        exercise_id: normalizeIncomingExerciseId(event.exercise_id, planned, workingSummary)
      };
    }

    ensureResolvedReturnDecisionReplayRejected(workingSummary, event);
    ensureExerciseReplayRejected(workingSummary, event);

    const seq = await allocNextSeq(client, session_id);

    await client.query(
      `INSERT INTO runtime_events(session_id, seq, event)
       VALUES ($1, $2, $3::jsonb)`,
      [session_id, seq, JSON.stringify(event)]
    );

    let nextSummary: any;
    try {
      __kolosseumWireSentinel(event as any);
      nextSummary = applyWireEvent(workingSummary, event as any, planned as any) as any;
    } catch (e: unknown) {
      mapEngineWireApplyError(e);
    }

    nextSummary = preserveSplitLifecycle(workingSummary, nextSummary);

    const eventType = rawEventType(event);
    if (eventType === "SPLIT_SESSION") {
      nextSummary = stampSplitLifecycle(nextSummary, null);
    } else if (eventType === "RETURN_CONTINUE" || eventType === "RETURN_SKIP") {
      nextSummary = repairReturnDecisionSummary(workingSummary, nextSummary, eventType);
    }

    nextSummary = preserveSplitLifecycle(workingSummary, nextSummary);
    nextSummary.last_seq = seq;
    nextSummary = ensureReturnDecisionContract(nextSummary, deriveTrace).summary;

    await client.query(
      `UPDATE sessions
       SET session_state_summary = $2::jsonb,
           updated_at = now()
       WHERE session_id = $1`,
      [session_id, JSON.stringify(nextSummary)]
    );

    await client.query("COMMIT");
    invalidateSessionStateCache(session_id);

    return { ok: true, session_id, seq };
  } catch (err: unknown) {
    try { await client.query("ROLLBACK"); } catch {}
    throw err;
  } finally {
    client.release();
  }
}