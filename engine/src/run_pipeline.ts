/**
 * engine/src/run_pipeline.ts
 *
 * Golden-test runner entrypoint:
 * - Accepts Phase1 input
 * - Executes Phase1 -> Phase6 in sequence
 * - Returns Phase6 output by default (or the first failure object)
 *
 * Runner-only flags:
 * - debug_render_session_text: true
 *   - STRIPPED before Phase1
 *   - attaches rendered_text to Phase6 ok output
 *
 * - debug_return_phase: "phase1" | "phase2" | "phase3" | "phase4" | "phase5" | "phase6"
 *   - STRIPPED before Phase1
 *   - returns the selected phase result object (useful for goldens)
 */

import * as P1 from "./phases/phase1.js";
import * as P2 from "./phases/phase2.js";
import * as P3 from "./phases/phase3.js";
import * as P4 from "./phases/phase4.js";
import * as P5 from "./phases/phase5.js";
import * as P6 from "./phases/phase6.js";
import { renderSessionText } from "./render/session_text.js";

type AnyFn = (...args: any[]) => any;

function pickPhaseFn(mod: Record<string, any>, label: string): AnyFn {
  const preferred = [
    label,
    `run${label.toUpperCase()}`,
    `run${label[0].toUpperCase()}${label.slice(1)}`,
    `apply${label[0].toUpperCase()}${label.slice(1)}`,
    `compute${label[0].toUpperCase()}${label.slice(1)}`,
    `build${label[0].toUpperCase()}${label.slice(1)}`,
    `resolve${label[0].toUpperCase()}${label.slice(1)}`
  ];

  for (const k of preferred) {
    const v = (mod as any)[k];
    if (typeof v === "function") return v as AnyFn;
  }

  const blacklist = new Set(["default", "__esModule"]);
  for (const [k, v] of Object.entries(mod)) {
    if (blacklist.has(k)) continue;
    if (typeof v === "function") return v as AnyFn;
  }

  throw new Error(`runPipeline: could not find a callable phase function in ${label}.ts exports.`);
}

function isOkResult(r: any): boolean {
  return !!r && typeof r === "object" && r.ok === true;
}

function unwrapOk(r: any, label: string) {
  if (!isOkResult(r)) {
    const token = r?.failure_token ? ` failure_token=${r.failure_token}` : "";
    throw new Error(`runPipeline: ${label} failed.${token}`);
  }
  return r;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

type DebugReturnPhase = "phase1" | "phase2" | "phase3" | "phase4" | "phase5" | "phase6";

function parseDebugReturnPhase(v: unknown): DebugReturnPhase | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "phase1") return "phase1";
  if (s === "phase2") return "phase2";
  if (s === "phase3") return "phase3";
  if (s === "phase4") return "phase4";
  if (s === "phase5") return "phase5";
  if (s === "phase6") return "phase6";
  return null;
}

function stripRunnerFlags(input: any): {
  cleaned: any;
  debug_render_session_text: boolean;
  debug_return_phase: DebugReturnPhase | null;
} {
  const debug_render_session_text = !!(isRecord(input) && (input as any).debug_render_session_text === true);
  const debug_return_phase = parseDebugReturnPhase(isRecord(input) ? (input as any).debug_return_phase : null);

  if (!isRecord(input)) {
    return { cleaned: input, debug_render_session_text, debug_return_phase };
  }

  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === "debug_render_session_text") continue;
    if (k === "debug_return_phase") continue;
    cleaned[k] = v;
  }

  return { cleaned, debug_render_session_text, debug_return_phase };
}

function attachRenderedTextIfEnabled(out: any, enabled: boolean) {
  if (!enabled) return out;

  if (!out || typeof out !== "object") return out;
  if (out.ok !== true) return out;

  const session = (out as any).session;
  if (!session || typeof session !== "object") return out;

  const rendered_text = renderSessionText(session);
  return { ...(out as any), rendered_text };
}

/**
 * Main runner used by golden tests.
 */
export async function runPipeline(phase1Input: any) {
  const phase1Fn = pickPhaseFn(P1, "phase1");
  const phase2Fn = pickPhaseFn(P2, "phase2");
  const phase3Fn = pickPhaseFn(P3, "phase3");
  const phase4Fn = pickPhaseFn(P4, "phase4");
  const phase5Fn = pickPhaseFn(P5, "phase5");
  const phase6Fn = pickPhaseFn(P6, "phase6");

  const {
    cleaned: phase1InputClean,
    debug_render_session_text,
    debug_return_phase
  } = stripRunnerFlags(phase1Input);

  // Phase1
  const r1 = await phase1Fn(phase1InputClean);
  unwrapOk(r1, "phase1");
  if (debug_return_phase === "phase1") return r1;

  // Phase2
  const r2 = await phase2Fn(r1);
  unwrapOk(r2, "phase2");
  if (debug_return_phase === "phase2") return r2;

  // Phase3
  const r3 = await phase3Fn(r2);
  unwrapOk(r3, "phase3");
  if (debug_return_phase === "phase3") return r3;

  // Phase4
  const r4 = await phase4Fn(phase1InputClean, r3);
  unwrapOk(r4, "phase4");
  if (debug_return_phase === "phase4") return r4;

  // Phase5
  const r5 = await phase5Fn(r4);
  unwrapOk(r5, "phase5");
  if (debug_return_phase === "phase5") return r5;

  // Phase6
  const r6 = await phase6Fn(r4.program, phase1InputClean, r5);
  const out = attachRenderedTextIfEnabled(r6, debug_render_session_text);

  if (debug_return_phase === "phase6") return out;
  return out;
}

export default runPipeline;
