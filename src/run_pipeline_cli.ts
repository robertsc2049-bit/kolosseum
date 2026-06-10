import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { runPipeline } from "./run_pipeline.js";

// NOTE: CLI entrypoint.
// - Reads Phase1 input JSON from stdin by default, or via --in <file>.
// - If --outdir <dir> is provided, writes:
//   - session.json (Phase6 session output)
//   - session.txt  (rendered training sheet; deterministic; LF newline)
// - Always prints the pipeline result JSON to stdout.

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function readStdinUtf8(): string {
  try {
    return fs.readFileSync(0, "utf8");
  } catch (e) {
    die(`run_pipeline_cli: failed to read stdin: ${String(e)}`);
  }
}

function readFileUtf8(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    die(`run_pipeline_cli: failed to read file: ${p}\n${String(e)}`);
  }
}

function ensureDir(absDir: string) {
  try {
    fs.mkdirSync(absDir, { recursive: true });
  } catch (e) {
    die(`run_pipeline_cli: failed to mkdir: ${absDir}\n${String(e)}`);
  }
}

function writeUtf8Lf(absPath: string, text: string) {
  const lf = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  try {
    fs.writeFileSync(absPath, lf, { encoding: "utf8" });
  } catch (e) {
    die(`run_pipeline_cli: failed to write: ${absPath}\n${String(e)}`);
  }
}

function parseJsonOrDie(raw: string, label: string): any {
  const trimmed = raw.trim();
  if (!trimmed) die(`run_pipeline_cli: ${label} JSON is empty`);
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    die(`run_pipeline_cli: failed to parse ${label} JSON\n${String(e)}\n---raw---\n${trimmed}`);
  }
}

function resolveOutdir(outdirArg: string): string {
  return path.resolve(process.cwd(), outdirArg);
}

function parseArgs(argv: string[]) {
  let inFile: string | null = null;
  let outdir: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === "--in" || a === "-i") {
      const v = argv[i + 1];
      if (!v) die("run_pipeline_cli: missing value for --in");
      inFile = v;
      i++;
      continue;
    }

    if (a === "--outdir" || a === "-o") {
      const v = argv[i + 1];
      if (!v) die("run_pipeline_cli: missing value for --outdir");
      outdir = v;
      i++;
      continue;
    }

    if (a === "--help" || a === "-h") {
      console.log(
        [
          "Kolosseum run_pipeline CLI",
          "",
          "Reads Phase1 input JSON from stdin by default.",
          "",
          "Usage:",
          "  node dist/src/run_pipeline_cli.js < stdin.json",
          "  node dist/src/run_pipeline_cli.js --in path/to/input.json",
          "  node dist/src/run_pipeline_cli.js --in input.json --outdir out",
          "",
          "Flags:",
          "  --in, -i       Input file (otherwise stdin)",
          "  --outdir, -o   Write session.json + session.txt to this directory",
          "",
        ].join("\n")
      );
      process.exit(0);
    }

    die(`run_pipeline_cli: unknown arg: ${a}`);
  }

  return { inFile, outdir };
}

async function main() {
  const { inFile, outdir } = parseArgs(process.argv.slice(2));

  // Hermetic env: prevent dev machine env from changing return phase.
  delete (process.env as any).KOLOSSEUM_RETURN_PHASE;

  const raw = inFile ? readFileUtf8(inFile) : readStdinUtf8();
  const input = parseJsonOrDie(raw, inFile ? `--in (${inFile})` : "stdin");

  const out = await runPipeline(input);

  if (outdir) {
    if (!out || typeof out !== "object") die("run_pipeline_cli: pipeline output must be an object");
    if (!("ok" in out) || (out as any).ok !== true) die(`run_pipeline_cli: pipeline failed; cannot export session\n${JSON.stringify(out)}`);

    const absOut = resolveOutdir(outdir);
    ensureDir(absOut);

    const sessionAbs = path.join(absOut, "session.json");
    writeUtf8Lf(sessionAbs, JSON.stringify((out as any).session, null, 2) + "\n");

    let renderedLines: string[] = [];

    const rt = (out as any).rendered_text;
    if (rt && Array.isArray(rt.lines)) {
      renderedLines = rt.lines.slice();
    } else {
      const mod = await import("../engine/src/render/session_text.js");
      const renderSessionText = mod.renderSessionText as (s: any) => { title: string; lines: string[] };
      const rendered = renderSessionText((out as any).session);
      renderedLines = rendered.lines;
    }

    const txtAbs = path.join(absOut, "session.txt");
    writeUtf8Lf(txtAbs, renderedLines.join("\n") + "\n");
  }

  process.stdout.write(JSON.stringify(out));
}

main().catch((e) => {
  die(`run_pipeline_cli: fatal\n${String((e as any)?.stack || e)}`);
});