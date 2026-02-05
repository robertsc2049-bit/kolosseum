import { execSync } from "node:child_process";

function out(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

function main() {
  // Includes untracked. If you want "tracked only", use: git diff --name-only
  const porcelain = out("git status --porcelain").trim();

  if (!porcelain) {
    console.log("OK: clean_tree_guard (WORKING TREE: CLEAN)");
    process.exit(0);
  }

  console.error("❌ clean_tree_guard: WORKING TREE: DIRTY");
  console.error("");
  console.error("Dirty entries (git status --porcelain):");
  console.error(porcelain);
  console.error("");
  console.error("Fix:");
  console.error("  - stage/commit what you intended, OR");
  console.error("  - discard with: git restore -- . && git clean -fd");
  process.exit(1);
}

main();