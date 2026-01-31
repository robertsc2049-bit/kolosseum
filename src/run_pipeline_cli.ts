/**
 * src/run_pipeline_cli.ts
 *
 * CLI wrapper around src/run_pipeline.ts::runPipeline
 *
 * Usage:
 *   node dist/src/run_pipeline_cli.js ./ci/fixtures/vanilla_minimal.json
 *   type ./ci/fixtures/vanilla_minimal.json | node dist/src/run_pipeline_cli.js
 *
 * Contract:
 * - stdout is ALWAYS JSON (pretty printed).
 * - on error, stdout is JSON: { ok:false, error:string } and exit code is 1.
 * - do not write logs to stdout.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { runPipeline } from "./run_pipeline.js";

async function readStdinUtf8(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function stdoutJson(obj: unknown) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
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

  let phase1Input: any;
  try {
    phase1Input = JSON.parse(inputText);
  } catch (e: any) {
    throw new Error(`Invalid JSON input. ${e?.message || String(e)}`);
  }

  const out = await runPipeline(phase1Input);
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