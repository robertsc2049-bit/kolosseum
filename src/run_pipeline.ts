/**
 * src/run_pipeline.ts
 * Deterministic Phase1 -> Phase6 runner for CI golden tests.
 *
 * Optional runner-only debug flags (STRIPPED before Phase1):
 *   - debug_render_session_text: attach rendered_text to final output.
 *   - debug_emit_phase2: attach phase2_debug (high-signal) to final output.
 *   - debug_emit_phase3: attach phase3_debug payload to final output.
 *
 * IMPORTANT:
 * - Preserve Phase5 envelope (ok + adjustments) so Phase6 can see substitutions.
 * - Pass Phase1 canonical into Phase6 as the canonicalInput fingerprint source.
 * - Phase2 currently emits canonical JSON string; runner parses and passes canonical object downstream.
 */
import * as P1 from "../engine/src/phases/phase1.js";
import * as P2 from "../engine/src/phases/phase2.js";
import * as P3 from "../engine/src/phases/phase3.js";
import * as P4 from "../engine/src/phases/phase4.js";
import * as P5 from "../engine/src/phases/phase5.js";
import * as P6 from "../engine/src/phases/phase6.js";
import { renderSessionText } from "../engine/src/render/session_text.js";

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function callableExports(mod: AnyRecord): { key: string; fn: Function }[] {
  return Object.entries(mod)
    .filter(([k, v]) => typeof v === "function" && k !== "__esModule")
    .map(([k, v]) => ({ key: k, fn: v as Function }));
}

function pickOneOrHeuristic(mod: AnyRecord, phaseNum: number, preferred: string[] = []): Function {
  for (const name of preferred) {
    const v = (mod as AnyRecord)[name];
    if (typeof v === "function") return v as Function;
  }

  const fns = callableExports(mod);
  if (fns.length === 1) return fns[0].fn;

  const patterns = [
    new RegExp(`^phase${phaseNum}\\b`, "i"),
    new RegExp(`\\bphase${phaseNum}\\b`, "i"),
    /runPipeline/i,
    /runPhase/i,
    /compile/i,
    /build/i,
    /assemble/i,
    /apply/i,
    /validate/i,
  ];

  for (const re of patterns) {
    const hits = fns.filter((x) => re.test(x.key)).sort((a, b) => a.key.length - b.key.length);
    if (hits.length) return hits[0].fn;
  }

  const def = (mod as AnyRecord).default;
  if (typeof def === "function") return def as Function;

  const keys = Object.keys(mod).sort().join(", ");
  const fnKeys = fns.map((x) => x.key).sort().join(", ");
  throw new Error(
    `runPipeline: could not resolve phase${phaseNum} callable export. ` +
      `Callable exports: [${fnKeys || "(none)"}]. All exports: [${keys}]`
  );
}

type RunnerFlags = {
  debug_render_session_text: boolean;
  debug_emit_phase2: boolean;
  debug_emit_phase3: boolean;
};

function stripRunnerFlags(input: unknown): { cleaned: unknown; flags: RunnerFlags } {
  const flags: RunnerFlags = {
    debug_render_session_text: !!(isRecord(input) && input.debug_render_session_text === true),
    debug_emit_phase2: !!(isRecord(input) && input.debug_emit_phase2 === true),
    debug_emit_phase3: !!(isRecord(input) && input.debug_emit_phase3 === true),
  };

  if (!isRecord(input)) return { cleaned: input, flags };

  const cleaned: AnyRecord = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === "debug_render_session_text") continue;
    if (k === "debug_emit_phase2") continue;
    if (k === "debug_emit_phase3") continue;
    cleaned[k] = v;
  }
  return { cleaned, flags };
}

function unwrapPayload(r: any, preferredKeys: string[]): any {
  if (!r || typeof r !== "object" || r.ok !== true) return r;
  for (const k of preferredKeys) {
    if (k in r) return r[k];
  }
  return r;
}

/**
 * Phase2 canonical extraction:
 * - Prefer a real object if present (phase2/canonical/canonical_input/output).
 * - Otherwise parse phase2_canonical_json string into an object.
 */
function extractPhase2CanonicalObject(r2: any): AnyRecord | null {
  const candidate = unwrapPayload(r2, ["phase2", "canonical", "canonical_input", "output"]);
  if (isRecord(candidate) && !("phase2_canonical_json" in candidate)) {
    return candidate;
  }

  // If Phase2 returned metadata only, try to parse phase2_canonical_json
  const json =
    (isRecord(r2) && typeof (r2 as any).phase2_canonical_json === "string") ? (r2 as any).phase2_canonical_json
      : (isRecord(candidate) && typeof (candidate as any).phase2_canonical_json === "string") ? (candidate as any).phase2_canonical_json
      : null;

  if (typeof json === "string") {
    try {
      const parsed = JSON.parse(json);
      if (isRecord(parsed)) return parsed;
    } catch {
      return null;
    }
  }

  return null;
}

function attachRenderedTextIfEnabled(out: any, enabled: boolean): any {
  if (!enabled) return out;
  if (!out || typeof out !== "object") return out;
  if (out.ok !== true) return out;

  const session = out.session;
  if (!session || typeof session !== "object") return out;

  const rendered_text = renderSessionText(session);
  return { ...out, rendered_text };
}

