export type Phase4Program = {
  program_id: string;
  version: string;
  blocks: unknown[];
};

export type Phase4Result =
  | { ok: true; program: Phase4Program; notes: string[] }
  | { ok: false; failure_token: string; details?: unknown };

/**
 * Phase 4 (v0 stub)
 * Produces a deterministic empty program shell.
 * No registry-driven assembly yet.
 */
export function phase4AssembleProgram(_canonicalInput: unknown): Phase4Result {
  return {
    ok: true,
    program: {
      program_id: "PROGRAM_STUB",
      version: "1.0.0",
      blocks: []
    },
    notes: ["PHASE_4_STUB: program assembly not yet implemented"]
  };
}
