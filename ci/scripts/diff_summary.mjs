import { execSync } from "node:child_process";

function sh(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

const status = sh("git status --short").trim();
const stat = sh("git diff --stat").trim();

console.log("== diff summary ==");
console.log(status ? status : "(clean)");
console.log("");
console.log("== diff --stat ==");
console.log(stat ? stat : "(no diff)");