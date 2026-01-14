import { phase1Validate } from "./phases/phase1.js";
import { phase2CanonicaliseAndHash } from "./phases/phase2.js";
import { phase3ResolveConstraintsAndLoadRegistries } from "./phases/phase3.js";
import { phase4AssembleProgram } from "./phases/phase4.js";
import { phase5ApplySubstitutionAndAdjustment } from "./phases/phase5.js";
import { phase6ProduceSessionOutput } from "./phases/phase6.js";

type Phase2Extract = {
  hash: string;
  canonicalJson: string;
  canonicalInput: unknown;
};

function isUint8Array(x: unknown): x is Uint8Array {
  return x instanceof Uint8Array;
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    throw new Error("PHASE_2_DECODE_FAILED");
  }
}

function pickString(candidates: unknown[], fallback: string): string {
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return fallback;
}

/**
 * Phase 2 extraction (supports:
 * - Option A envelope: { ok:true, phase2:{ canonical_input_json, canonical_input_hash, phase2_canonical_json? } }
 * - Direct legacy: { canonical_input_json, canonical_input_hash } / { phase2_hash, phase2_canonical_json }
 * - Last-ditch: { canonical_input }
 */
function extractPhase2(p2: unknown): Phase2Extract {
  const obj = (p2 ?? {}) as any;
  const inner = obj?.phase2 ?? obj;

  const hash = pickString(
    [
      inner?.canonical_input_hash, // Option A (preferred)
      inner?.phase2_hash,
      inner?.hash,
      inner?.sha256,
      obj?.canonical_input_hash,
      obj?.phase2_hash
    ],
    "PHASE2_HASH_MISSING"
  );

  // Preferred: explicit canonical json string
  const jsonString = pickString([inner?.phase2_canonical_json, obj?.phase2_canonical_json], "");
  if (jsonString) {
    const canonicalInput = safeJsonParse(jsonString);
    return { hash, canonicalJson: jsonString, canonicalInput };
  }

  // Next: canonical bytes
  const bytesCandidates = [inner?.canonical_input_json, obj?.canonical_input_json];
  for (const b of bytesCandidates) {
    if (isUint8Array(b)) {
      const s = Buffer.from(b).toString("utf8");
      const canonicalInput = safeJsonParse(s);
      return { hash, canonicalJson: s, canonicalInput };
    }
  }

  // Last-ditch: structured canonical input
  if (inner?.canonical_input) {
    const s = JSON.stringify(inner.canonical_input);
    return { hash, canonicalJson: s, canonicalInput: inner.canonical_input };
  }

  throw new Error("PHASE_2_DECODE_FAILED");
}

export function runEngine(input: unknown) {
  // Phase 1 (schema-validated + canonicalised)
  const p1: any = phase1Validate(input);
  if (!p1?.ok) return p1;

  // IMPORTANT: phase1 returns { ok:true, canonical_input }
  const phase1CanonicalInput = (p1 as any).canonical_input ?? input;

  // Phase 2 (canonical JSON + hash)
  const p2: any = phase2CanonicaliseAndHash(phase1CanonicalInput);
  if (p2?.ok === false) return p2;

  let p2x: Phase2Extract;
  try {
    p2x = extractPhase2(p2);
  } catch (e: any) {
    return {
      ok: false,
      failure_token: "phase2_invalid_output",
      details: String(e?.message ?? e ?? "PHASE_2_DECODE_FAILED")
    };
  }

  const canonicalInput = p2x.canonicalInput;

  // Phase 3
  const p3: any = phase3ResolveConstraintsAndLoadRegistries(canonicalInput);
  if (!p3?.ok) return p3;

  // Phase 4
  const p4: any = phase4AssembleProgram(canonicalInput, p3.phase3);
  if (!p4?.ok) return p4;

  // Phase 5
  // CRITICAL: pass the real Phase 4 program so Phase 5 sees program.exercises[]
  // and can apply substitution based on Phase 1 constraints (carried through canonicalInput).
  const p5Raw: any = phase5ApplySubstitutionAndAdjustment(p4.program, canonicalInput);

  // Phase 6 (repo signature: (program, canonicalInput, phase5Raw))
  const p6Raw: any = phase6ProduceSessionOutput(p4.program, canonicalInput, p5Raw);

  // Outbound shaping (keep CLI/tests stable)
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
    phase2_hash: p2x.hash,
    phase2_canonical_json: p2x.canonicalJson,
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


