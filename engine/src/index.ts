import { phase1Validate } from "./phases/phase1.js";
import { phase2CanonicaliseAndHash } from "./phases/phase2.js";
import { phase3ResolveConstraintsAndLoadRegistries } from "./phases/phase3.js";
import { phase4AssembleProgram } from "./phases/phase4.js";
import { phase5ApplySubstitutionAndAdjustment } from "./phases/phase5.js";

function decodeCanonicalInput(p2: any): any {
  if (p2 && p2.canonical_input) return p2.canonical_input;
  if (p2 && typeof p2.phase2_canonical_json === "string") return JSON.parse(p2.phase2_canonical_json);
  if (p2 && p2.canonical_input_json) return JSON.parse(Buffer.from(p2.canonical_input_json).toString("utf8"));
  throw new Error("PHASE_2_DECODE_FAILED");
}

function pickPhase2Hash(p2: any): string {
  const candidates = [
    p2?.phase2_hash,
    p2?.hash,
    p2?.sha256,
    p2?.canonical_hash,
    p2?.phase2?.hash,
    p2?.phase2?.phase2_hash
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return "PHASE2_HASH_MISSING";
}

export function runEngine(input: unknown) {
  const p1: any = phase1Validate(input);
  if (!p1?.ok) return p1;

  const validated = (p1 as any).validated_input ?? input;

  const p2: any = phase2CanonicaliseAndHash(validated);
  const canonicalInput = decodeCanonicalInput(p2);

  const p3: any = phase3ResolveConstraintsAndLoadRegistries(canonicalInput);
  if (!p3?.ok) return p3;

  const p4: any = phase4AssembleProgram(canonicalInput, p3.phase3);
  if (!p4?.ok) return p4;

  const p5: any = phase5ApplySubstitutionAndAdjustment(
    {
      exercises: p4.program?.exercises ?? [],
      target_exercise_id: p4.program?.target_exercise_id,
      constraints: p4.program?.constraints ?? {}
    },
    canonicalInput
  );

  const p6 = {
    session_id: "SESSION_STUB",
    status: "ready",
    exercises: [],
    notes: ["PHASE_6_STUB: session output not yet implemented"]
  };

  return {
    ok: true,
    phase2_hash: pickPhase2Hash(p2),
    phase2_canonical_json: String(p2?.phase2_canonical_json ?? JSON.stringify(canonicalInput)),
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
    phase5: p5?.ok
      ? { adjustments: p5.adjustments, notes: p5.notes }
      : { adjustments: [], notes: ["PHASE_5_FAILED", String(p5?.failure_token ?? "unknown")] },
    phase6: p6
  };
}
