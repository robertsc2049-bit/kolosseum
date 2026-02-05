import { spawnSync } from "node:child_process";

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

const argv = process.argv.slice(2);
const sep = argv.indexOf("--");
if (sep === -1) {
  die("run_env: missing -- separator. Usage: node scripts/run_env.mjs KEY=VAL KEY2=VAL2 -- cmd arg1 arg2");
}

const envPairs = argv.slice(0, sep);
const cmd = argv[sep + 1];
const cmdArgs = argv.slice(sep + 2);

if (!cmd) die("run_env: missing command after --");

const extraEnv = {};
for (const p of envPairs) {
  const eq = p.indexOf("=");
  if (eq <= 0) die(`run_env: invalid env pair: ${p} (expected KEY=VAL)`);
  const k = p.slice(0, eq);
  const v = p.slice(eq + 1);
  extraEnv[k] = v;
}

const res = spawnSync(cmd, cmdArgs, {
  stdio: "inherit",
  shell: false,
  env: { ...process.env, ...extraEnv }
});

if (res.error) die(`run_env: spawn error: ${String(res.error)}`);
process.exit(res.status ?? 1);
