import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function fileExists(p) {
  try { return fs.statSync(p).isFile() || fs.statSync(p).isFIFO(); } catch { return false; }
}

function dirExists(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function findRepoRoot(startDir) {
  let cur = path.resolve(startDir);
  for (let i = 0; i < 50; i++) {
    const pkg = path.join(cur, "package.json");
    if (fileExists(pkg)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

function resolveCmd(name) {
  // Keep it simple: rely on PATH. Wrapper (PS1) already prints resolved paths on Windows.
  // In containers/mac/linux this is enough.
  return name;
}

function run(cmd, args, cwd) {
  const isWin = process.platform === "win32";
  const exe = isWin && cmd === "npm" ? "npm.cmd" : cmd;

  const res = spawnSync(exe, args, {
    cwd,
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  const code = typeof res.status === "number" ? res.status : 1;
  if (code !== 0) process.exit(code);
}

function parseArgs(argv) {
  const out = { fixture: "examples/hello_world.json", build: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fixture" || a === "--in") {
      const v = argv[i + 1];
      if (!v) die("engine_smoke.mjs: missing value after --fixture/--in");
      out.fixture = v;
      i++;
      continue;
    }
    if (a === "--no-build") { out.build = false; continue; }
    if (a === "--build") { out.build = true; continue; }
    if (a === "-h" || a === "--help") {
      console.log([
        "engine_smoke.mjs",
        "  --fixture <path>   (default: examples/hello_world.json)",
        "  --no-build         (skip npm run build:fast)",
        "  --build            (force build step; default)",
      ].join("\n"));
      process.exit(0);
    }
    die(`engine_smoke.mjs: unknown arg: ${a}`);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const repo = findRepoRoot(process.cwd());
if (!repo) die("engine_smoke.mjs: failed to locate repo root (package.json not found walking upwards). Run inside repo.");

const fixtureAbs = path.resolve(repo, args.fixture);
const runnerAbs = path.resolve(repo, "scripts", "run_pipeline_cli_file.mjs");

if (!fileExists(path.join(repo, "package.json"))) die(`engine_smoke.mjs: package.json missing at repo root: ${repo}`);
if (!fileExists(runnerAbs)) die(`engine_smoke.mjs: scripts/run_pipeline_cli_file.mjs missing at repo root: ${repo}`);
if (!fileExists(fixtureAbs)) die(`engine_smoke.mjs: fixture not found: ${fixtureAbs}`);

console.log(`SMOKE: repo=${repo}`);
console.log(`SMOKE: fixture=${path.relative(repo, fixtureAbs)}`);

if (args.build) {
  console.log("SMOKE: build=on (npm run build:fast)");
  run(resolveCmd("npm"), ["run", "build:fast"], repo);
} else {
  console.log("SMOKE: build=off (--no-build)");
}

console.log("SMOKE: run_pipeline (hello_world)");
run(resolveCmd("node"), [runnerAbs, "--in", fixtureAbs], repo);

console.log("SMOKE_OK");
process.exit(0);