import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function sh(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

let staged = [];
try {
  staged = sh("git diff --name-only --cached")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
} catch (e) {
  die(`❌ lockfile_note_guard: git diff --cached failed (${e?.message ?? e})`);
}

const LOCK = "package-lock.json";
const NOTE = "LOCKFILE_CHANGE_NOTE.md";

if (!staged.includes(LOCK)) {
  console.log("OK: lockfile_note_guard (lockfile not staged)");
  process.exit(0);
}

if (!staged.includes(NOTE)) {
  die(`❌ lockfile_note_guard: ${LOCK} is staged but ${NOTE} is not. Add a short note explaining why.`);
}

try {
  const note = readFileSync(NOTE, "utf8").replace(/^\uFEFF/, "").trim();
  if (!note) die(`❌ lockfile_note_guard: ${NOTE} is staged but empty. Add a short note explaining why.`);
} catch (e) {
  die(`❌ lockfile_note_guard: failed to read ${NOTE} (${e?.message ?? e})`);
}

console.log(`OK: lockfile_note_guard (${LOCK} staged with ${NOTE})`);