/**
 * High-signal Phase2 debug:
 * - keep hashes + canonical json string (deterministic)
 * - include parsed constraints if present (small + meaningful)
 */
function attachPhase2DebugIfEnabled(out: any, enabled: boolean, r2: any, p2Canonical: AnyRecord | null): any {
  if (!enabled) return out;
  if (!out || typeof out !== "object") return out;

  const meta = unwrapPayload(r2, ["phase2", "canonical", "canonical_input", "output"]);

  const phase2_debug: AnyRecord = {};
  if (isRecord(meta)) {
    if (typeof (meta as any).phase2_hash === "string") phase2_debug.phase2_hash = (meta as any).phase2_hash;
    if (typeof (meta as any).canonical_input_hash === "string") phase2_debug.canonical_input_hash = (meta as any).canonical_input_hash;
    if (typeof (meta as any).phase2_canonical_json === "string") phase2_debug.phase2_canonical_json = (meta as any).phase2_canonical_json;
  }
  if (p2Canonical && isRecord(p2Canonical.constraints)) {
    phase2_debug.constraints = p2Canonical.constraints;
  }

  return { ...out, phase2_debug };
}

function attachPhase3DebugIfEnabled(out: any, enabled: boolean, r3: any): any {
  if (!enabled) return out;
  if (!out || typeof out !== "object") return out;

  const payload = unwrapPayload(r3, ["phase3", "output", "canonical"]);
  return { ...out, phase3_debug: { payload } };
}

export async function runPipeline(phase1Input: unknown): Promise<any> {
  const phase1 = pickOneOrHeuristic(P1 as any, 1, ["phase1Validate"]);
  const phase2 = pickOneOrHeuristic(P2 as any, 2);
  const phase3 = pickOneOrHeuristic(P3 as any, 3);
  const phase4 = pickOneOrHeuristic(P4 as any, 4);
  const phase5 = pickOneOrHeuristic(P5 as any, 5);
  const phase6 = pickOneOrHeuristic(P6 as any, 6, ["phase6ProduceSessionOutput"]);

  const { cleaned: phase1InputClean, flags } = stripRunnerFlags(phase1Input);

  // Phase1
  const r1 = await phase1(phase1InputClean);
  if (!r1 || typeof r1 !== "object") return { ok: false, failure_token: "phase1_failed_non_object" };
  if (r1.ok !== true) return r1;

  const p1 = unwrapPayload(r1, ["canonical_input", "canonical", "phase1", "output"]);
  const phase1CanonicalForP6 = p1;

  // Phase2
  const r2 = await phase2(p1);
  if (!r2 || typeof r2 !== "object") return { ok: false, failure_token: "phase2_failed_non_object" };
  if (r2.ok !== true) return r2;

  const p2Canonical = extractPhase2CanonicalObject(r2);
  if (!p2Canonical) {
    return { ok: false, failure_token: "phase2_canonical_parse_failed" };
  }

  // Phase3 (MUST receive the canonical object, not Phase2 meta)
  const r3 = await phase3(p2Canonical);
  if (!r3 || typeof r3 !== "object") return { ok: false, failure_token: "phase3_failed_non_object" };
  if (r3.ok !== true) return r3;

  const p3 = unwrapPayload(r3, ["phase3", "canonical", "output"]);

  // Phase4: prefer (phase1 canonical input, phase3 payload), then fallbacks
  let r4: any;
  try {
    r4 = await phase4(p1, p3);
  } catch {
    try {
      r4 = await phase4(p2Canonical, p3);
    } catch {
      try {
        r4 = await phase4(p3);
      } catch {
        r4 = await phase4(p2Canonical);
      }
    }
  }

  if (!r4 || typeof r4 !== "object") return { ok: false, failure_token: "phase4_failed_non_object" };
  if (r4.ok !== true) return r4;

  const program = unwrapPayload(r4, ["phase4", "output", "program", "plan", "canonical"]);

  // Phase5: preserve envelope
  const r5 = await phase5(program);
  if (!r5 || typeof r5 !== "object") return { ok: false, failure_token: "phase5_failed_non_object" };
  if (r5.ok !== true) return r5;

  const p5Envelope = r5;

  // Phase6: preferred signature (program, canonicalInput, p5Envelope)
  let r6: any;
  try {
    r6 = await phase6(program, phase1CanonicalForP6, p5Envelope);
  } catch {
    try {
      r6 = await phase6(program, phase1CanonicalForP6);
    } catch {
      try {
        r6 = await phase6(program, p5Envelope);
      } catch {
        r6 = await phase6(program);
      }
    }
  }

  // Attach runner-only debug
  let out = attachRenderedTextIfEnabled(r6, flags.debug_render_session_text);
  out = attachPhase2DebugIfEnabled(out, flags.debug_emit_phase2, r2, p2Canonical);
  out = attachPhase3DebugIfEnabled(out, flags.debug_emit_phase3, r3);
  return out;
}

export default runPipeline;
