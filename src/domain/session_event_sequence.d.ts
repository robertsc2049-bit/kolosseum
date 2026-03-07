export const SESSION_EVENT_SEQUENCE_TOKENS: Readonly<{
  SEQ_INVALID: "seq_invalid";
  SEQ_GAP: "seq_gap";
  SEQ_DUPLICATE: "seq_duplicate";
  SEQ_REWIND: "seq_rewind";
}>;

export function validateNextSessionEventSequence(
  lastSeqNo: number | null | undefined,
  incomingSeqNo: number
):
  | { ok: true; expectedSeqNo: number }
  | { ok: false; token: string; expectedSeqNo: number; details: string };

export function assertNextSessionEventSequence(
  lastSeqNo: number | null | undefined,
  incomingSeqNo: number
): { expectedSeqNo: number };

export type SessionEvent = {
  seq_no: number;
  event_type: string;
  event_payload?: unknown;
};

export function reconstructSessionStateFromEvents(events: SessionEvent[]): {
  last_seq_no: number;
  event_count: number;
  event_type_counts: Record<string, number>;
  latest_event_type: string | null;
};