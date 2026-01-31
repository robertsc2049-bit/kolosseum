/**
 * src/run_pipeline.ts
 * Deterministic Phase1 -> Phase6 runner for CI golden tests.
 *
 * Important:
 * - Preserve Phase5 envelope (ok + adjustments) so Phase6 can see substitutions.
 * - Pass Phase1 canonical into Phase6 as the canonicalInput fingerprint source.
 * - Phase7b: optional debug_render_session_text flag (STRIPPED before Phase1).
 *   When true, attach rendered_text to the final output (but never by default).
 */

import * as fs from "node:fs";
import * as P1 from "../engine/src/phases/phase1.js";
import * as P2 from "../engine/src/phases/phase2.js";
import * as P3 from "../engine/src/phases/phase3.js";
import * as P4 from "../engine/src/phases/phase4.js";
import * as P5 from "../engine/src/phases/phase5.js";
import * as P6 from "../engine/src/phases/phase6.js";
import { renderSessionText } from "../engine/src/render/session_text.js";

type AnyFn = (...args: any[]) => any;

function die(msg: string): never {
  throw new Error(msg);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * IMPORTANT: strip runner-only debug flags so Phase1 doesn't see them.
 */
function stripRunnerFlags(input: any): { cleaned: any; debug_render_session_text: boolean } {
  const debug = !!(isRecord(input) && (input as any).debug_render_session_text === true);
  if (!isRecord(input)) return { cleaned: input, debug_render_session_text: debug };

  // shallow clone without debug_render_session_text
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === "debug_render_session_text") continue;
    cleaned[k] = v;
  }
  return { cleaned, debug_render_session_text: debug };
}

function callableExports(mod: Record<string, any>) {
  return Object.entries(mod)
    .filter(([k, v]) => typeof v === "function" && k !== "__esModule")
    .map(([k, v]) => ({ key: k, fn: v as AnyFn }));
}

function pickOneOrHeuristic(mod: Record<string, any>, phaseNum: number, preferred: string[] = []): AnyFn {
  for (const name of preferred) {
    const v = (mod as any)[name];
    if (typeof v === "function") return v as AnyFn;
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
    /validate/i
  ];

  for (const re of patterns) {
    const hits = fns
      .filter((x) => re.test(x.key))
      .sort((a, b) => a.key.length - b.key.length);
    if (hits.length) return hits[0].fn;
  }

  const def = (mod as any).default;
  if (typeof def === "function") return def as AnyFn;

  const keys = Object.keys(mod).sort().join(", ");
  const fnKeys = fns.map((x) => x.key).sort().join(", ");
  die(
    `runPipeline: could not resolve phase${phaseNum} callable export. ` +
      `Callable exports: [${fnKeys || "(none)"}]. All exports: [${keys}]`
  );
}

function assertOk(r: any, label: string) {
  if (!r || typeof r !== "object" || r.ok !== true) {
    const token = r?.failure_token ? ` failure_token=${r.failure_token}` : "";
    throw new Error(`runPipeline: ${label} failed.${token}`);
  }
}

function unwrapPayload(r: any, preferredKeys: string[]) {
  if (!r || typeof r !== "object" || r.ok !== true) return r;
  for (const k of preferredKeys) {
    if (k in r) return (r as any)[k];
  }
  return r;
}

function attachRenderedTextIfEnabled(out: any, enabled: boolean) {
  if (!enabled) return out;

  if (!out || typeof out !== "object") return out;
  if (out.ok !== true) return out;

  // Phase6 contract: { ok:true, session:{...}, notes:[...] }
  const session = (out as any).session;
  if (!session || typeof session !== "object") return out;

  const rendered_text = renderSessionText(session);

  // attach in a way that doesn't disturb existing output when flag is false
  return {
    ...(out as any),
    rendered_text
  };
}

export async function runPipeline(phase1Input: any) {
  const phase1 = pickOneOrHeuristic(P1 as any, 1, ["phase1Validate"]);
  const phase2 = pickOneOrHeuristic(P2 as any, 2);
  const phase3 = pickOneOrHeuristic(P3 as any, 3);
  const phase4 = pickOneOrHeuristic(P4 as any, 4);
  const phase5 = pickOneOrHeuristic(P5 as any, 5);
  const phase6 = pickOneOrHeuristic(P6 as any, 6, ["phase6ProduceSessionOutput"]);

  // Strip runner-only flags BEFORE Phase1
  const { cleaned: phase1InputClean, debug_render_session_text } = stripRunnerFlags(phase1Input);

  // Phase1
  const r1 = await phase1(phase1InputClean);
  assertOk(r1, "phase1");
  const p1 = unwrapPayload(r1, ["phase1", "output", "canonical"]);
  const phase1CanonicalForP6 = p1;

  // Phase2
  const r2 = await phase2(p1);
  assertOk(r2, "phase2");
  const p2 = unwrapPayload(r2, ["phase2", "output", "canonical"]);

  // Phase3
  const r3 = await phase3(p2);
  assertOk(r3, "phase3");
  const p3 = unwrapPayload(r3, ["phase3", "output", "canonical"]);

  // Phase4 expects (phase2, phase3)
  let r4: any;
  try {
    r4 = await phase4(p2, p3);
  } catch {
    try {
      r4 = await phase4(p3);
    } catch {
      r4 = await phase4(p2);
    }
  }
  assertOk(r4, "phase4");
  const program = unwrapPayload(r4, ["phase4", "output", "program", "plan", "canonical"]);

  // Phase5: preserve envelope
  const r5 = await phase5(program);
  assertOk(r5, "phase5");
  const p5Envelope = r5;

  // Phase6: preferred signature (program, canonicalInput, p5Envelope)
  let r6: any;
  try {
    r6 = await phase6(program, phase1CanonicalForP6, p5Envelope);
  } catch {
    // Fallbacks
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
          throw new Error(
            `runPipeline: Phase6 invocation failed for common signatures. Callable exports: [${exports6 || "(none)"}]`
          );
        }
      }
    }
  }

  return attachRenderedTextIfEnabled(r6, debug_render_session_text);
}

export default runPipeline;
