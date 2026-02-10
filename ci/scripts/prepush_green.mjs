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
  console.log("pre-push: running: npm run green (BASE/HEAD computed by green)");

  execSync("npm run green", { stdio: "inherit", env: process.env });

  console.log("pre-push: OK (green passed)");
}

try {
  main();
} catch (e) {
  process.exit(typeof e?.status === "number" ? e.status : 1);
}