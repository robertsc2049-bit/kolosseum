import { execSync } from "node:child_process";

function sh(cmd, inherit = true) {
  execSync(cmd, { stdio: inherit ? "inherit" : ["ignore", "pipe", "ignore"] });
}

function out(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
    .toString("utf8")
    .trim();
}

function tryOut(cmd) {
  try {
    return out(cmd);
  } catch {
    return "";
  }
}

function getCurrentBranch() {
  // Empty on detached HEAD.
  return tryOut("git branch --show-current");
}

function getUpstreamRef() {
  // This is safe from Node (no PowerShell @{upstream} mangling).
  return tryOut("git rev-parse --abbrev-ref --symbolic-full-name @{u}");
}

function getOutgoingCommitCount(upstream) {
  if (!upstream) return null; // unknown (new branch / no upstream)
  const s = tryOut(`git rev-list --count ${upstream}..HEAD`);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function getDiffBaseRef() {
  // Prefer upstream. If missing, fall back to HEAD~1 only if it exists.
  const upstream = getUpstreamRef();
  if (upstream) return { kind: "upstream", ref: upstream };

  // New branch with no upstream: best effort. If HEAD~1 doesn't exist, we can't know.
  const hasHead1 = !!tryOut("git rev-parse --verify HEAD~1");
  if (hasHead1) return { kind: "head1", ref: "HEAD~1" };

  return { kind: "unknown", ref: "" };
}

function listPushedFiles() {
  const upstream = getUpstreamRef();
  const outgoing = getOutgoingCommitCount(upstream);

  // Ticket-029: no-op push should exit 0.
  if (upstream && outgoing === 0) {
    console.log("[pre-push] no-op (0 outgoing commits) -> exit 0");
    process.exit(0);
  }

  const base = getDiffBaseRef();

  if (base.kind === "upstream") {
    return tryOut(`git diff --name-only ${base.ref}..HEAD`)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (base.kind === "head1") {
    return tryOut(`git diff --name-only ${base.ref}..HEAD`)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Unknown diff base (detached / shallow / first commit). Return null to signal uncertainty.
  return null;
}

function classify(files) {
  const DOC_ONLY =
    files.length > 0 && files.every((f) => /\.(md|txt)$/i.test(f));

  const ENGINE_RISK = files.some((f) => {
    // Core engine + contracts + registries + schema + CI enforcement = engine-risk.
    return (
      f.startsWith("engine/") ||
      f.startsWith("registries/") ||
      f.startsWith("ci/") || // IMPORTANT: include guards/scripts/manifests, not just ci/schemas
      f.startsWith("ci/schemas/") ||
      f.includes("ENGINE_CONTRACT") ||
      f === "schema.sql" ||
      f.startsWith("scripts/") // scripts can change guardrails + release plumbing
    );
  });

  const APP_RISK = files.some((f) => {
    // API/server/DB are operational-risk (not engine logic, but still important).
    return (
      f.startsWith("src/") ||
      f.startsWith("db/") ||
      f.startsWith("migrations/") ||
      f.startsWith("api/") ||
      f.includes("server") ||
      f.includes("apply-schema")
    );
  });

  return { DOC_ONLY, ENGINE_RISK, APP_RISK };
}

const files = listPushedFiles();

if (files === null) {
  // We cannot prove what is being pushed. Do not silently skip.
  // Conservative but still fast: guards + unit. (Avoid full CI punishment.)
  console.log("[pre-push] cannot determine pushed files -> dev:fast (conservative)");
  sh("npm run dev:fast");
  process.exit(0);
}

console.log(`[pre-push] pushed files: ${files.length}`);

if (!files.length) {
  // We *could* compute the diff but it is empty. Likely unusual range; stay cheap but not zero.
  console.log("[pre-push] pushed file list empty -> lint:fast");
  sh("npm run lint:fast");
  process.exit(0);
}

const { DOC_ONLY, ENGINE_RISK, APP_RISK } = classify(files);

if (DOC_ONLY) {
  console.log("[pre-push] docs-only -> lint:fast");
  sh("npm run lint:fast");
  process.exit(0);
}

if (ENGINE_RISK) {
  console.log("[pre-push] engine-risk change -> ci");
  sh("npm run ci");
  process.exit(0);
}

if (APP_RISK) {
  console.log("[pre-push] app-risk change -> dev:fast");
  sh("npm run dev:fast");
  process.exit(0);
}

console.log("[pre-push] non-risk change -> lint:fast");
sh("npm run lint:fast");