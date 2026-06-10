export type CapturedEventLike = {
  seq_no: number;
  event_type: string;
  [k: string]: unknown;
};

export type CaptureAuditIssueV1 = {
  kind: "missing_event" | "mutated_event" | "reordered_event";
  seq_no: number;
  captured_event: unknown;
  expected_event: unknown;
};

export type CaptureAuditLogV1 = {
  version: "v1";
  captured_count: number;
  expected_count: number;
  issues: CaptureAuditIssueV1[];
};

export type CaptureReconciliationV1 = {
  version: "v1";
  integrity_ok: boolean;
  captured_count: number;
  expected_count: number;
  missing_seq_nos: number[];
  mutated_seq_nos: number[];
  reordered_seq_nos: number[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isCapturedEventLike(value: unknown): value is CapturedEventLike {
  return isPlainObject(value) &&
    typeof value.seq_no === "number" &&
    Number.isSafeInteger(value.seq_no) &&
    value.seq_no >= 0 &&
    typeof value.event_type === "string";
}

function stableEventJson(event: unknown): string {
  if (!isPlainObject(event) && !Array.isArray(event)) {
    return JSON.stringify(event);
  }

  if (Array.isArray(event)) {
    return `[${event.map((x) => stableEventJson(x)).join(",")}]`;
  }

  const keys = Object.keys(event).sort((a, b) => a.localeCompare(b));
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableEventJson(event[k])}`).join(",")}}`;
}

function toSeqMap(events: unknown[]): Map<number, CapturedEventLike> {
  const map = new Map<number, CapturedEventLike>();
  for (const event of events) {
    if (!isCapturedEventLike(event)) continue;
    if (!map.has(event.seq_no)) {
      map.set(event.seq_no, event);
    }
  }
  return map;
}

function collectReorderedSeqNos(events: unknown[]): number[] {
  const valid = events.filter(isCapturedEventLike);
  const out: number[] = [];
  let lastSeq = -1;

  for (const event of valid) {
    if (event.seq_no < lastSeq) {
      out.push(event.seq_no);
    }
    lastSeq = event.seq_no;
  }

  return [...new Set(out)].sort((a, b) => a - b);
}

export function buildCaptureAuditLogV1(source: {
  captured_events?: unknown;
  expected_events?: unknown;
}): CaptureAuditLogV1 {
  const captured = Array.isArray(source?.captured_events) ? source.captured_events : [];
  const expected = Array.isArray(source?.expected_events) ? source.expected_events : [];

  const capturedMap = toSeqMap(captured);
  const expectedMap = toSeqMap(expected);

  const seqs = [...new Set([...capturedMap.keys(), ...expectedMap.keys()])].sort((a, b) => a - b);
  const issues: CaptureAuditIssueV1[] = [];

  for (const seq of seqs) {
    const capturedEvent = capturedMap.get(seq) ?? null;
    const expectedEvent = expectedMap.get(seq) ?? null;

    if (!capturedEvent || !expectedEvent) {
      issues.push({
        kind: "missing_event",
        seq_no: seq,
        captured_event: capturedEvent,
        expected_event: expectedEvent
      });
      continue;
    }

    if (stableEventJson(capturedEvent) !== stableEventJson(expectedEvent)) {
      issues.push({
        kind: "mutated_event",
        seq_no: seq,
        captured_event: capturedEvent,
        expected_event: expectedEvent
      });
    }
  }

  for (const seq of collectReorderedSeqNos(captured)) {
    issues.push({
      kind: "reordered_event",
      seq_no: seq,
      captured_event: capturedMap.get(seq) ?? null,
      expected_event: expectedMap.get(seq) ?? null
    });
  }

  return {
    version: "v1",
    captured_count: capturedMap.size,
    expected_count: expectedMap.size,
    issues: issues.sort((a, b) => {
      if (a.seq_no !== b.seq_no) return a.seq_no - b.seq_no;
      return a.kind.localeCompare(b.kind);
    })
  };
}

export function buildCaptureReconciliationV1(source: {
  captured_events?: unknown;
  expected_events?: unknown;
}): CaptureReconciliationV1 {
  const audit = buildCaptureAuditLogV1(source);

  const missingSeqNos = audit.issues
    .filter((x) => x.kind === "missing_event")
    .map((x) => x.seq_no);

  const mutatedSeqNos = audit.issues
    .filter((x) => x.kind === "mutated_event")
    .map((x) => x.seq_no);

  const reorderedSeqNos = audit.issues
    .filter((x) => x.kind === "reordered_event")
    .map((x) => x.seq_no);

  return {
    version: "v1",
    integrity_ok: audit.issues.length === 0,
    captured_count: audit.captured_count,
    expected_count: audit.expected_count,
    missing_seq_nos: [...new Set(missingSeqNos)].sort((a, b) => a - b),
    mutated_seq_nos: [...new Set(mutatedSeqNos)].sort((a, b) => a - b),
    reordered_seq_nos: [...new Set(reorderedSeqNos)].sort((a, b) => a - b)
  };
}
