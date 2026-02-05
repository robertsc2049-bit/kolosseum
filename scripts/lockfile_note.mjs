import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execSync } from "node:child_process";

function sh(cmd, inherit = true) {
  execSync(cmd, { stdio: inherit ? "inherit" : ["ignore", "pipe", "inherit"] });
}
function out(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

function normalizeToLf(s) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function todayStampUtc() {
  // deterministic across machines/timezones
  const d = new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseArgs(argv) {
  const args = {
    stagedOnly: false,
    message: "",
    quiet: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];

    if (a === "--staged" || a === "--staged-only") {
      args.stagedOnly = true;
      continue;
    }
    if (a === "--quiet" || a === "-q") {
      args.quiet = true;
      continue;
    }
    if (a === "--message" || a === "-m") {
      const v = argv[i + 1];
      if (!v) throw new Error("lockfile_note: -m/--message requires a value");
      args.message = v;
      i++;
      continue;
    }

    throw new Error(`lockfile_note: unknown arg: ${a}`);
  }

  return args;
}

function ensureLfUtf8NoBom(absPath, text) {
  const dir = path.dirname(absPath);
  if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const lf = normalizeToLf(text);
  fs.writeFileSync(absPath, lf, { encoding: "utf8" });

  const probe = fs.readFileSync(absPath, "utf8");
  if (probe.includes("\r")) {
    throw new Error(`lockfile_note: CR detected after write (expected LF-only): ${absPath}`);
  }
}

function isLockfileStaged() {
  const staged = out("git diff --name-only --cached")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return staged.includes("package-lock.json");
}

function getMessage(args) {
  const env = (process.env.KOLOSSEUM_LOCKFILE_NOTE || "").trim();
  if (args.message.trim().length > 0) return args.message.trim();
  if (env.length > 0) return env;

  // Default is explicit but safe. You should override for anything meaningful.
  return "package-lock.json updated (auto-note). Set KOLOSSEUM_LOCKFILE_NOTE or pass -m to provide a real reason.";
}

function main() {
  const args = parseArgs(process.argv);

  if (args.stagedOnly && !isLockfileStaged()) {
    if (!args.quiet) console.log("[lockfile_note] package-lock.json not staged -> no-op");
    process.exit(0);
  }

  const repoRoot = process.cwd();
  const noteRel = "LOCKFILE_CHANGE_NOTE.md";
  const noteAbs = path.resolve(repoRoot, noteRel);

  const line = `${todayStampUtc()}: ${getMessage(args)}\n`;

  const existing = fs.existsSync(noteAbs) ? fs.readFileSync(noteAbs, "utf8") : "";
  const next = normalizeToLf(existing) + normalizeToLf(line);

  ensureLfUtf8NoBom(noteAbs, next);

  // Stage it
  sh(`git add -- "${noteRel}"`, true);

  if (!args.quiet) console.log(`[lockfile_note] ensured + staged ${noteRel}`);
}

try {
  main();
} catch (e) {
  console.error(`❌ ${String(e && e.message ? e.message : e)}`);
  process.exit(1);
}