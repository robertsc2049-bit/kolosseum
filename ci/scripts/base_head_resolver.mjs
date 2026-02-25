import { execSync } from "node:child_process";

function sh(cmd, opts = {}) {
  const o = {
    stdio: opts.stdio ?? "pipe",
    encoding: "utf8",
    env: { ...process.env, ...(opts.env ?? {}) },
  };
  return execSync(cmd, o).toString().trim();
}

function shTry(cmd) {
  try {
    return sh(cmd, { stdio: "pipe" });
  } catch {
    return "";
  }
}

function shOk(cmd) {
  try {
    sh(cmd, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve BASE/HEAD in a stable way.
 * - If upstream exists: BASE=merge-base(upstream, HEAD)
 * - Else: baseRef=origin/main or main if present; BASE=merge-base(baseRef, HEAD); else BASE=HEAD
 *
 * Returns:
 * { head, base, upstream, baseRef }
 */
export function resolveBaseHead() {
  const head = sh("git rev-parse HEAD", { stdio: "pipe" });

  const upstream = shTry("git rev-parse --abbrev-ref --symbolic-full-name @{u}");
  if (upstream) {
    const base = sh(`git merge-base ${upstream} HEAD`, { stdio: "pipe" });
    return { head, base, upstream, baseRef: "" };
  }

  let baseRef = "";
  if (shOk("git rev-parse --verify origin/main")) baseRef = "origin/main";
  else if (shOk("git rev-parse --verify main")) baseRef = "main";

  let base = head;
  if (baseRef) {
    try {
      base = sh(`git merge-base ${baseRef} HEAD`, { stdio: "pipe" });
    } catch {
      base = head;
    }
  }

  return { head, base, upstream: "", baseRef };
}