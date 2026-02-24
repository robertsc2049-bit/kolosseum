import { spawnSync, execSync } from "node:child_process";
import fs from "node:fs";

function die(msg) {
  process.stderr.write(String(msg).trimEnd() + "\n");
  process.exit(1);
}

function gitStatusPorcelain() {
  return execSync("git status --porcelain=v1 --untracked-files=normal", { encoding: "utf8" }).trimEnd();
}

function hasUntrackedOrUnstaged(porcelain) {
  const lines = porcelain.split(/\r?\n/).filter(Boolean);
  for (const l of lines) {
    if (l.startsWith("??")) return true; // untracked
    const x = l.length >= 1 ? l[0] : " ";
    const y = l.length >= 2 ? l[1] : " ";
    // unstaged drift => Y column not space
    if (y !== " ") return true;
    // staged-only (X != ' ' and Y == ' ') is allowed
    void x;
  }
  return false;
}

function runNode(file) {
  return spawnSync(process.execPath, [file], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
}

// Precondition: allow staged-only changes (so you can stage -> dev:fast -> commit),
// but forbid untracked or unstaged drift before we start (otherwise test is nondeterministic).
const before = gitStatusPorcelain();
if (hasUntrackedOrUnstaged(before)) {
  die(
    "dev_fast_negative_test: requires no untracked/unstaged changes before running.\n" +
      "Staged-only is allowed, but you must stash/clean anything else."
  );
}

// Target a stable tracked file
const target = "README.md";
if (!fs.existsSync(target)) {
  die("dev_fast_negative_test: README.md not found");
}

// Create an UNSTAGED drift (append without staging)
fs.appendFileSync(target, "\n# DEV_FAST_NEGATIVE_TEST_TEMP\n", { encoding: "utf8" });

try {
  const r = runNode("ci/scripts/dev_fast.mjs");

  if (r.status === 0) {
    die("dev_fast_negative_test: expected non-zero exit when tree has unstaged drift");
  }

  const combined = (r.stdout || "") + (r.stderr || "");

  if (!combined.includes("clean_tree_guard: WORKING TREE: DIRTY")) {
    die(
      "dev_fast_negative_test: missing expected clean_tree_guard DIRTY message.\n" +
        "---- output ----\n" +
        combined
    );
  }

  process.stdout.write("PASS dev_fast_clean_tree_negative\n");
} finally {
  // Revert drift deterministically (worktree only)
  execSync(`git restore --worktree -- "${target}"`, { stdio: "ignore" });
}