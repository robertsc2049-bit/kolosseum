import fs from "node:fs";
import process from "node:process";
import { execSync } from "node:child_process";

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trimEnd();
}
function die(msg) {
  console.error(msg);
  process.exit(1);
}
function ok(msg) {
  console.log(msg);
  process.exit(0);
}
function exists(p) {
  try { fs.accessSync(p, fs.constants.F_OK); return true; } catch { return false; }
}
function isFileStaged(relPath) {
  const out = sh("git diff --cached --name-only");
  if (!out) return false;
  return out.split(/\r?\n/).filter(Boolean).includes(relPath);
}
function readTextOrDie(relPath) {
  try { return fs.readFileSync(relPath, "utf8"); }
  catch (e) { die(`❌ lockfile_note_guard: expected ${relPath} to exist on disk but it could not be read.\n${String(e)}`); }
}

function detectFixCommand(exampleMsg) {
  // 1) Prefer npm script if present
  try {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    if (pkg?.scripts?.["lockfile:note"]) {
      return {
        title: "Fix it (preferred):",
        lines: [
          `npm run lockfile:note -- "${exampleMsg}"`,
          "git add LOCKFILE_CHANGE_NOTE.md",
        ],
      };
    }
  } catch {
    // ignore
  }

  // 2) Prefer direct node runner if helper exists
  if (exists("scripts/lockfile_note.mjs")) {
    return {
      title: "Fix it (direct):",
      lines: [
        `node scripts/lockfile_note.mjs "${exampleMsg}"`,
        "git add LOCKFILE_CHANGE_NOTE.md",
      ],
    };
  }

  // 3) Prefer PS helper if present
  if (exists("scripts/Write-Utf8NoBomLf.ps1")) {
    const today = new Date().toISOString().slice(0, 10);
    const line = `${today}: ${exampleMsg}\\n`;
    return {
      title: "Fix it (PowerShell helper):",
      lines: [
        `$line = "${line.replace(/"/g, '""')}"`,
        `.\\scripts\\Write-Utf8NoBomLf.ps1 -Path "LOCKFILE_CHANGE_NOTE.md" -Append -Text $line`,
        "git add LOCKFILE_CHANGE_NOTE.md",
      ],
    };
  }

  // 4) Last resort: generic LF-normalize snippet
  return {
    title: "Fix it (manual, PowerShell):",
    lines: [
      '$p="LOCKFILE_CHANGE_NOTE.md"',
      '$t=Get-Content -Raw $p',
      '$t=$t -replace "`r`n","`n"; $t=$t -replace "`r","`n"',
      '$enc=New-Object System.Text.UTF8Encoding($false)',
      '[System.IO.File]::WriteAllText((Resolve-Path $p).Path,$t,$enc)',
      "git add LOCKFILE_CHANGE_NOTE.md",
    ],
  };
}

function printFixHelp() {
  const example = "Added dev dependency 'ajv-formats' for phase4 schema enforcement test (CI ERR_MODULE_NOT_FOUND).";
  const fix = detectFixCommand(example);

  console.error("");
  console.error(fix.title);
  for (const l of fix.lines) console.error(`  ${l}`);
  console.error("");
  console.error("Then continue:");
  console.error("  git commit ...");
  console.error("");
}

function main() {
  const lockStaged = isFileStaged("package-lock.json");
  const noteStaged = isFileStaged("LOCKFILE_CHANGE_NOTE.md");

  if (!lockStaged) ok("OK: lockfile_note_guard (lockfile not staged)");

  if (!noteStaged) {
    console.error("❌ lockfile_note_guard: package-lock.json is staged but LOCKFILE_CHANGE_NOTE.md is not.");
    console.error("Add a short note explaining why the lockfile changed (LF-only), then stage it.");
    printFixHelp();
    process.exit(1);
  }

  const note = readTextOrDie("LOCKFILE_CHANGE_NOTE.md");
  if (note.includes("\r")) {
    console.error("❌ lockfile_note_guard: CRLF detected in:");
    console.error("- LOCKFILE_CHANGE_NOTE.md");
    console.error("Normalize to LF.");
    printFixHelp();
    process.exit(1);
  }

  ok("OK: lockfile_note_guard (package-lock.json staged with LOCKFILE_CHANGE_NOTE.md, LF-only)");
}

main();