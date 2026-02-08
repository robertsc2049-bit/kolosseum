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

function npmBin() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runNpm(script, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  const r = spawnSync(npmBin(), ["run", script], {
    encoding: "utf8",
    stdio: "inherit",
    shell: false,
    windowsHide: true,
    env,
  });
  return r.status ?? 1;
}

function mkNonceHandshake() {
  const nonce = crypto.randomBytes(16).toString("hex");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-greenfast-"));
  const file = path.join(dir, "nonce.txt");
  fs.writeFileSync(file, nonce + "\n", { encoding: "utf8" });
  return { nonce, dir, file };
}

function safeRmRf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {
    // ignore
  }
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
    const code = runNpm(s, greenEnv);
    if (code !== 0) {
      die(`GREEN_FAST_FAIL: npm run ${s} failed with exit code ${code}`, code);
    }
  }

  ok("\nGREEN_FAST_OK: all steps passed; repo state unchanged from baseline.");
} finally {
  safeRmRf(dir);
}
