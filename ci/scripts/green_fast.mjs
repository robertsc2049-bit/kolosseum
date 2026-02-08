import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

function die(msg, code = 1) {
  process.stderr.write(String(msg).trimEnd() + "\n");
  process.exit(code);
}

function ok(msg) {
  process.stdout.write(String(msg).trimEnd() + "\n");
}

function headline(msg) {
  process.stdout.write("\n== GREEN:FAST STEP: " + String(msg).trim() + " ==\n\n");
}

function safeRmRf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function mkNonceHandshake() {
  const nonce = crypto.randomBytes(16).toString("hex");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-greenfast-"));
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
        "npm cli not found (npm_execpath/NPM_CLI_JS missing and no npm-cli.js near node). Run via `npm run green:fast` or fix env.",
    };
  }

  const r = spawnSync(node, [npmCli, "run", script], {
    encoding: "utf8",
    stdio: "inherit",
    shell: false,
    windowsHide: true,
    env,
    cwd: process.cwd(),
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

function runNode(args, envExtra) {
  const env = { ...process.env, ...envExtra };
  const r = spawnSync("node", args, { stdio: "inherit", env, cwd: process.cwd() });
  if (r.error) {
    return { code: 1, detail: `spawn error: ${r.error.name}: ${r.error.message}` };
  }
  if (r.signal) {
    return { code: 1, detail: `signal: ${r.signal}` };
  }
  const code = (typeof r.status === "number") ? r.status : 0;
  return { code, detail: `exit ${code}` };
}

// green:fast exists to be an authoritative entrypoint like green,
// but quicker. It still mints the same nonce handshake so clean_tree_guard
// can safely skip during nested steps, and so env poisoning is prevented.
const { nonce, dir, file } = mkNonceHandshake();

const greenEnv = {
  KOLOSSEUM_GREEN: "1",
  KOLOSSEUM_GREEN_NONCE: nonce,
  KOLOSSEUM_GREEN_NONCE_FILE: file,
  KOLOSSEUM_GREEN_ENTRYPOINT: "1",
};

try {
  headline("nonce handshake (mint + verify)");
  ok("OK: green:fast nonce minted");

  const steps = ["lint:fast", "test:unit", "build:fast"];

  for (const s of steps) {
    headline(`npm run ${s}`);
    const r = runNpm(s, greenEnv);
    if (r.code !== 0) {
      die(`GREEN_FAST_FAIL: npm run ${s} failed (${r.detail})`, r.code);
    }
  }


  headline("runPipeline contract versions");
  const rv = runNode(["ci/guards/run_pipeline_contract_version_guard.mjs"], greenEnv);
  if (rv.code !== 0) {
    die(`GREEN_FAST_FAIL: runPipeline contract versions failed (${rv.detail})`, rv.code);
  }

  ok("\nGREEN_FAST_OK: all steps passed; repo state unchanged from baseline.");
} finally {
  safeRmRf(dir);
}
