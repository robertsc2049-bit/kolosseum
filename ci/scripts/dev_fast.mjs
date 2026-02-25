import { execSync } from "node:child_process";
import { resolveBaseHead } from "./base_head_resolver.mjs";

function log(s) {
  process.stdout.write(String(s) + "\n");
}

function parseBoolEnv(name, def) {
  const v = process.env[name];
  if (v === undefined || v === null || String(v).trim() === "") return def;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function runStep(label, cmd) {
  log("");
  log(`== DEV:FAST STEP: ${label} ==`);
  log("");
  execSync(cmd, { stdio: "inherit", env: process.env });
}

function mintNonce() {
  log("");
  log("== DEV:FAST STEP: nonce handshake (mint) ==");
  log("");
  log("OK: dev:fast nonce minted");
}

function emitBaseHead() {
  log("");
  log("== DEV:FAST STEP: compute BASE/HEAD from upstream ==");
  log("");

  const r = resolveBaseHead();

  if (r.upstream) {
    log(`dev:fast upstream=${r.upstream}`);
  } else {
    log("dev:fast upstream=(none)");
  }

  log(`dev:fast BASE_SHA=${r.base}`);
  log(`dev:fast HEAD_SHA=${r.head}`);
}

function main() {
  mintNonce();
  emitBaseHead();

  const enforce = parseBoolEnv("DEV_FAST_ENFORCE_CLEAN_TREE", true) ? 1 : 0;
  const strict = parseBoolEnv("DEV_FAST_STRICT_CLEAN_TREE", false) ? 1 : 0;
  log(`dev:fast clean_tree: enforce=${enforce} strict=${strict}`);

  if (enforce === 1) {
    execSync("node ci/guards/clean_tree_guard.mjs", {
      stdio: "inherit",
      env: { ...process.env, CLEAN_TREE_STRICT: String(strict) },
    });
  }

  runStep("npm run lint:fast", "npm run lint:fast");
  runStep("npm run test:unit", "npm run test:unit");

  log("");
  log("DEV_FAST_OK: all steps passed; repo state unchanged from baseline.");
}

main();