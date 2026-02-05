import { execSync } from "node:child_process";

function out(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

function hasRef(ref) {
  try {
    execSync(`git rev-parse --verify ${ref}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function list(cmd) {
  return out(cmd)
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

function changedFilesStaged() {
  return list("git diff --name-only --cached");
}

function changedFilesCommitted() {
  // Prefer PR-style range if origin/main exists, else just what changed in HEAD.
  if (hasRef("refs/remotes/origin/main")) {
    const base = out("git merge-base HEAD origin/main").trim();
    if (base) return list(`git diff --name-only ${base}..HEAD`);
  }
  return list("git diff-tree --no-commit-id --name-only -r HEAD");
}

function main() {
  const staged = changedFilesStaged();
  const scope = staged.length > 0 ? "staged" : "committed";
  const files = staged.length > 0 ? staged : changedFilesCommitted();

  const lockfile = "package-lock.json";
  const note = "LOCKFILE_CHANGE_NOTE.md";

  const lockTouched = files.includes(lockfile);
  const noteTouched = files.includes(note);

  if (!lockTouched) {
    console.log(`OK: lockfile_note_guard (lockfile not ${scope})`);
    process.exit(0);
  }

  if (noteTouched) {
    console.log(`OK: lockfile_note_guard (${scope}: lockfile + note present)`);
    process.exit(0);
  }

  // Fail with exact fix commands (canonical helper).
  console.error(`❌ lockfile_note_guard: ${lockfile} changed in ${scope} scope but ${note} was not updated.`);
  console.error("");
  console.error("Fix (recommended): add an LF-only note via the canonical helper, then re-run your commit/CI:");
  console.error("");
  console.error("PowerShell:");
  console.error('  $env:KOLOSSEUM_LOCKFILE_NOTE = "Explain why package-lock.json changed"; node scripts/lockfile_note.mjs --quiet; Remove-Item Env:KOLOSSEUM_LOCKFILE_NOTE');
  console.error("");
  console.error("POSIX shell:");
  console.error('  KOLOSSEUM_LOCKFILE_NOTE="Explain why package-lock.json changed" node scripts/lockfile_note.mjs --quiet');
  console.error("");
  console.error("Then ensure the note is included in the commit (amend if needed):");
  console.error('  git add -- "LOCKFILE_CHANGE_NOTE.md"');
  console.error('  git commit --amend --no-edit');
  process.exit(1);
}

main();