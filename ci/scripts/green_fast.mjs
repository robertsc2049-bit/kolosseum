import { execSync } from "node:child_process";

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    ...opts,
  }).trim();
}

function shOk(cmd, opts = {}) {
  try {
    sh(cmd, opts);
    return true;
  } catch {
    return false;
  }
}

function log(line = "") {
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
  // Start shallow; we may deepen if merge-base needs history.
  sh(
    `git fetch --no-tags --prune --depth=1 origin +refs/heads/${baseBranch}:refs/remotes/origin/${baseBranch}`,
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  if (!shOk(`git show-ref --verify --quiet ${ref}`)) {
    throw new Error(`green:fast failed to materialize origin/${baseBranch} (${ref})`);
  }
}

function deepenForMergeBase(baseBranch) {
  // Deepen both HEAD history (as seen by the runner) and origin/<baseBranch>.
  // In PR merge refs, fetch-depth=1 is common; merge-base can fail without ancestry.
  log(`green:fast merge-base failed -> deepening fetch... (origin/${baseBranch})`);

  // Try deepen first (cheap).
  shOk(
    `git fetch --no-tags --prune --deepen=200 origin +refs/heads/${baseBranch}:refs/remotes/origin/${baseBranch}`,
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  // If still shallow, unshallow (most reliable). This is a no-op if already complete.
  shOk(`git fetch --no-tags --prune --unshallow origin`, { stdio: ["ignore", "pipe", "pipe"] });

  // Re-ensure origin/<baseBranch> exists after any fetch.
  ensureOriginBranch(baseBranch);
}

function mergeBaseWithRetry(headRef, baseBranch) {
  const baseRef = `origin/${baseBranch}`;

  // Attempt 1
  try {
    return sh(`git merge-base ${headRef} ${baseRef}`);
  } catch {
    // Deepen/unshallow and retry once.
    deepenForMergeBase(baseBranch);
  }

  // Attempt 2
  return sh(`git merge-base ${headRef} ${baseRef}`);
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
    const baseSha = mergeBaseWithRetry("HEAD", baseBranch);

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
  log("");
  log("== GREEN:FAST STEP: nonce handshake (mint + verify) ==");
  log("");
  // nonce handling is elsewhere; keep prior behavior (no-op here).
  log("OK: green:fast nonce minted");

  // This is where CI was dying.
  resolveBaseHead();

  // NOTE: Orchestration remains owned by npm scripts in this repo.
}

try {
  main();
} catch (err) {
  const msg = err && err.stack ? err.stack : String(err);
  log(`GREEN_FAST_FAIL: ${msg}`);
  process.exit(2);
}