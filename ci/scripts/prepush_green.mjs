import { execSync } from "node:child_process";

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", ...opts }).trim();
}

function hasUpstream() {
  try {
    const u = sh("git rev-parse --abbrev-ref --symbolic-full-name @{u}");
    return u.length > 0 ? u : "";
  } catch {
    return "";
  }
}

function main() {
  // Always from repo root.
  const repo = sh("git rev-parse --show-toplevel");
  process.chdir(repo);

  const upstream = hasUpstream();
  if (!upstream) {
    console.error("pre-push: FAIL. No upstream set for this branch.");
    console.error("Fix: git push -u origin HEAD");
    process.exit(2);
  }

  console.log(`pre-push: upstream=${upstream}`);
  console.log("pre-push: running: npm run green:fast (BASE/HEAD computed by fast runner)");

  execSync("npm run green:fast", { stdio: "inherit", env: process.env });

  console.log("pre-push: OK (green:fast passed)");
}

try {
  main();
} catch (e) {
  process.exit(typeof e?.status === "number" ? e.status : 1);
}