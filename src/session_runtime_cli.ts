import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { phase6ApplyRuntimeEventsWithTrace } from "../engine/src/phases/phase6.runtime.js";
import { renderSessionText } from "../engine/src/render/session_text.js";

// CLI: apply runtime events to a Phase6 session and re-render deterministic text.
// Usage:
//   node dist/src/session_runtime_cli.js --session out/session.json --events events.json --outdir out
//
// events.json must be a JSON array of runtime events accepted by the phase6 runtime reducer.

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function readFileUtf8(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    die(`session_runtime_cli: failed to read file: ${p}\n${String(e)}`);
  }
}

function writeUtf8Lf(absPath: string, text: string) {
  const lf = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  try {
    fs.writeFileSync(absPath, lf, { encoding: "utf8" });
  } catch (e) {
    die(`session_runtime_cli: failed to write: ${absPath}\n${String(e)}`);
  }
}

function ensureDir(absDir: string) {
  try {
    fs.mkdirSync(absDir, { recursive: true });
  } catch (e) {
    die(`session_runtime_cli: failed to mkdir: ${absDir}\n${String(e)}`);
  }
}

function parseJsonOrDie(raw: string, label: string): any {
  const trimmed = raw.trim();
  if (!trimmed) die(`session_runtime_cli: ${label} JSON is empty`);
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    die(`session_runtime_cli: failed to parse ${label} JSON\n${String(e)}\n---raw---\n${trimmed}`);
  }
}

function parseArgs(argv: string[]) {
  let sessionPath: string | null = null;
  let eventsPath: string | null = null;
  let outdir: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === "--session") {
      const v = argv[i + 1];
      if (!v) die("session_runtime_cli: missing value for --session");
      sessionPath = v;
      i++;
      continue;
    }

    if (a === "--events") {
      const v = argv[i + 1];
      if (!v) die("session_runtime_cli: missing value for --events");
      eventsPath = v;
      i++;
      continue;
    }

    if (a === "--outdir" || a === "-o") {
      const v = argv[i + 1];
      if (!v) die("session_runtime_cli: missing value for --outdir");
      outdir = v;
      i++;
      continue;
    }

    if (a === "--help" || a === "-h") {
      console.log(
        [
          "Kolosseum session runtime CLI",
          "",
          "Usage:",
          "  node dist/src/session_runtime_cli.js --session out/session.json --events events.json --outdir out",
          "",
          "Flags:",
          "  --session   Path to Phase6 session.json",
          "  --events    Path to JSON array of runtime events",
          "  --outdir    Output directory (writes session.json + session.txt)",
          ""
        ].join("\n")
      );
      process.exit(0);
    }

    die(`session_runtime_cli: unknown arg: ${a}`);
  }

  if (!sessionPath) die("session_runtime_cli: --session is required");
  if (!eventsPath) die("session_runtime_cli: --events is required");
  if (!outdir) die("session_runtime_cli: --outdir is required");

  return { sessionPath, eventsPath, outdir };
}

function normalizeSession(doc: any) {
  if (doc && typeof doc === "object" && doc.session && typeof doc.session === "object") return doc.session;
  return doc;
}

async function main() {
  const { sessionPath, eventsPath, outdir } = parseArgs(process.argv.slice(2));

  const sessionRaw = readFileUtf8(sessionPath);
  const eventsRaw = readFileUtf8(eventsPath);

  const sessionDoc = parseJsonOrDie(sessionRaw, `--session (${sessionPath})`);
  const eventsDoc = parseJsonOrDie(eventsRaw, `--events (${eventsPath})`);

  const session = normalizeSession(sessionDoc);

  if (!Array.isArray(eventsDoc)) {
    die("session_runtime_cli: events JSON must be an array");
  }

  const applied = phase6ApplyRuntimeEventsWithTrace(session, eventsDoc);

  const absOut = path.resolve(process.cwd(), outdir);
  ensureDir(absOut);

  const sessionAbs = path.join(absOut, "session.json");
  writeUtf8Lf(sessionAbs, JSON.stringify(applied.session, null, 2) + "\n");

  const rendered = renderSessionText(applied.session);
  const txtAbs = path.join(absOut, "session.txt");
  writeUtf8Lf(txtAbs, rendered.lines.join("\n") + "\n");

  const t: any = applied.trace;
  const trace_summary = {
    remaining: Array.isArray(t?.remaining_ids) ? t.remaining_ids.length : 0,
    completed: Array.isArray(t?.completed_ids) ? t.completed_ids.length : 0,
    dropped: Array.isArray(t?.dropped_ids) ? t.dropped_ids.length : 0,
    split_active: Boolean(t?.split_active)
  };

  process.stdout.write(
    JSON.stringify({
      ok: true,
      outdir: absOut,
      applied_events: eventsDoc.length,
      trace_summary,
      trace: applied.trace
    })
  );
}

main().catch((e) => die(`session_runtime_cli: fatal\n${String((e as any)?.stack || e)}`));