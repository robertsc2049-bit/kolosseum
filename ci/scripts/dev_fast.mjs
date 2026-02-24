import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { spawnSync, execSync } from "node:child_process";

function die(msg, code = 1) {
  process.stderr.write(String(msg).trimEnd() + "\n");
  process.exit(code);
}

function ok(msg) {
  process.stdout.write(String(msg).trimEnd() + "\n");
}

function headline(msg) {
  process.stdout.write("\n== DEV:FAST STEP: " + String(msg).trim() + " ==\n\n");
}

function safeRmRf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function sh(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }).trim();
  } catch (e) {
    const stderr = (e && typeof e.stderr === "string") ? e.stderr : "";
    const msg = stderr ? `${cmd}\n${stderr}` : `${cmd}`;
    die(`DEV_FAST_FAIL: git command failed:\n${msg}`, 2);
  }
}

function mkNonceHandshake() {
  const nonce = crypto.randomBytes(16).toString("hex");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-devfast-"));
  const file = path.join(dir, "nonce.txt");
  fs.writeFileSync(file, nonce + "\n", { encoding: "utf8" });
  return { nonce, dir, file };
}

function findNpmCli(env) {
  const cands = [];

  if (env.npm_execpath && typeof env.npm_execpath === "string") cands.push(env.npm_execpath);
  if (env.NPM_CLI_JS && typeof env.NPM_CLI_JS === "string") cands.push(env.NPM_CLI_JS);

  // Common install: <nodeDir>/node_modules/npm/bin/npm-cli.js
  try {
    const nodeDir = path.dirname(process.execPath);
    cands.push(path.join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js"));
  } catch {
    // ignore
  }

  for (const p of cands) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Run npm deterministically without relying on PATH or .cmd resolution.
 * Uses node + npm-cli.js for stable Windows behavior.
 */
function runNpm(script, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };

  const node = process.execPath;
  if (!node || typeof node !== "string") {
    return { code: 1, detail: "process.execPath missing" };
  }

  const npmCli = findNpmCli(env);
  if (!npmCli) {
    return {
      code: 1,
      detail:
        "npm cli not found (npm_execpath/NPM_CLI_JS missing and no npm-cli.js near node). Run via `npm run dev:fast` or fix env.",
    };
  }

  const nodeExec = (node === "node" || node === "node.exe") ? process.execPath : node;

  const r = spawnSync(nodeExec, [npmCli, "run", script], {
    encoding: "utf8",
    stdio: "inherit",
    shell: false,
    windowsHide: true,
    env,
  });

  if (r.error) {
    return { code: 1, detail: `spawn error: ${r.error.name}: ${r.error.message}` };
  }
  if (r.signal) {
    return { code: 1, detail: `terminated by signal: ${r.signal}` };
  }

  const code = r.status ?? 1;
  return { code, detail: code === 0 ? "" : `exit code ${code}` };
}

function computeBaseHeadEnv() {
  // Always from repo root.
  const repo = sh("git rev-parse --show-toplevel");
  process.chdir(repo);

  // Fail closed (match green_fast). Local dev should still have an upstream.
  let upstream = "";
  try {
    upstream = sh("git rev-parse --abbrev-ref --symbolic-full-name @{u}");
  } catch {
    upstream = "";
  }
  if (!upstream) {
    die("DEV_FAST_FAIL: no upstream set (expected @{u}). Fix: git push -u origin HEAD", 2);
  }

  const head = sh("git rev-parse HEAD");
  const base = sh(`git merge-base ${head} ${upstream}`);

  return {
    upstream,
    BASE_SHA: base,
    HEAD_SHA: head,
  };
}

function isStrict() {
  // Default: allow staged-only changes so you can stage -> dev:fast -> commit.
  // Opt-in strict: KOLOSSEUM_DEV_FAST_STRICT=1 forbids staged too.
  return process.env.KOLOSSEUM_DEV_FAST_STRICT === "1";
}

// dev:fast exists to be a stable local entrypoint that still provides BASE/HEAD
// so BASE/HEAD-aware guards (diff_line_endings_guard, etc.) never skip locally.
//
// Policy:
// - Always FORCE clean_tree_guard to enforce (no green nonce skip), so it fails on:
//   - untracked
//   - unstaged drift
// - Default allows staged-only (so you can run checks before commit).
// - Optional strict mode forbids staged too.
const { nonce, dir, file } = mkNonceHandshake();

try {
  headline("nonce handshake (mint)");
  ok("OK: dev:fast nonce minted");

  headline("compute BASE/HEAD from upstream");
  const { upstream, BASE_SHA, HEAD_SHA } = computeBaseHeadEnv();
  ok(`dev:fast upstream=${upstream}`);
  ok(`dev:fast BASE_SHA=${BASE_SHA}`);
  ok(`dev:fast HEAD_SHA=${HEAD_SHA}`);

  const strict = isStrict();

  const env = {
    // Treat as a green-style authoritative entrypoint so green_entrypoint_guard passes.
    KOLOSSEUM_GREEN: "1",
    KOLOSSEUM_GREEN_NONCE: nonce,
    KOLOSSEUM_GREEN_NONCE_FILE: file,
    KOLOSSEUM_GREEN_ENTRYPOINT: "1",

    // Enforce clean-tree even under green nonce (no "skip").
    KOLOSSEUM_CLEAN_TREE_ENFORCE: "1",

    // Optional strict clean-tree (forbid staged too).
    ...(strict ? { KOLOSSEUM_CLEAN_TREE_STRICT: "1" } : {}),

    // Enables BASE/HEAD-aware guards locally.
    BASE_SHA,
    HEAD_SHA,
  };

  ok(`dev:fast clean_tree: enforce=1 strict=${strict ? "1" : "0"}`);

  const steps = ["lint:fast", "test:unit"];

  for (const s of steps) {
    headline(`npm run ${s}`);
    const r = runNpm(s, env);
    if (r.code !== 0) {
      die(`DEV_FAST_FAIL: npm run ${s} failed (${r.detail})`, r.code);
    }
  }

  ok("\nDEV_FAST_OK: all steps passed; repo state unchanged from baseline.");
} finally {
  safeRmRf(dir);
}
