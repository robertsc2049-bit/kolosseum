/**
 * engine/src/run_pipeline.ts
 *
 * Golden-test runner entrypoint:
 * - Accepts Phase1 input (whatever your engine uses as "Phase1Input")
 * - Executes Phase1 -> Phase6 in sequence
 * - Returns the Phase6 output (or the first failure object)
 *
 * This file exists specifically so CI + golden fixtures have a stable entrypoint.
 */

import * as P1 from "./phases/phase1.js";
import * as P2 from "./phases/phase2.js";
import * as P3 from "./phases/phase3.js";
import * as P4 from "./phases/phase4.js";
import * as P5 from "./phases/phase5.js";
import * as P6 from "./phases/phase6.js";

type AnyFn = (...args: any[]) => any;

function pickPhaseFn(mod: Record<string, any>, label: string): AnyFn {
  // Prefer common names first
  const preferred = [
    label,                 // "phase1", etc
    `run${label.toUpperCase()}`, // "runPHASE1" unlikely but cheap
    `run${label[0].toUpperCase()}${label.slice(1)}`, // runPhase1
    `apply${label[0].toUpperCase()}${label.slice(1)}`, // applyPhase1
    `compute${label[0].toUpperCase()}${label.slice(1)}`,
    `build${label[0].toUpperCase()}${label.slice(1)}`,
    `resolve${label[0].toUpperCase()}${label.slice(1)}`,
  ];

  for (const k of preferred) {
    const v = (mod as any)[k];
    if (typeof v === "function") return v as AnyFn;
  }

  // Otherwise: pick the first exported function (excluding obvious non-phase utilities)
  const blacklist = new Set([
    "default",
    "__esModule",
  ]);

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
    // Return failures as-is so golden tests can snapshot them if desired
    // (or fail if you choose to forbid failures in golden)
    const token = r?.failure_token ? ` failure_token=${r.failure_token}` : "";
    throw new Error(`runPipeline: ${label} failed.${token}`);
  }
  return r;
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

  // Phase1
  const r1 = await phase1Fn(phase1Input);
  unwrapOk(r1, "phase1");

  // Many codebases return { ok:true, constraints: ... } etc.
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
  // Phase6 may be ok:true session:... OR direct session output depending on your design.
  return r6;
}

export default runPipeline;