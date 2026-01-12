export type Phase6SessionOutput = {
  session_id: string;
  status: "ready";
  exercises: unknown[];
};

export type Phase6Result =
  | { ok: true; session: Phase6SessionOutput; notes: string[] }
  | { ok: false; failure_token: string; details?: unknown };

/**
 * Phase 6 (v0 stub)
 * Produces deterministic empty session output.
 */
export function phase6ProduceSessionOutput(_program: unknown, _canonicalInput: unknown): Phase6Result {
  return {
    ok: true,
    session: {
      session_id: "SESSION_STUB",
      status: "ready",
      exercises: []
    },
    notes: ["PHASE_6_STUB: session output not yet implemented"]
  };
}
