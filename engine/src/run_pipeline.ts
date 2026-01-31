/**
 * engine/src/run_pipeline.ts
 *
 * Golden-test runner entrypoint:
 * - Accepts Phase1 input (whatever your engine uses as "Phase1Input")
 * - Executes Phase1 -> Phase6 in sequence
 * - Returns the Phase6 output (or the first failure object)
 *
 * This file exists specifically so CI + golden fixtures have a stable entrypoint.
 *
 * Phase7b:
 * - Accepts optional runner-only flag: debug_render_session_text: true
 * - STRIPS it before Phase1 (so Phase1 schema never sees it)
 * - When enabled, attaches rendered_text to the Phase6 output object
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
  // Prefer common names first
  const preferred = [
    label, // "phase1", etc
    `run${label.toUpperCase()}`, // "runPHASE1"
    `run${label[0].toUpperCase()}${label.slice(1)}`, // runPhase1
    `apply${label[0].toUpperCase()}${label.slice(1)}`, // applyPhase1
    `compute${label[0].toUpperCase()}${label.slice(1)}`,
    `build${label[0].toUpperCase()}${label.slice(1)}`,
    `resolve${label[0].toUpperCase()}${label.slice(1)}`
  ];

  for (const k of preferred) {
    const v = (mod as any)[k];
    if (typeof v === "function") return v as AnyFn;
  }

  // Otherwise: pick the first exported function (excluding obvious non-phase utilities)
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

function stripRunnerFlags(input: any): { cleaned: any; debug_render_session_text: boolean } {
  const debug = !!(isRecord(input) && (input as any).debug_render_session_text === true);
  if (!isRecord(input)) return { cleaned: input, debug_render_session_text: debug };

  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === "debug_render_session_text") continue;
    cleaned[k] = v;
  }
  return { cleaned, debug_render_session_text: debug };
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
 * Accepts the Phase1 input shape used by your engine.
 */
export async function runPipeline(phase1Input: any) {
  const phase1Fn = pickPhaseFn(P1, "phase1");
  const phase2Fn = pickPhaseFn(P2, "phase2");
  const phase3Fn = pickPhaseFn(P3, "phase3");
  const phase4Fn = pickPhaseFn(P4, "phase4");
  const phase5Fn = pickPhaseFn(P5, "phase5");
  const phase6Fn = pickPhaseFn(P6, "phase6");

  const { cleaned: phase1InputClean, debug_render_session_text } = stripRunnerFlags(phase1Input);

  // Phase1
  const r1 = await phase1Fn(phase1InputClean);
  unwrapOk(r1, "phase1");
  const o1 = r1;

  // Phase2
  const r2 = await phase2Fn(o1);
  unwrapOk(r2, "phase2");
  const o2 = r2;

  // Phase3
  const r3 = await phase3Fn(o2);
  unwrapOk(r3, "phase3");
  const o3 = r3;

  // Phase4
  const r4 = await phase4Fn(o3);
  unwrapOk(r4, "phase4");
  const o4 = r4;

  // Phase5
  const r5 = await phase5Fn(o4);
  unwrapOk(r5, "phase5");
  const o5 = r5;

  // Phase6
  const r6 = await phase6Fn(o4, o5);

  return attachRenderedTextIfEnabled(r6, debug_render_session_text);
}

export default runPipeline;
