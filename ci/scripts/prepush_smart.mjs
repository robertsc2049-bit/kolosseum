import fs from "node:fs";
import { execSync } from "node:child_process";
import process from "node:process";

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

function die(msg, code = 1) {
  process.stderr.write(String(msg).trimEnd() + "\n");
  process.exit(code);
}

function isAllZeroSha(s) {
  const x = String(s || "").trim();
  return x.length === 40 && /^0{40}$/.test(x);
}

function readStdinUtf8() {
  // Correct: read fd 0 (the hook stdin) directly.
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parsePushTargetsFromStdin() {
  const text = readStdinUtf8();
  const lines = String(text)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const updates = [];
  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;
    const [localRef, localSha, remoteRef, remoteSha] = parts;
    updates.push({ localRef, localSha, remoteRef, remoteSha });
  }
  return updates;
}

function getUpstreamRef() {
  // Safe from Node (no PowerShell @{u} mangling).
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

function computePushingMain(updates) {
  // Primary truth: stdin updates
  if (updates.length) {
    return updates.some((u) => u.remoteRef === "refs/heads/main");
  }

  // Fallback (stdin missing):
  // Keep heuristic minimal and let the no-op short-circuit avoid false blocks
  // for tag-only pushes when nothing is ahead of upstream.
  const branch = tryOut("git rev-parse --abbrev-ref HEAD");
  const upstream = getUpstreamRef();
  const isMainBranch = branch === "main";
  const isUpstreamMain = upstream.endsWith("/main") || upstream === "origin/main";
  return isMainBranch && isUpstreamMain;
}

function requireMainPushOverrideOrDie(pushingMain) {
  if (!pushingMain) return;

  const allowed = process.env.KOLOSSEUM_ALLOW_PUSH_MAIN === "1";
  if (!allowed) {
    console.error("[pre-push] BLOCKED: direct push to main is disabled.");
    console.error("[pre-push] Use a ticket branch + PR.");
    console.error("[pre-push] Override once (PowerShell):");
    console.error(
      '[pre-push]   $env:KOLOSSEUM_ALLOW_PUSH_MAIN="1"; git push origin main; Remove-Item Env:KOLOSSEUM_ALLOW_PUSH_MAIN'
    );
    process.exit(1);
  }
}

function runPushChangesetGuardOrDie() {
  const script = "scripts/guard-push-changeset.ps1";
  const exists = !!tryOut(`git ls-files --error-unmatch ${script}`);
  if (!exists) die(`[pre-push] missing push changeset guard: ${script}`, 2);

  console.log("[pre-push] push changeset guard");
  sh(`pwsh -NoProfile -ExecutionPolicy Bypass -File ${script}`);
}

function runStandardChecksOrDie() {
  const script = "scripts/standard-checks.ps1";
  const exists = !!tryOut(`git ls-files --error-unmatch ${script}`);
  if (!exists) die(`[pre-push] standard checks missing: ${script}`, 2);

  console.log("[pre-push] standard checks (origin canonical + gh visibility)");
  sh(`pwsh -NoProfile -ExecutionPolicy Bypass -File ${script} -SkipGreenFast`);
}

function tryForkPointBase(localSha) {
  // Best base for "new remote ref" cases (remoteSha=0): find branch point.
  // fork-point can fail if reflog data isn't present; that's fine.
  const sha = String(localSha || "").trim();
  if (!sha) return "";
  const fp = tryOut(`git merge-base --fork-point origin/main ${sha}`);
  if (fp) return fp;
  const mb = tryOut(`git merge-base origin/main ${sha}`);
  if (mb) return mb;
  return "";
}

function listPushedFilesFromUpdates(updates) {
  // Best-effort: aggregate file list across all non-delete ref updates.
  const files = new Set();

  const meaningful = updates.filter(
    (u) => !isAllZeroSha(u.localSha) && u.localRef && u.remoteRef
  );
  if (!meaningful.length) return [];

  for (const u of meaningful) {
    const localSha = String(u.localSha || "").trim();
    const remoteSha = String(u.remoteSha || "").trim();

    // If remoteSha is known (not all zeros), diff exactly remoteSha..localSha.
    if (localSha && remoteSha && !isAllZeroSha(remoteSha)) {
      const names = tryOut(`git diff --name-only ${remoteSha}..${localSha}`)
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const f of names) files.add(f);
      continue;
    }

    // New branch / new remote ref:
    // Prefer fork-point base against origin/main for narrower diffs.
    const base =
      tryForkPointBase(localSha) ||
      (tryOut("git rev-parse --verify HEAD~1") ? "HEAD~1" : "");

    if (!base || !localSha) continue;

    const names = tryOut(`git diff --name-only ${base}..${localSha}`)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const f of names) files.add(f);
  }

  return Array.from(files);
}

