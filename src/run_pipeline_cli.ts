/**
 * src/run_pipeline_cli.ts
 *
 * CLI wrapper around src/run_pipeline.ts::runPipeline
 *
 * Usage:
 *   node dist/src/run_pipeline_cli.js ./path/to/input.json
 *   type ./path/to/input.json | node dist/src/run_pipeline_cli.js
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
 *
 * Runner-only controls (NOT allowed in Phase1 JSON):
 * - --return-phase phase1|phase2|phase3|phase4|phase5|phase6
 * - env: KOLOSSEUM_RETURN_PHASE=phaseX
 *
 * Precedence:
 *   CLI flag > env var > default (phase6)
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runPipeline, type RunPipelineOptions, type ReturnPhase } from "./run_pipeline.js";

function stripBom(s: string) {
  // UTF-8 BOM
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

async function readStdinUtf8() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function stdoutJson(obj: unknown) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function extractRunnerFlagsAndSanitize(input: unknown) {
  // Only top-level runner flag stripping is supported by contract.
  if (!isPlainObject(input)) return { flags: {}, sanitized: input };

  const flags: { debug_render_session_text?: boolean } = {};
  if (Object.prototype.hasOwnProperty.call(input, "debug_render_session_text")) {
    flags.debug_render_session_text = Boolean((input as any).debug_render_session_text);
  }

  // Strip runner-only flags before Phase1 sees them
  const { debug_render_session_text: _ignored, ...rest } = input as any;
  return { flags, sanitized: rest };
}

function normReturnPhase(v: unknown): ReturnPhase | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "phase1") return "phase1";
  if (s === "phase2") return "phase2";
  if (s === "phase3") return "phase3";
  if (s === "phase4") return "phase4";
  if (s === "phase5") return "phase5";
  if (s === "phase6") return "phase6";
  return null;
}

function parseReturnPhaseFromArgv(argv: string[]): ReturnPhase | null {
  const idx = argv.findIndex((a) => a === "--return-phase");
  if (idx === -1) return null;
  return normReturnPhase(argv[idx + 1]);
}

function formatIntensity(i: any): string | null {
  if (!i) return null;
  if (i.type === "percent_1rm") return `@ ${i.value}%`;
  if (i.type === "rpe") return `@ RPE ${i.value}`;
  if (i.type === "load") return `@ ${i.value}`;
  return null;
}

function renderSessionText(session: any) {
  const warnings: string[] = [];
  const title = `Session ${session.session_id}`;
  const lines = (session.exercises || []).map((ex: any, idx: number) => {
    const n = idx + 1;

    // IMPORTANT: preserve legacy string exactly for tests (mojibake dash)
    const setsReps =
      typeof ex.sets === "number" && typeof ex.reps === "number" ? ` \u2014 ${ex.sets}x${ex.reps}` : "";
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
  // IMPORTANT: do not treat argv[3+] as file paths. They are flags.
  const arg = argv[2];
  let inputText: string;

  if (arg && arg.trim().length > 0 && !arg.startsWith("--")) {
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

  // return phase selection: CLI > env > default
  const cliReturn = parseReturnPhaseFromArgv(argv);
  const envReturn = normReturnPhase(process.env.KOLOSSEUM_RETURN_PHASE);
  const return_phase: ReturnPhase = cliReturn || envReturn || "phase6";

  const opts: RunPipelineOptions = { return_phase };

  const out: any = await runPipeline(sanitized, opts);

  // Attach rendered_text ONLY when runner flag set and output is ok+has session
  if (flags.debug_render_session_text === true) {
    if (isPlainObject(out) && out.ok === true && isPlainObject((out as any).session)) {
      (out as any).rendered_text = renderSessionText((out as any).session);
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
