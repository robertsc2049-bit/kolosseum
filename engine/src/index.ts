import { phase1Validate } from "./phases/phase1.js";
import { phase2CanonicaliseAndHash } from "./phases/phase2.js";
import { phase3ResolveConstraints } from "./phases/phase3.js";
import { phase4AssembleProgram } from "./phases/phase4.js";
import { phase5ApplySubstitutionAndAdjustment } from "./phases/phase5.js";

export type EngineResult =
  | {
      ok: true;
      phase2_hash: string;
      phase2_canonical_json: string;
      phase3: {
        constraints_resolved: true;
        notes: string[];
        registry_index_version: string;
        loaded_registries: string[];
      };
      phase4: {
        program_id: string;
        version: string;
        blocks: unknown[];
        notes: string[];
      };
      phase5: {
        adjustments: { adjustment_id: string; reason: string; applied: boolean }[];
        notes: string[];
      };
    }
  | { ok: false; failure_token: string; details?: unknown };

export function runEngine(input: unknown): EngineResult {
  const p1 = phase1Validate(input);
  if (!p1.ok) return { ok: false, failure_token: p1.failure_token, details: p1.details };

  const p2 = phase2CanonicaliseAndHash(p1.canonical_input);

  const p3 = phase3ResolveConstraints(p1.canonical_input);
  if (!p3.ok) return { ok: false, failure_token: p3.failure_token, details: p3.details };

  const p4 = phase4AssembleProgram(p1.canonical_input);
  if (!p4.ok) return { ok: false, failure_token: p4.failure_token, details: p4.details };

  const p5 = phase5ApplySubstitutionAndAdjustment(p4.program, p1.canonical_input);
  if (!p5.ok) return { ok: false, failure_token: p5.failure_token, details: p5.details };

  return {
    ok: true,
    phase2_hash: p2.canonical_input_hash,
    phase2_canonical_json: new TextDecoder().decode(p2.canonical_input_json),
    phase3: {
      constraints_resolved: true,
      notes: p3.notes,
      registry_index_version: p3.registry_index_version,
      loaded_registries: p3.loaded_registries
    },
    phase4: {
      program_id: p4.program.program_id,
      version: p4.program.version,
      blocks: p4.program.blocks,
      notes: p4.notes
    },
    phase5: {
      adjustments: p5.adjustments,
      notes: p5.notes
    }
  };
}
