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

function stagedFiles() {
  return out("git diff --name-only --cached")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isLockfileStaged() {
  return stagedFiles().includes("package-lock.json");
}

function resolveNoteMessage(args) {
  const env = (process.env.KOLOSSEUM_LOCKFILE_NOTE || "").trim();
  const cli = (args.message || "").trim();

  if (cli.length > 0) return { message: cli, provided: "cli" };
  if (env.length > 0) return { message: env, provided: "env" };

  return { message: "", provided: "none" };
}

function failMissingMessage() {
  // Keep this brutally actionable.
  const example = "Added dev dependency 'ajv-formats' for schema formats in CI";
  const cmd =
    `KOLOSSEUM_LOCKFILE_NOTE="${example}" git commit -m "chore: update dependencies"`;
  const psCmd =
    `$env:KOLOSSEUM_LOCKFILE_NOTE = "${example}"; git commit -m "chore: update dependencies"; Remove-Item Env:KOLOSSEUM_LOCKFILE_NOTE`;

  throw new Error(
    [
      "lockfile_note: package-lock.json is staged but no note message was provided.",
      "Provide a one-line reason via env var or -m/--message, then re-run commit.",
      "",
      "PowerShell:",
      `  ${psCmd}`,
      "",
      "POSIX shell:",
      `  ${cmd}`,
    ].join("\n")
  );
}

function main() {
  const args = parseArgs(process.argv);

  const lockfileStaged = isLockfileStaged();

  if (args.stagedOnly && !lockfileStaged) {
    // no-op
    process.exit(0);
  }

  // Strict mode: if lockfile is staged, a real message is mandatory.
  const msg = resolveNoteMessage(args);
  if (lockfileStaged && msg.provided === "none") {
    failMissingMessage();
  }

  // If lockfile isn't staged and we're not stagedOnly, we still allow manual note writing,
  // but require a message (same strictness) to avoid junk notes.
  if (!lockfileStaged && msg.provided === "none") {
    throw new Error(
      "lockfile_note: refusing to write note without a message. Provide -m/--message or KOLOSSEUM_LOCKFILE_NOTE."
    );
  }

  const repoRoot = process.cwd();
  const noteRel = "LOCKFILE_CHANGE_NOTE.md";
  const noteAbs = path.resolve(repoRoot, noteRel);

  const line = `${todayStampUtc()}: ${msg.message}\n`;

  const existing = fs.existsSync(noteAbs) ? fs.readFileSync(noteAbs, "utf8") : "";
  const next = normalizeToLf(existing) + normalizeToLf(line);

  ensureLfUtf8NoBom(noteAbs, next);

  // Stage it
  sh(`git add -- "${noteRel}"`, true);

  if (!args.quiet) {
    console.log(`[lockfile_note] ensured + staged ${noteRel}`);
  }
}

try {
  main();
} catch (e) {
  const msg = String(e && e.message ? e.message : e);
  console.error(`❌ ${msg}`);
  process.exit(1);
}