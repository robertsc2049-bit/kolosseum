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

function readStdinUtf8() {
  // pre-push provides lines:
  // <local ref> <local sha1> <remote ref> <remote sha1>
  // When run manually or via some wrappers, stdin may be empty.
  try {
    return execSync(
      "node -e \"process.stdin.setEncoding('utf8'); let d=''; process.stdin.on('data', c => d+=c); process.stdin.on('end', ()=>process.stdout.write(d));\"",
      { stdio: ["pipe", "pipe", "ignore"] }
    ).toString("utf8");
  } catch {
    try {
      return execSync(
        "node -e \"process.stdin.setEncoding('utf8'); let d=''; process.stdin.on('data', c => d+=c); process.stdin.on('end', ()=>process.stdout.write(d));\"",
        { input: "", stdio: ["pipe", "pipe", "ignore"] }
      ).toString("utf8");
    } catch {
      return "";
    }
  }
}

function parsePushTargetsFromStdin() {
  let text = "";
  try {
    text = readStdinUtf8();
  } catch {
    text = "";
  }

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

function isPushingMain() {
  const updates = parsePushTargetsFromStdin();

  // If we can't tell (no stdin), fall back to intent signals:
  // only block if branch is main and upstream is main.
  if (!updates.length) {
    const branch = tryOut("git rev-parse --abbrev-ref HEAD");
    const upstream = tryOut("git rev-parse --abbrev-ref --symbolic-full-name @{u}");
    const isMainBranch = branch === "main";
    const isUpstreamMain = upstream.endsWith("/main") || upstream === "origin/main";
    return isMainBranch && isUpstreamMain;
  }

  // If any update targets refs/heads/main, it's a main push.
  return updates.some((u) => u.remoteRef === "refs/heads/main");
}

function requireMainPushOverrideOrDie() {
  if (!isPushingMain()) return;

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

function runStandardChecksOrDie() {
  const script = "scripts/standard-checks.ps1";
  const exists = !!tryOut(`git ls-files --error-unmatch ${script}`);
  if (!exists) {
    // Fall back to disk check: repo may have the file untracked (should not happen, but be explicit).
    const disk = tryOut(`node -e "const fs=require('fs'); process.exit(fs.existsSync('${script.replace(/\\/g, "/")}')?0:1)"`);
    if (disk) {
      // disk check returned output; not reliable. Prefer explicit failure message below.
    }
    die(`[pre-push] standard checks missing: ${script}`, 2);
  }

  console.log("[pre-push] standard checks (origin canonical + gh visibility)");
  sh(`pwsh -NoProfile -ExecutionPolicy Bypass -File ${script} -SkipGreenFast`);
}

function getDiffBaseRef(upstream) {
  // Prefer upstream. If missing, fall back to HEAD~1 only if it exists.
  if (upstream) return { kind: "upstream", ref: upstream };

  // New branch with no upstream: best effort. If HEAD~1 doesn't exist, we can't know.
  const hasHead1 = !!tryOut("git rev-parse --verify HEAD~1");
  if (hasHead1) return { kind: "head1", ref: "HEAD~1" };

  return { kind: "unknown", ref: "" };
}

function listPushedFiles(upstream) {
  const base = getDiffBaseRef(upstream);

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
  const isDoc = (f) => f.startsWith("docs/") || /\.(md|txt)$/i.test(f);

  const DOC_ONLY = files.length > 0 && files.every(isDoc);

  const touchesEngine = (f) =>
    f.startsWith("engine/") ||
    f.startsWith("registries/") ||
    f.startsWith("cli/") ||
    f.includes("ENGINE_CONTRACT") ||
    f === "schema.sql" ||
    f.startsWith("ci/") ||                // guards/scripts/manifests/schemas
    f.startsWith("scripts/") ||           // release plumbing + guardrails
    f.startsWith("tools/") ||             // toolchain affects determinism
    f.startsWith(".github/workflows/") || // CI is part of the contract
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

  // If it touches engine-risk contract surface, treat as engine-risk.
  const ENGINE_RISK = files.some(touchesEngine);
  const APP_RISK = !ENGINE_RISK && files.some(touchesApp);

  return { DOC_ONLY, ENGINE_RISK, APP_RISK };
}

/**
 * 0) Hard gate: pushing main requires explicit override.
 *    If override present, we force green:ci after standard checks.
 */
requireMainPushOverrideOrDie();

const upstream = getUpstreamRef();
const outgoing = getOutgoingCommitCount(upstream);

// No-op push should exit 0 without doing anything expensive.
if (upstream && outgoing === 0) {
  console.log("[pre-push] no-op (0 outgoing commits) -> exit 0");
  process.exit(0);
}

// Always run cheap standard checks for real pushes (or unknown outgoing).
runStandardChecksOrDie();

// If this is a main push AND override is present, force green:ci and exit.
// (We intentionally run standard checks first.)
if (isPushingMain() && process.env.KOLOSSEUM_ALLOW_PUSH_MAIN === "1") {
  console.log("[pre-push] main push override detected -> forcing green:ci");
  sh("npm run green:ci");
  process.exit(0);
}

const files = listPushedFiles(upstream);

if (files === null) {
  // We cannot prove what is being pushed. Do not silently skip.
  // Conservative but still fast-ish: dev:fast (guards + unit) not full CI punishment.
  console.log("[pre-push] cannot determine pushed files -> dev:fast (conservative)");
  sh("npm run dev:fast");
  process.exit(0);
}

console.log(`[pre-push] pushed files: ${files.length}`);

if (!files.length) {
  // Diff computed but empty: stay cheap but not zero.
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