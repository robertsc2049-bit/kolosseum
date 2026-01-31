/**
 * src/run_pipeline.ts
 * Deterministic Phase1 -> Phase6 runner for CI golden tests.
 *
 * Optional runner-only debug flags (STRIPPED before Phase1):
 *   - debug_render_session_text: attach rendered_text to final output.
 *   - debug_emit_phase2: attach phase2_debug payload to final output.
 *   - debug_emit_phase3: attach phase3_debug payload to final output.
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

function unwrapPayload(r: any, preferredKeys: string[]): any {
  if (!r || typeof r !== "object" || r.ok !== true) return r;
  for (const k of preferredKeys) {
    if (k in r) return r[k];
  }
  return r;
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

function attachRenderedTextIfEnabled(out: any, enabled: boolean): any {
  if (!enabled) return out;
  if (!out || typeof out !== "object") return out;
  if (out.ok !== true) return out;

  const session = out.session;
  if (!session || typeof session !== "object") return out;

  const rendered_text = renderSessionText(session);
  return { ...out, rendered_text };
}

function attachPhaseDebug(out: any, key: string, enabled: boolean, phaseResult: any, preferredKeys: string[]): any {
  if (!enabled) return out;
  if (!out || typeof out !== "object") return out;

  const payload = unwrapPayload(phaseResult, preferredKeys);
  const debug: AnyRecord = { payload };

  return { ...out, [key]: debug };
}

export async function runPipeline(phase1Input: unknown): Promise<any> {
  const phase1 = pickOneOrHeuristic(P1 as any, 1, ["phase1Validate"]);
  const phase2 = pickOneOrHeuristic(P2 as any, 2);
  const phase3 = pickOneOrHeuristic(P3 as any, 3);
  const phase4 = pickOneOrHeuristic(P4 as any, 4);
  const phase5 = pickOneOrHeuristic(P5 as any, 5);
  const phase6 = pickOneOrHeuristic(P6 as any, 6, ["phase6ProduceSessionOutput"]);

  const { cleaned: phase1InputClean, flags } = stripRunnerFlags(phase1Input);

  const r1 = await phase1(phase1InputClean);
  if (!r1 || typeof r1 !== "object") return { ok: false, failure_token: "phase1_failed_non_object" };
  if (r1.ok !== true) return r1;

  const p1 = unwrapPayload(r1, ["canonical_input", "canonical", "phase1", "output"]);
  const phase1CanonicalForP6 = p1;

  const r2 = await phase2(p1);
  if (!r2 || typeof r2 !== "object") return { ok: false, failure_token: "phase2_failed_non_object" };
  if (r2.ok !== true) return r2;

  const p2 = unwrapPayload(r2, ["phase2", "canonical", "canonical_input", "output"]);

  const r3 = await phase3(p2);
  if (!r3 || typeof r3 !== "object") return { ok: false, failure_token: "phase3_failed_non_object" };
  if (r3.ok !== true) return r3;

  const p3 = unwrapPayload(r3, ["phase3", "canonical", "output"]);

  let r4: any;
  try {
    r4 = await phase4(p1, p3);
  } catch {
    try {
      r4 = await phase4(p2, p3);
    } catch {
      try {
        r4 = await phase4(p3);
      } catch {
        r4 = await phase4(p2);
      }
    }
  }

  if (!r4 || typeof r4 !== "object") return { ok: false, failure_token: "phase4_failed_non_object" };
  if (r4.ok !== true) return r4;

  const program = unwrapPayload(r4, ["phase4", "output", "program", "plan", "canonical"]);

  const r5 = await phase5(program);
  if (!r5 || typeof r5 !== "object") return { ok: false, failure_token: "phase5_failed_non_object" };
  if (r5.ok !== true) return r5;

  const p5Envelope = r5;

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

  let out = attachRenderedTextIfEnabled(r6, flags.debug_render_session_text);
  out = attachPhaseDebug(out, "phase2_debug", flags.debug_emit_phase2, r2, ["phase2", "canonical", "canonical_input", "output"]);
  out = attachPhaseDebug(out, "phase3_debug", flags.debug_emit_phase3, r3, ["phase3", "output", "canonical"]);
  return out;
}

export default runPipeline;