function listPushedFilesFallback(upstream) {
  // Fallback when stdin missing: approximate by upstream..HEAD, else HEAD~1..HEAD.
  if (upstream) {
    return tryOut(`git diff --name-only ${upstream}..HEAD`)
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const hasHead1 = !!tryOut("git rev-parse --verify HEAD~1");
  if (hasHead1) {
    return tryOut("git diff --name-only HEAD~1..HEAD")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return null; // truly unknown (first commit / detached / shallow)
}

function classify(files) {
  const isDoc = (f) => f.startsWith("docs/") || /\.(md|txt)$/i.test(f);
  const isWorkflow = (f) => f.startsWith(".github/workflows/");

  const DOC_ONLY = files.length > 0 && files.every(isDoc);
  const WORKFLOW_ONLY = files.length > 0 && files.every(isWorkflow);

  const touchesEngine = (f) =>
    f.startsWith("engine/") ||
    f.startsWith("registries/") ||
    f.startsWith("cli/") ||
    f.includes("ENGINE_CONTRACT") ||
    f === "schema.sql" ||
    f.startsWith("ci/") ||         // guards/scripts/manifests/schemas
    f.startsWith("scripts/") ||    // release plumbing + guardrails
    f.startsWith("tools/") ||      // toolchain affects determinism
    f === "package.json" ||
    f === "package-lock.json" ||
    f === "tsconfig.json" ||
    f === ".npmrc" ||
    f === ".nvmrc";

  const touchesApp = (f) =>
    f.startsWith("src/") ||
    f.startsWith("db/") ||
    f.startsWith("migrations/") ||
    f.startsWith("api/") ||
    f.includes("server") ||
    f.includes("apply-schema");

  // Workflow-only is control-plane; handled separately.
  const ENGINE_RISK = !WORKFLOW_ONLY && files.some(touchesEngine);
  const APP_RISK = !ENGINE_RISK && !WORKFLOW_ONLY && files.some(touchesApp);

  return { DOC_ONLY, WORKFLOW_ONLY, ENGINE_RISK, APP_RISK };
}

/**
 * Single owner flow:
 * 1) If no outgoing commits (upstream known) AND stdin missing -> exit 0 (avoid false blocks for tag-only pushes).
 * 2) Block main unless override.
 * 3) For real pushes: push changeset guard -> standard checks.
 * 4) Route by diff surface (prefer real stdin ranges).
 *
 * Testing escape hatch:
 *   $env:KOLOSSEUM_PREPUSH_FORCE="1"  # bypass no-op early exit to test routing locally
 */
const updates = parsePushTargetsFromStdin();
const upstream = getUpstreamRef();
const outgoing = getOutgoingCommitCount(upstream);

const stdinMissing = updates.length === 0;
const force = process.env.KOLOSSEUM_PREPUSH_FORCE === "1";

// If stdin is missing and this is a no-op w.r.t upstream, exit early.
// This prevents false "main push" blocks on tag-only pushes in broken stdin environments.
if (!force && stdinMissing && upstream && outgoing === 0) {
  console.log("[pre-push] no-op (0 outgoing commits; stdin missing) -> exit 0");
  process.exit(0);
}

const pushingMain = computePushingMain(updates);

// Main protection after early no-op short-circuit.
requireMainPushOverrideOrDie(pushingMain);

// General no-op exit (normal case): upstream known and no outgoing commits.
// Keep it, but allow force for local simulation.
if (!force && upstream && outgoing === 0) {
  console.log("[pre-push] no-op (0 outgoing commits) -> exit 0");
  process.exit(0);
}

// Unknown outgoing (no upstream) => treat as real push and proceed.
runPushChangesetGuardOrDie();
runStandardChecksOrDie();

// If this is a main push AND override is present, force green:ci and exit.
// (We intentionally run standard checks first.)
if (pushingMain && process.env.KOLOSSEUM_ALLOW_PUSH_MAIN === "1") {
  console.log("[pre-push] main push override detected -> forcing green:ci");
  sh("npm run green:ci");
  process.exit(0);
}

// Prefer exact push ranges from stdin when available.
let files = null;

if (updates.length) {
  files = listPushedFilesFromUpdates(updates);
} else {
  files = listPushedFilesFallback(upstream);
}

if (files === null) {
  console.log("[pre-push] cannot determine pushed files -> dev:fast (conservative)");
  sh("npm run dev:fast");
  process.exit(0);
}

console.log(`[pre-push] pushed files: ${files.length}`);

if (!files.length) {
  console.log("[pre-push] pushed file list empty -> lint:fast");
  sh("npm run lint:fast");
  process.exit(0);
}

const { DOC_ONLY, WORKFLOW_ONLY, ENGINE_RISK, APP_RISK } = classify(files);

if (DOC_ONLY) {
  console.log("[pre-push] docs-only -> lint:fast");
  sh("npm run lint:fast");
  process.exit(0);
}

if (WORKFLOW_ONLY) {
  console.log("[pre-push] workflow-only (.github/workflows/**) -> green:fast");
  sh("npm run green:fast");
  process.exit(0);
}

if (ENGINE_RISK) {
  console.log("[pre-push] engine-risk change -> green:ci");
  sh("npm run green:ci");
  process.exit(0);
}

if (APP_RISK) {
  console.log("[pre-push] app-risk change -> dev:fast");
  sh("npm run dev:fast");
  process.exit(0);
}

console.log("[pre-push] non-risk change -> lint:fast");
sh("npm run lint:fast");
