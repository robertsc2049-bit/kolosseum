import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function sha256File(p) {
  const buf = fs.readFileSync(p);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function walkFiles(dirAbs, ext) {
  const out = [];
  const stack = [dirAbs];

  while (stack.length) {
    const cur = stack.pop();
    const ents = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of ents) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (e.isFile() && e.name.endsWith(ext)) out.push(full);
    }
  }

  out.sort();
  return out;
}

function copyIfDifferent(src, dst) {
  ensureDir(path.dirname(dst));
  const srcHash = sha256File(src);
  if (isFile(dst)) {
    const dstHash = sha256File(dst);
    if (dstHash === srcHash) return false;
  }
  fs.copyFileSync(src, dst);
  return true;
}

function assertSame(src, dst) {
  if (!isFile(dst)) die("engine_pkg_dist_sync: missing: " + dst);
  const a = sha256File(src);
  const b = sha256File(dst);
  if (a !== b) die("engine_pkg_dist_sync: mismatch:\n  src: " + src + "\n  dst: " + dst);
}

function findBuiltEngineRoot(repo) {
  // We need a directory that contains: phases/phase1.js
  const candidates = [
    path.join(repo, "dist", "engine", "src"),
    path.join(repo, "dist", "engine", "dist", "src"),
    path.join(repo, "dist", "src", "engine"),
    path.join(repo, "engine", "dist", "src"),
  ];

  for (const c of candidates) {
    const phase1 = path.join(c, "phases", "phase1.js");
    if (exists(phase1)) return c;
  }

  // last resort: search dist for phases/phase1.js and infer its root
  const distRoot = path.join(repo, "dist");
  if (exists(distRoot)) {
    const hits = walkFiles(distRoot, ".js").filter(p => p.endsWith(path.join("phases", "phase1.js")));
    if (hits.length) return path.dirname(path.dirname(hits[0])); // .../src (parent of phases)
  }

  return "";
}

function main() {
  const mode = process.argv.includes("--check")
    ? "check"
    : (process.argv.includes("--write") ? "write" : "");
  if (!mode) die("engine_pkg_dist_sync: usage: node scripts/engine_pkg_dist_sync.mjs --check|--write");

  const repo = process.cwd();

  const engineSrc = path.join(repo, "engine", "src");
  const engineDist = path.join(repo, "engine", "dist", "src");

  const nmEngine = path.join(repo, "node_modules", "@kolosseum", "engine");
  const nmDist = path.join(nmEngine, "dist", "src");

  if (!exists(engineSrc)) die("engine_pkg_dist_sync: missing engine src: " + engineSrc);
  if (!exists(nmEngine)) die("engine_pkg_dist_sync: missing installed engine package: " + nmEngine);

  // A) runtime helpers authored in JS under engine/src (not produced by tsc)
  const runtimeJs = walkFiles(engineSrc, ".js");

  const requiredRuntime = [
    path.join(engineSrc, "runtime", "session_summary.js"),
    path.join(engineSrc, "runtime", "apply_runtime_event.js"),
    path.join(engineSrc, "runtime", "session_runtime.js"),
  ];
  for (const r of requiredRuntime) {
    if (!isFile(r)) die("engine_pkg_dist_sync: required file missing in engine/src: " + r);
  }

  // B) built engine output tree (tsc output) â€” MUST include registries/, phases/, etc.
  const builtRoot = findBuiltEngineRoot(repo);
  if (!builtRoot) die("engine_pkg_dist_sync: could not locate built engine outputs (phases/phase1.js). Run `npm run build` then retry.");

  const builtPhase1 = path.join(builtRoot, "phases", "phase1.js");
  if (!exists(builtPhase1)) die("engine_pkg_dist_sync: builtRoot invalid (missing phases/phase1.js): " + builtRoot);

  const builtJs = walkFiles(builtRoot, ".js");

  if (mode === "write") {
    let wroteEngine = 0;
    let wroteNm = 0;

    // 1) Copy built output tree into engine/dist/src (+ node_modules dist)
    for (const srcAbs of builtJs) {
      const rel = path.relative(builtRoot, srcAbs); // e.g. phases/phase4.js, registries/loadExerciseEntries.js
      const dstEngine = path.join(engineDist, rel);
      const dstNm = path.join(nmDist, rel);

      if (copyIfDifferent(srcAbs, dstEngine)) wroteEngine++;
      if (copyIfDifferent(srcAbs, dstNm)) wroteNm++;
    }

    // 2) Overlay runtime helpers from engine/src onto dist trees (authoritative for these files)
    for (const srcAbs of runtimeJs) {
      const rel = path.relative(engineSrc, srcAbs); // e.g. runtime/apply_runtime_event.js
      const dstEngine = path.join(engineDist, rel);
      const dstNm = path.join(nmDist, rel);

      if (copyIfDifferent(srcAbs, dstEngine)) wroteEngine++;
      if (copyIfDifferent(srcAbs, dstNm)) wroteNm++;
    }

    console.log("OK: engine_pkg_dist_sync --write (engine wrote " + wroteEngine + ", node_modules wrote " + wroteNm + ")");
    console.log("INFO: builtRoot=" + builtRoot);
    return;
  }

  // check mode
  for (const srcAbs of builtJs) {
    const rel = path.relative(builtRoot, srcAbs);
    assertSame(srcAbs, path.join(engineDist, rel));
    assertSame(srcAbs, path.join(nmDist, rel));
  }

  for (const srcAbs of runtimeJs) {
    const rel = path.relative(engineSrc, srcAbs);
    assertSame(srcAbs, path.join(engineDist, rel));
    assertSame(srcAbs, path.join(nmDist, rel));
  }

  console.log("OK: engine_pkg_dist_sync --check (dist mirrors built engine + runtime overlays)");
}

main();
