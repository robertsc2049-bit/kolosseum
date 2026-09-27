// Offline tolerance for logging a session with patchy signal (a gym
// basement, a field). Facts the athlete records about what they did - set
// logs, effort ratings, pain reports, extra sets - are kept on the phone when
// the network is unreachable and sent in order once it's back. Each keeps
// its client_request_id, so a replay the server already has is recorded once.
// Actions that move the session on (complete, skip, stop) are never queued:
// the next step depends on the server's answer.

import { ApiRequestError, type JsonRecord } from "./transport";

const STORAGE_KEY = "kolosseum.offlineSessionEvents.v1";
export const QUEUEABLE_EVENT_TYPES: ReadonlySet<string> = new Set([
  "SET_LOG_REPORT", "RPE_REPORT", "BORG_REPORT", "CR10_REPORT", "PAIN_REPORT", "EXTRA_SET_REPORT"
]);

export type QueuedSessionEvent = { session_id: string; event: JsonRecord; client_request_id: string; queued_at: string };

// A request that never reached the server (no response at all), as opposed
// to one the server answered with an error.
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ApiRequestError) return error.status === 0;
  // fetch() rejects with a TypeError when the request never gets a response;
  // matched by name, since it can come from another realm (e.g. a webview).
  return error instanceof TypeError || (typeof error === "object" && error !== null && (error as { name?: unknown }).name === "TypeError");
}

function read(): QueuedSessionEvent[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as QueuedSessionEvent[]) : [];
  }
  catch {
    return [];
  }
}

function write(queue: QueuedSessionEvent[]): void {
  try {
    if (queue.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    else window.localStorage.removeItem(STORAGE_KEY);
  }
  catch {
    // Storage unavailable (private mode): nothing more can be kept.
  }
}

export function enqueueSessionEvent(item: QueuedSessionEvent): void {
  write([...read(), item]);
}

export function pendingSessionEvents(sessionId?: string): QueuedSessionEvent[] {
  const queue = read();
  return sessionId ? queue.filter((item) => item.session_id === sessionId) : queue;
}

// Send queued events in order. Stops at the first network failure (still
// offline); an event the server refuses is dropped and counted. Returns what
// was sent, dropped and still waiting.
export async function flushSessionEvents(
  post: (item: QueuedSessionEvent) => Promise<unknown>
): Promise<{ sent: number; dropped: number; waiting: number }> {
  let queue = read();
  let sent = 0;
  let dropped = 0;
  while (queue.length) {
    const [next, ...rest] = queue;
    try {
      await post(next);
      sent += 1;
    }
    catch (error) {
      if (isNetworkError(error)) break;
      dropped += 1;
    }
    queue = rest;
    write(queue);
  }
  return { sent, dropped, waiting: queue.length };
}

// For tests.
export function __resetOfflineQueueForTests(): void {
  write([]);
}

// Set logs recorded offline for one exercise, overlaid on the server's list
// (a queued re-log of a set replaces the server's entry) and marked as saved
// on the phone.
export function withPendingSetLogs(sessionId: string, exerciseId: string, serverLogs: JsonRecord[]): JsonRecord[] {
  const bySet = new Map<number, JsonRecord>(serverLogs.map((log) => [Number(log.set_index), log]));
  for (const item of pendingSessionEvents(sessionId)) {
    const event = item.event;
    if (event.type !== "SET_LOG_REPORT" || event.exercise_id !== exerciseId) continue;
    bySet.set(Number(event.set_index), {
      set_index: event.set_index, reps: event.reps,
      load_value: event.load_value ?? null, load_unit: event.load_unit ?? null, pending: true
    });
  }
  return [...bySet.values()].sort((a, b) => Number(a.set_index) - Number(b.set_index));
}
