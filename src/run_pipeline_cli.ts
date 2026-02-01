/**
 * src/run_pipeline_cli.ts
 *
 * CLI wrapper around src/run_pipeline.ts::runPipeline
 *
 * Usage:
 *   node dist/src/run_pipeline_cli.js ./examples/hello_world.json
 *   type ./examples/hello_world.json | node dist/src/run_pipeline_cli.js
 *
 * Contract:
 * - stdout is ALWAYS JSON (pretty printed).
 * - on error, stdout is JSON: { ok:false, error:string } and exit code is 1.
 * - do not write logs to stdout.
 *
 * Runner-only flags:
 * - debug_render_session_text: boolean
 *   MUST be stripped before Phase1 validation.
 *   When true, runner may attach rendered_text to output.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { runPipeline } from "./run_pipeline.js";

type RunnerFlags = {
  debug_render_session_text?: boolean;
};

type Phase6Intensity =
  | { type: "percent_1rm"; value: number }
  | { type: "rpe"; value: number }
  | { type: "load"; value: number };

type Phase6Exercise = {
  exercise_id: string;
  source: "program";
  block_id?: string;
  item_id?: string;
  sets?: number;
  reps?: number;
  intensity?: Phase6Intensity;
  rest_seconds?: number;
  substituted_from?: string;
};

type Phase6Session = {
  session_id: string;
  status: "ready";
  exercises: Phase6Exercise[];
};

type PipelineOk = {
  ok: true;
  session: Phase6Session;
  notes: string[];
  // runner may attach this (not part of core engine phases)
  rendered_text?: {
    title: string;
    lines: string[];
    warnings: string[];
  };
};

type PipelineFail = { ok: false; error?: string; failure_token?: string; details?: unknown };
type PipelineOut = PipelineOk | PipelineFail | Record<string, unknown>;

function stripBom(s: string): string {
  // UTF-8 BOM
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

async function readStdinUtf8(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function stdoutJson(obj: unknown) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function extractRunnerFlagsAndSanitize(input: unknown): { flags: RunnerFlags; sanitized: unknown } {
  // Only top-level runner flag stripping is supported by contract.
  if (!isPlainObject(input)) return { flags: {}, sanitized: input };

  const flags: RunnerFlags = {};
  if (Object.prototype.hasOwnProperty.call(input, "debug_render_session_text")) {
    flags.debug_render_session_text = Boolean(input.debug_render_session_text);
  }

  // Strip runner-only flags before Phase1 sees them
  const { debug_render_session_text: _ignored, ...rest } = input;
  return { flags, sanitized: rest };
}

function formatIntensity(i: Phase6Intensity | undefined): string | null {
  if (!i) return null;
  if (i.type === "percent_1rm") return `@ ${i.value}%`;
  if (i.type === "rpe") return `@ RPE ${i.value}`;
  if (i.type === "load") return `@ ${i.value}`;
  return null;
}

function renderSessionText(session: Phase6Session): { title: string; lines: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const title = `Session ${session.session_id}`;

  const lines = session.exercises.map((ex, idx) => {
    const n = idx + 1;

    const setsReps =
      typeof ex.sets === "number" && typeof ex.reps === "number" ? ` — ${ex.sets}x${ex.reps}` : "";

    const intensity = formatIntensity(ex.intensity);
    const intensityTxt = intensity ? ` ${intensity}` : "";

    const restTxt = typeof ex.rest_seconds === "number" ? ` rest ${ex.rest_seconds}s` : "";

    const subTxt = ex.substituted_from ? ` (sub for ${ex.substituted_from})` : "";

    return `${n}) ${ex.exercise_id}${setsReps}${intensityTxt}${restTxt}${subTxt}`;
  });

  return { title, lines, warnings };
}

async function main(argv: string[]) {
  // argv[0]=node, argv[1]=script, argv[2]=optional file path
  const arg = argv[2];

  let inputText: string;
  if (arg && arg.trim().length > 0) {
    const p = resolve(arg);
    inputText = await readFile(p, "utf8");
  } else {
    inputText = await readStdinUtf8();
  }

  inputText = stripBom(inputText);

  let rawInput: unknown;
  try {
    rawInput = JSON.parse(inputText);
  } catch (e: any) {
    throw new Error(`Invalid JSON input. ${e?.message || String(e)}`);
  }

  const { flags, sanitized } = extractRunnerFlagsAndSanitize(rawInput);

  const out = (await runPipeline(sanitized)) as PipelineOut;

  // Attach rendered_text ONLY when runner flag set and output is ok+has session
  if (flags.debug_render_session_text === true) {
    if (isPlainObject(out) && (out as any).ok === true && isPlainObject((out as any).session)) {
      const sess = (out as any).session as Phase6Session;
      (out as any).rendered_text = renderSessionText(sess);
    }
  } else {
    // Ensure we do not leak downstream-rendered content if any phase mistakenly attached it
    if (isPlainObject(out) && Object.prototype.hasOwnProperty.call(out, "rendered_text")) {
      delete (out as any).rendered_text;
    }
  }

  stdoutJson(out);
}

const isDirectRun = (() => {
  const scriptPath = process.argv[1] ? resolve(process.argv[1]) : "";
  const scriptUrl = scriptPath ? pathToFileURL(scriptPath).href : "";
  return scriptUrl && import.meta.url === scriptUrl;
})();

if (isDirectRun) {
  main(process.argv).catch((e: any) => {
    const msg = e?.stack || e?.message || String(e);
    stdoutJson({ ok: false, error: msg });
    process.exitCode = 1;
  });
}

export default main;
