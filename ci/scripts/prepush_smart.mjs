import { execSync } from "node:child_process";

function sh(cmd, inherit = true) {
  execSync(cmd, { stdio: inherit ? "inherit" : ["ignore", "pipe", "ignore"] });
}

function out(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8");
}

function getUpstreamRef() {
  try {
    return out("git rev-parse --abbrev-ref --symbolic-full-name @{u}").trim();
  } catch {
    return "";
  }
}

function getOutgoingCommitCount(upstream) {
  if (!upstream) return null; // unknown (new branch / no upstream)
  try {
    const s = out(`git rev-list --count ${upstream}..HEAD`).trim();
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  } catch {
    return null;
  }
}

function listPushedFiles() {
  const upstream = getUpstreamRef();
  const outgoing = getOutgoingCommitCount(upstream);

  // Ticket-029: no-op push should exit 0 (no full path).
  if (upstream && outgoing === 0) {
    console.log("[pre-push] no-op (0 outgoing commits) -> exit 0");
    process.exit(0);
  }

  // Compare local HEAD range vs upstream.
  // If upstream is missing (new branch), fall back to HEAD~1.
  if (upstream) {
    const files = out(`git diff --name-only ${upstream}..HEAD`)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    return files;
  }

  // No upstream: best effort (likely new branch). If HEAD~1 fails (shallow), fall back to empty list.
  try {
    const files = out("git diff --name-only HEAD~1..HEAD")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    return files;
  } catch {
    return [];
  }
}

const files = listPushedFiles();

const DOC_ONLY = files.length > 0 && files.every((f) => /\.(md|txt)$/i.test(f));
const ENGINE_TOUCH = files.some((f) =>
  f.startsWith("engine/") ||
  f.startsWith("cli/") ||
  f.includes("ENGINE_CONTRACT") ||
  f.includes("schema") ||
  f.startsWith("ci/schemas/") ||
  f.startsWith("registries/")
);

console.log(`[pre-push] pushed files: ${files.length}`);

if (!files.length) {
  // Ticket-029: if we can't detect pushed files, do NOT punish with full lint.
  console.log("[pre-push] no pushed files detected -> exit 0");
  process.exit(0);
}

if (DOC_ONLY) {
  console.log("[pre-push] docs-only -> lint:fast");
  sh("npm run lint:fast");
  process.exit(0);
}

if (!ENGINE_TOUCH) {
  console.log("[pre-push] non-engine change -> dev:fast");
  sh("npm run dev:fast");
  process.exit(0);
}

console.log("[pre-push] engine-affecting change -> full lint");
sh("npm run lint");