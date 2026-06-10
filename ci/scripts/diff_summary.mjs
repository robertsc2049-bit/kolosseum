import { execSync } from "node:child_process";

function sh(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

function clean(s) {
  return String(s ?? "").trim();
}

const status = clean(sh("git status --short"));
const statWorktree = clean(sh("git diff --stat"));
const statStaged = clean(sh("git diff --cached --stat"));

console.log("== diff summary ==");
console.log(status ? status : "(clean)");
console.log("");

console.log("== diff --stat (staged) ==");
console.log(statStaged ? statStaged : "(no diff)");
console.log("");

console.log("== diff --stat (worktree) ==");
console.log(statWorktree ? statWorktree : "(no diff)");
