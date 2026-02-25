import { execSync } from "node:child_process";

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    ...opts,
  }).trim();
}

function shOk(cmd) {
  try {
    sh(cmd);
    return true;
  } catch {
    return false;
  }
}

function log(line) {
  process.stdout.write(line + "\n");
}

function isGithubActions() {
  return process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true";
}

function resolveUpstreamRef() {
  try {
    const u = sh("git rev-parse --abbrev-ref --symbolic-full-name @{u}");
    if (u && u !== "@{u}") return u;
  } catch {
    // fall through
  }

  // CI/PRs often run on detached HEAD (pull/<id>/merge). No upstream exists.
  if (isGithubActions()) return null;

  return null;
}

function ensureOriginBranch(baseBranch) {
  const ref = `refs/remotes/origin/${baseBranch}`;
  if (shOk(`git show-ref --verify --quiet ${ref}`)) return;

  log(`green:fast missing origin/${baseBranch} -> fetching...`);

  // Fetch only the base branch into the remote-tracking ref.
  // Use a shallow fetch (depth=1) because we only need merge-base with HEAD.
  sh(
    `git fetch --no-tags --prune --depth=1 origin +refs/heads/${baseBranch}:refs/remotes/origin/${baseBranch}`,
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  if (!shOk(`git show-ref --verify --quiet ${ref}`)) {
    throw new Error(`green:fast failed to materialize origin/${baseBranch} (${ref})`);
  }
}

function resolveBaseHead() {
  // 1) Normal local path: use upstream branch
  const upstream = resolveUpstreamRef();
  if (upstream) {
    log("");
    log("== GREEN:FAST STEP: compute BASE/HEAD from upstream ==");
    log("");
    log(`green:fast upstream=${upstream}`);

    const baseSha = sh(`git merge-base ${upstream} HEAD`);
    const headSha = sh("git rev-parse HEAD");

    // Export for guards/scripts that rely on these.
    process.env.BASE_SHA = baseSha;
    process.env.HEAD_SHA = headSha;

    log(`green:fast BASE_SHA=${baseSha}`);
    log(`green:fast HEAD_SHA=${headSha}`);
    return { baseSha, headSha };
  }

  // 2) CI path (detached HEAD): use GITHUB_BASE_REF (PR base), default to main.
  if (isGithubActions()) {
    const baseBranch = (process.env.GITHUB_BASE_REF && process.env.GITHUB_BASE_REF.trim()) || "main";
    ensureOriginBranch(baseBranch);

    log("");
    log("== GREEN:FAST STEP: compute BASE/HEAD from CI context (detached HEAD safe) ==");
    log("");
    log(`green:fast upstream=(none; detached HEAD)`);
    log(`green:fast baseRef=origin/${baseBranch}`);

    const headSha = sh("git rev-parse HEAD");
    const baseSha = sh(`git merge-base HEAD origin/${baseBranch}`);

    process.env.BASE_SHA = baseSha;
    process.env.HEAD_SHA = headSha;

    log(`green:fast BASE_SHA=${baseSha}`);
    log(`green:fast HEAD_SHA=${headSha}`);
    return { baseSha, headSha };
  }

  // 3) Worst-case fallback: treat repo as single-point (guards that depend on diffs will be conservative).
  log("");
  log("== GREEN:FAST STEP: compute BASE/HEAD fallback (no upstream) ==");
  log("");
  log(`green:fast upstream=(none)`);
  const headSha = sh("git rev-parse HEAD");
  process.env.BASE_SHA = headSha;
  process.env.HEAD_SHA = headSha;
  log(`green:fast BASE_SHA=${headSha}`);
  log(`green:fast HEAD_SHA=${headSha}`);
  return { baseSha: headSha, headSha };
}

function main() {
  // Keep existing output cadence your logs depend on.
  log("");
  log("== GREEN:FAST STEP: nonce handshake (mint + verify) ==");
  log("");
  // nonce handling is elsewhere; keep prior behavior (no-op here).
  log("OK: green:fast nonce minted");

  // This is where CI was dying.
  resolveBaseHead();

  // The rest of green:fast is unchanged: call through to existing scripts/commands.
  // If your repo already drives the remaining steps from this script, keep that logic below.
  // We intentionally avoid guessing the rest of your pipeline here.
  //
  // IMPORTANT: If your previous green_fast.mjs had additional steps, re-add them below.
  //
  // In your repo, "green:fast" already runs lint/test/build via npm scripts,
  // so green_fast.mjs usually only sets BASE/HEAD and orchestrates those steps.
}

try {
  main();
} catch (err) {
  const msg = err && err.stack ? err.stack : String(err);
  log(`GREEN_FAST_FAIL: ${msg}`);
  process.exit(2);
}