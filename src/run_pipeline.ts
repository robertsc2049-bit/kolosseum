/**
 * src/run_pipeline.ts
 * Deterministic Phase1 -> Phase6 runner for CI golden tests.
 *
 * Runner rule:
 * - Never throw for expected engine failures (ok:false). Return them verbatim.
 * - Throw only for runner integration errors (missing exports, impossible signatures).
 *
 * Important:
 * - Preserve Phase5 envelope (ok + adjustments) so Phase6 can see substitutions.
 * - Pass Phase1 canonical into Phase6 as the canonicalInput fingerprint source.
 * - Optional runner-only debug_render_session_text flag (STRIPPED before Phase1).
 *   When true, attach rendered_text to the final output (but never by default).
 */
import * as P1 from "../engine/src/phases/phase1.js";
import * as P2 from "../engine/src/phases/phase2.js";
import * as P3 from "../engine/src/phases/phase3.js";
import * as P4 from "../engine/src/phases/phase4.js";
import * as P5 from "../engine/src/phases/phase5.js";
import * as P6 from "../engine/src/phases/phase6.js";
import { renderSessionText } from "../engine/src/render/session_text.js";

type Ok<T> = { ok: true } & T;
type Fail = { ok: false; failure_token: string; details?: unknown };

function die(msg: string): never {
  throw new Error(msg);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * IMPORTANT: strip runner-only debug flags so Phase1 doesn't see them.
 */
function stripRunnerFlags(input: unknown): { cleaned: unknown; debug_render_session_text: boolean } {
  const debug = !!(isRecord(input) && input.debug_render_session_text === true);
  if (!isRecord(input)) return { cleaned: input, debug_render_session_text: debug };

  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === "debug_render_session_text") continue;
    cleaned[k] = v;
  }
  return { cleaned, debug_render_session_text: debug };
}

function callableExports(mod: Record<string, unknown>) {
  return Object.entries(mod)
    .filter(([k, v]) => typeof v === "function" && k !== "__esModule")
    .map(([k, v]) => ({ key: k, fn: v as Function }));
}

function pickOneOrHeuristic(mod: Record<string, unknown>, phaseNum: number, preferred: string[] = []) {
  for (const name of preferred) {
    const v = (mod as any)[name];
    if (typeof v === "function") return v;
  }

  const fns = callableExports(mod);
  if (fns.length === 1) return fns[0].fn;

  const patterns: RegExp[] = [
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

  const def = (mod as any).default;
  if (typeof def === "function") return def;

  const keys = Object.keys(mod).sort().join(", ");
  const fnKeys = fns.map((x) => x.key).sort().join(", ");
  die(
    `runPipeline: could not resolve phase${phaseNum} callable export. ` +
      `Callable exports: [${fnKeys || "(none)"}]. All exports: [${keys}]`
  );
}

/**
 * Unwrap phase payloads.
 *
 * NOTE: Phase1 emits { ok:true, canonical_input: {...} }.
 * NOTE: Phase3 emits { ok:true, phase3: {...}, notes:[...] }.
 *
 * We support multiple historical keys so this runner stays resilient.
 */
function unwrapPayload(r: any, preferredKeys: string[]) {
  if (!r || typeof r !== "object" || r.ok !== true) return r;
  for (const k of preferredKeys) {
    if (k in r) return r[k];
  }
  return r;
}

function attachRenderedTextIfEnabled(out: any, enabled: boolean) {
  if (!enabled) return out;
  if (!out || typeof out !== "object") return out;
  if (out.ok !== true) return out;

  const session = (out as any).session;
  if (!session || typeof session !== "object") return out;

  const rendered_text = renderSessionText(session);
  return { ...out, rendered_text };
}

export async function runPipeline(phase1Input: unknown): Promise<any> {
  const phase1 = pickOneOrHeuristic(P1 as any, 1, ["phase1Validate"]);
  const phase2 = pickOneOrHeuristic(P2 as any, 2);
  const phase3 = pickOneOrHeuristic(P3 as any, 3);
  const phase4 = pickOneOrHeuristic(P4 as any, 4);
  const phase5 = pickOneOrHeuristic(P5 as any, 5);
  const phase6 = pickOneOrHeuristic(P6 as any, 6, ["phase6ProduceSessionOutput"]);

  const { cleaned: phase1InputClean, debug_render_session_text } = stripRunnerFlags(phase1Input);

  // Phase1
  const r1 = await phase1(phase1InputClean);
  if (!r1 || typeof r1 !== "object" || r1.ok !== true) return r1;

  const p1 = unwrapPayload(r1, ["canonical_input", "canonical", "phase1", "output"]);
  const phase1CanonicalForP6 = p1;

  // Phase2
  const r2 = await phase2(p1);
  if (!r2 || typeof r2 !== "object" || r2.ok !== true) return r2;

  const p2 = unwrapPayload(r2, ["phase2", "canonical", "canonical_input", "output"]);

  // Phase3
  const r3 = await phase3(p2);
  if (!r3 || typeof r3 !== "object" || r3.ok !== true) return r3;

  const p3 = unwrapPayload(r3, ["phase3", "canonical", "output"]);

  // Phase4: prefer (phase1 canonical input, phase3 payload), then fallbacks
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
  if (!r4 || typeof r4 !== "object" || r4.ok !== true) return r4;

  const program = unwrapPayload(r4, ["phase4", "output", "program", "plan", "canonical"]);

  // Phase5: preserve envelope
  const r5 = await phase5(program);
  if (!r5 || typeof r5 !== "object" || r5.ok !== true) return r5;

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
        try {
          r6 = await phase6(program);
        } catch {
          const exports6 = callableExports(P6 as any).map((x) => x.key).sort().join(", ");
          die(`runPipeline: Phase6 invocation failed for common signatures. Callable exports: [${exports6 || "(none)"}]`);
        }
      }
    }
  }

  return attachRenderedTextIfEnabled(r6, debug_render_session_text);
}

export default runPipeline;
