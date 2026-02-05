import { execSync } from "node:child_process";

function out(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

/**
 * "Clean working tree" for our purposes means:
 * - No unstaged changes (worktree column)
 * - No untracked files
 *
 * Staged changes are allowed (otherwise commits are impossible).
 */
function main() {
  const lines = out("git status --porcelain=v1 --untracked-files=normal")
    .split(/\r?\n/)
    .map((s) => s.trimEnd())
    .filter(Boolean);

  const dirty = [];

  for (const line of lines) {
    // Untracked
    if (line.startsWith("?? ")) {
      dirty.push(line);
      continue;
    }

    // Porcelain v1 is "XY <path>" (or similar). X=index, Y=worktree.
    // We only care about worktree modifications.
    const y = line.length >= 2 ? line[1] : " ";
    if (y !== " ") dirty.push(line);
  }

  if (dirty.length === 0) {
    console.log("OK: clean_tree_guard (WORKING TREE: CLEAN)");
    process.exit(0);
  }

  console.error("❌ clean_tree_guard: WORKING TREE: DIRTY (unstaged or untracked)");
  console.error("");
  console.error("Dirty entries:");
  console.error(dirty.join("\n"));
  console.error("");
  console.error("Fix:");
  console.error("  - stage/commit what you intended, OR");
  console.error("  - discard with: git restore -- . && git clean -fd");
  process.exit(1);
}

main();