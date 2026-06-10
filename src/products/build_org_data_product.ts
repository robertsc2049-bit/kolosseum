import type { OrgDataProduct } from "../contracts/org_data_product.js";

type SessionTraceInput = {
  completed_ids?: readonly string[];
  dropped_ids?: readonly string[];
  remaining_ids?: readonly string[];
  split_entered?: boolean;
  split_return_decision?: string;
};

type SessionInput = {
  execution_status?: string;
  trace?: SessionTraceInput;
};

export function buildOrgDataProduct(input: {
  org_id: string;
  sessions: readonly SessionInput[];
}): OrgDataProduct {
  let sessions_completed = 0;
  let sessions_split = 0;
  let sessions_abandoned = 0;

  const completed_ids: string[] = [];
  const dropped_ids: string[] = [];
  const remaining_ids: string[] = [];

  let entered = 0;
  let return_continue = 0;
  let return_skip = 0;

  for (const s of input.sessions) {
    if (s.execution_status === "completed") sessions_completed++;
    if (s.execution_status === "split") sessions_split++;
    if (s.execution_status === "abandoned") sessions_abandoned++;

    if (s.trace) {
      if (Array.isArray(s.trace.completed_ids)) {
        completed_ids.push(...s.trace.completed_ids);
      }
      if (Array.isArray(s.trace.dropped_ids)) {
        dropped_ids.push(...s.trace.dropped_ids);
      }
      if (Array.isArray(s.trace.remaining_ids)) {
        remaining_ids.push(...s.trace.remaining_ids);
      }

      if (s.trace.split_entered) entered++;
      if (s.trace.split_return_decision === "RETURN_CONTINUE") return_continue++;
      if (s.trace.split_return_decision === "RETURN_SKIP") return_skip++;
    }
  }

  return {
    org_id: input.org_id,
    generated_at: new Date().toISOString(),
    totals: {
      sessions_completed,
      sessions_split,
      sessions_abandoned
    },
    exercises: {
      completed_ids,
      dropped_ids,
      remaining_ids
    },
    splits: {
      entered,
      return_continue,
      return_skip
    }
  };
}