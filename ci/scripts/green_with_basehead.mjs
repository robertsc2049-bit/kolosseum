import { execSync } from "node:child_process";

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", ...opts }).trim();
}

function trySh(cmd) {
  try { return sh(cmd); } catch { return ""; }
}

function hasRef(ref) {
  try { sh(`git rev-parse --verify ${ref}`); return true; } catch { return false; }
}

function resolveUpstreamOrFallback() {
  // 1) real upstream, if set
  const up = trySh("git rev-parse --abbrev-ref --symbolic-full-name @{u}");
  if (up) return up;

  // 2) CI / detached / no upstream: fall back to origin/main if it exists
  if (hasRef("origin/main")) return "origin/main";

  // 3) last resort: main if it exists locally
  if (hasRef("main")) return "main";

  return "";
}

function main() {
  // Always from repo root.
  const repo = sh("git rev-parse --show-toplevel");
  process.chdir(repo);

  const head = sh("git rev-parse HEAD");
  const upstream = resolveUpstreamOrFallback();

  if (!upstream) {
    console.error("green: FAIL. No upstream set and no fallback ref found (origin/main or main).");
    console.error("Fix: set upstream: git push -u origin HEAD");
    process.exit(2);
  }

  // merge-base of HEAD vs upstream ref
  const base = sh(`git merge-base ${head} ${upstream}`);

  process.env.HEAD_SHA = head;
  process.env.BASE_SHA = base;

  console.log(`green: upstream=${upstream}`);
  console.log(`green: BASE_SHA=${base}`);
  console.log(`green: HEAD_SHA=${head}`);

  // Run the existing green script with env inherited.
  execSync("node ci/scripts/green.mjs", { stdio: "inherit", env: process.env });

  console.log("green: OK (with BASE/HEAD set)");
}

try {
  main();
} catch (e) {
  process.exit(typeof e?.status === "number" ? e.status : 1);
}