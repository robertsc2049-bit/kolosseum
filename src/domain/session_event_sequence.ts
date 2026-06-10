/**
 * Deterministic session event sequence contract.
 *
 * This helper is intentionally pure:
 * - no clock
 * - no randomness
 * - no storage
 * - no sorting / no inference
 *
 * The caller supplies events in the order they were received/stored.
 * If order is illegal, we fail hard and return an explicit token.
 */

export const SESSION_EVENT_SEQUENCE_TOKENS = Object.freeze({
  SEQ_INVALID: "seq_invalid",
  SEQ_GAP: "seq_gap",
  SEQ_DUPLICATE: "seq_duplicate",
  SEQ_REWIND: "seq_rewind",
} as const);

function isPositiveSafeInteger(n: unknown): n is number {
  return Number.isSafeInteger(n) && (n as number) >= 1;
}

export type ValidateNextSessionEventSequenceResult =
  | { ok: true; expectedSeqNo: number }
  | { ok: false; token: string; expectedSeqNo: number; details: string };

export function validateNextSessionEventSequence(
  lastSeqNo: number | null | undefined,
  incomingSeqNo: number
): ValidateNextSessionEventSequenceResult {
  const normalizedLast = lastSeqNo === null || lastSeqNo === undefined ? 0 : lastSeqNo;

  if (!Number.isSafeInteger(normalizedLast) || normalizedLast < 0) {
    return {
      ok: false,
      token: SESSION_EVENT_SEQUENCE_TOKENS.SEQ_INVALID,
      expectedSeqNo: 1,
      details: "lastSeqNo must be a safe integer >= 0.",
    };
  }

  if (!isPositiveSafeInteger(incomingSeqNo)) {
    return {
      ok: false,
      token: SESSION_EVENT_SEQUENCE_TOKENS.SEQ_INVALID,
      expectedSeqNo: normalizedLast + 1,
      details: "incoming seq_no must be a safe integer >= 1.",
    };
  }

  const expectedSeqNo = normalizedLast + 1;

  if (incomingSeqNo === expectedSeqNo) {
    return { ok: true, expectedSeqNo };
  }

  if (incomingSeqNo === normalizedLast) {
    return {
      ok: false,
      token: SESSION_EVENT_SEQUENCE_TOKENS.SEQ_DUPLICATE,
      expectedSeqNo,
      details: `Duplicate seq_no ${incomingSeqNo}; expected ${expectedSeqNo}.`,
    };
  }

  if (incomingSeqNo < normalizedLast) {
    return {
      ok: false,
      token: SESSION_EVENT_SEQUENCE_TOKENS.SEQ_REWIND,
      expectedSeqNo,
      details: `Rewound seq_no ${incomingSeqNo}; last stored seq_no is ${normalizedLast}, expected ${expectedSeqNo}.`,
    };
  }

  return {
    ok: false,
    token: SESSION_EVENT_SEQUENCE_TOKENS.SEQ_GAP,
    expectedSeqNo,
    details: `Gap at seq_no ${incomingSeqNo}; expected ${expectedSeqNo}.`,
  };
}

export function assertNextSessionEventSequence(
  lastSeqNo: number | null | undefined,
  incomingSeqNo: number
): { expectedSeqNo: number } {
  const result = validateNextSessionEventSequence(lastSeqNo, incomingSeqNo);
  if (result.ok) {
    return result;
  }

  const error = new Error(result.details) as Error & {
    token?: string;
    expectedSeqNo?: number;
  };
  error.name = "SessionEventSequenceError";
  error.token = result.token;
  error.expectedSeqNo = result.expectedSeqNo;
  throw error;
}

export type SessionEvent = {
  seq_no: number;
  event_type: string;
  event_payload?: unknown;
};

/**
 * Deterministically reconstructs minimal factual state from a supplied event list.
 * No reordering is permitted. No direct state patching is permitted.
 */
export function reconstructSessionStateFromEvents(events: SessionEvent[]): {
  last_seq_no: number;
  event_count: number;
  event_type_counts: Record<string, number>;
  latest_event_type: string | null;
} {
  if (!Array.isArray(events)) {
    throw new TypeError("events must be an array.");
  }

  const initial: {
    last_seq_no: number;
    event_count: number;
    event_type_counts: Record<string, number>;
    latest_event_type: string | null;
  } = {
    last_seq_no: 0,
    event_count: 0,
    event_type_counts: Object.create(null) as Record<string, number>,
    latest_event_type: null,
  };

  return events.reduce((state, event, index) => {
    if (!event || typeof event !== "object") {
      throw new TypeError(`events[${index}] must be an object.`);
    }

    const seqNo = event.seq_no;
    const eventType = event.event_type;

    if (!isPositiveSafeInteger(seqNo)) {
      const error = new Error(`events[${index}].seq_no must be a safe integer >= 1.`) as Error & {
        token?: string;
      };
      error.name = "SessionEventSequenceError";
      error.token = SESSION_EVENT_SEQUENCE_TOKENS.SEQ_INVALID;
      throw error;
    }

    if (typeof eventType !== "string" || eventType.length === 0) {
      const error = new Error(`events[${index}].event_type must be a non-empty string.`) as Error & {
        token?: string;
      };
      error.name = "SessionEventSequenceError";
      error.token = SESSION_EVENT_SEQUENCE_TOKENS.SEQ_INVALID;
      throw error;
    }

    assertNextSessionEventSequence(state.last_seq_no, seqNo);

    const nextCounts: Record<string, number> = {
      ...state.event_type_counts,
      [eventType]: (state.event_type_counts[eventType] ?? 0) + 1,
    };

    return {
      last_seq_no: seqNo,
      event_count: state.event_count + 1,
      event_type_counts: nextCounts,
      latest_event_type: eventType,
    };
  }, initial);
}