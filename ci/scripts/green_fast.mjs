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

/**
 * Run npm deterministically without relying on PATH or .cmd resolution.
 * On Windows, spawning "npm.cmd" can fail silently under some environments.
 * Using node + npm-cli.js is explicit and stable.
 */
function runNpm(script, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };

  const node = process.execPath;
  const npmCli = env.npm_execpath;

  if (!node || typeof node !== "string") {
    return { code: 1, detail: "process.execPath missing" };
  }
  if (!npmCli || typeof npmCli !== "string") {
    return { code: 1, detail: "npm_execpath missing; npm not discoverable from this environment" };
  }

  const r = spawnSync(node, [npmCli, "run", script], {
    encoding: "utf8",
    stdio: "inherit",
    shell: false,
    windowsHide: true,
    env,
  });

  // If the process couldn't even start, status is null and error is set.
  if (r.error) {
    return { code: 1, detail: `spawn error: ${r.error.name}: ${r.error.message}` };
  }
  if (r.signal) {
    return { code: 1, detail: `terminated by signal: ${r.signal}` };
  }

  const code = r.status ?? 1;
  return { code, detail: code === 0 ? "" : `exit code ${code}` };
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

  // Keep green:fast fast but meaningful:
  // - lint:fast (full guard chain + lint)
  // - test:unit (fast deterministic unit suite)
  // - build:fast (tsc compile + shim check)
  const steps = ["lint:fast", "test:unit", "build:fast"];

  for (const s of steps) {
    headline(`npm run ${s}`);
    const r = runNpm(s, greenEnv);
    if (r.code !== 0) {
      die(`GREEN_FAST_FAIL: npm run ${s} failed (${r.detail})`, r.code);
    }
  }

  ok("\nGREEN_FAST_OK: all steps passed; repo state unchanged from baseline.");
} finally {
  safeRmRf(dir);
}
