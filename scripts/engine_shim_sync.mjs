import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function normalizeText(s) {
  // Normalize to LF-only and exactly one final LF.
  const lf = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return lf.replace(/\n*$/, "\n");
}

function sha256(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const args = new Set(process.argv.slice(2));
const modeCheck = args.has("--check");
const modeWrite = args.has("--write");

if (!modeCheck && !modeWrite) {
  die(
    "engine_shim_sync: missing mode. Use one of:\n" +
    "  node scripts/engine_shim_sync.mjs --check\n" +
    "  node scripts/engine_shim_sync.mjs --write\n"
  );
}

const repoRoot = process.cwd();

// Source of truth: root dist output (NOT engine/dist)
const src = path.resolve(repoRoot, "dist/engine/src/runtime/session_runtime.js");
// Tracked shim target (must exist and be committed)
const dst = path.resolve(repoRoot, "engine/src/runtime/session_runtime.js");

if (!exists(src)) {
  die(
    "engine_shim_sync: missing dist runtime source:\n" +
    "  " + src + "\n" +
    "Run: npm run build:fast\n"
  );
}

const srcRaw = fs.readFileSync(src, "utf8");
const srcText = normalizeText(srcRaw);

if (modeCheck) {
  if (!exists(dst)) {
    die(
      "engine_shim_sync: missing shim target:\n" +
      "  " + dst + "\n" +
      "Fix: npm run engine:shim:sync\n"
    );
  }

  const dstRaw = fs.readFileSync(dst, "utf8");
  const dstText = normalizeText(dstRaw);

  if (srcText !== dstText) {
    const a = sha256(srcText);
    const b = sha256(dstText);
    die(
      "engine_shim_sync: shim drift detected.\n" +
      "source: dist/engine/src/runtime/session_runtime.js sha256=" + a + "\n" +
      "target: engine/src/runtime/session_runtime.js sha256=" + b + "\n" +
      "Fix:    npm run engine:shim:sync (then commit)\n"
    );
  }

  console.log("OK: engine_shim_sync --check (shim matches dist runtime)");
  process.exit(0);
}

// --write
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.writeFileSync(dst, srcText, { encoding: "utf8" });
console.log("OK: wrote shim -> engine/src/runtime/session_runtime.js");
