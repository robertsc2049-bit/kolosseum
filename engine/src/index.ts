import { phase1Validate } from "./phases/phase1.js";
import { phase2CanonicaliseAndHash } from "./phases/phase2.js";
import { phase3ResolveConstraintsAndLoadRegistries } from "./phases/phase3.js";
import { phase4AssembleProgram } from "./phases/phase4.js";
import { phase5ApplySubstitutionAndAdjustment } from "./phases/phase5.js";
import { phase6ProduceSessionOutput } from "./phases/phase6.js";

function normalisePhase5ForPhase6(p5: any): any {
  // Phase 6 expects p5.ok===true and p5.adjustments[] if available.
  // If Phase 5 fails, normalise to a failure-like object so Phase 6 can no-op deterministically.
  if (p5 && p5.ok === true) return p5;

  return {
    ok: false,
    failure_token: String(p5?.failure_token ?? "unknown"),
    details: p5?.details
  };
}

export function runEngine(input: unknown) {
  // -----------------------------
  // Phase 1
  // -----------------------------
  const p1: any = phase1Validate(input);
  if (!p1?.ok) return p1;

  const validated = (p1 as any).validated_input ?? input;

  // -----------------------------
  // Phase 2 (new contract)
  // -----------------------------
  const p2: any = phase2CanonicaliseAndHash(validated);
  if (!p2?.ok) return p2;

  const canonicalJson: string = String(p2?.phase2?.phase2_canonical_json ?? "{}");
  const canonicalInput = JSON.parse(canonicalJson);

  const phase2Hash: string =
    typeof p2?.phase2?.phase2_hash === "string" && p2.phase2.phase2_hash.length > 0
      ? p2.phase2.phase2_hash
      : typeof p2?.phase2?.canonical_input_hash === "string" && p2.phase2.canonical_input_hash.length > 0
        ? p2.phase2.canonical_input_hash
        : "PHASE2_HASH_MISSING";

  // -----------------------------
  // Phase 3
  // -----------------------------
  const p3: any = phase3ResolveConstraintsAndLoadRegistries(canonicalInput);
  if (!p3?.ok) return p3;

  // -----------------------------
  // Phase 4
  // -----------------------------
  const p4: any = phase4AssembleProgram(canonicalInput, p3.phase3);
  if (!p4?.ok) return p4;

  // -----------------------------
  // Phase 5
  // -----------------------------
  // Phase 5 operates on a minimal substitutable shape (guarded).
  const phase5Input = {
    exercises: p4.program?.exercises ?? [],
    target_exercise_id: p4.program?.target_exercise_id,
    constraints: p4.program?.constraints ?? {}
  };

  const p5Raw: any = phase5ApplySubstitutionAndAdjustment(phase5Input, canonicalInput);
  const p5ForPhase6 = normalisePhase5ForPhase6(p5Raw);

  // -----------------------------
  // Phase 6
  // -----------------------------
  // Phase 6 consumes full Phase 4 program, and applies Phase 5 adjustments if present.
  const p6Raw: any = phase6ProduceSessionOutput(p4.program, canonicalInput, p5ForPhase6);

  // -----------------------------
  // Outward response (stable shape)
  // -----------------------------
  const phase5Out =
    p5Raw?.ok === true
      ? { adjustments: p5Raw.adjustments, notes: p5Raw.notes }
      : { adjustments: [], notes: ["PHASE_5_FAILED", String(p5Raw?.failure_token ?? "unknown")] };

  const phase6Out =
    p6Raw?.ok === true
      ? {
          session_id: p6Raw.session?.session_id ?? "SESSION_V1",
          status: p6Raw.session?.status ?? "ready",
          exercises: Array.isArray(p6Raw.session?.exercises) ? p6Raw.session.exercises : [],
          notes: Array.isArray(p6Raw.notes) ? p6Raw.notes : []
        }
      : {
          session_id: "SESSION_STUB",
          status: "ready",
          exercises: [],
          notes: ["PHASE_6_FAILED", String(p6Raw?.failure_token ?? "unknown")]
        };

  return {
    ok: true,
    phase2_hash: phase2Hash,
    phase2_canonical_json: canonicalJson,
    phase3: {
      constraints_resolved: p3.phase3.constraints_resolved,
      notes: p3.phase3.notes,
      registry_index_version: p3.phase3.registry_index_version,
      loaded_registries: p3.phase3.loaded_registries,
      constraints: p3.phase3.constraints
    },
    phase4: {
      program_id: p4.program.program_id,
      version: p4.program.version,
      blocks: p4.program.blocks,
      notes: p4.notes
    },
    phase5: phase5Out,
    phase6: phase6Out
  };
}
