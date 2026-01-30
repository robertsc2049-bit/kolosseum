import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function fail(msg) {
  console.error(`ps-runner: FAIL: ${msg}`);
  process.exit(1);
}

function info(msg) {
  console.log(`ps-runner: ${msg}`);
}

function parseArgs(argv) {
  const out = { file: "", passthrough: [] };

  const idx = argv.indexOf("--file");
  if (idx === -1 || !argv[idx + 1]) {
    fail(`missing --file <path/to/script.ps1>`);
  }
  out.file = argv[idx + 1];

  const sep = argv.indexOf("--");
  out.passthrough = sep === -1 ? [] : argv.slice(sep + 1);

  return out;
}

function commandExists(cmd) {
  const res = spawnSync(cmd, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], {
    stdio: "ignore",
    shell: false
  });
  return res.status === 0;
}

function pickShell() {
  // GitHub ubuntu images have pwsh; Windows has powershell; some setups have both.
  if (commandExists("pwsh")) return "pwsh";
  if (commandExists("powershell")) return "powershell";
  return "";
}

const { file, passthrough } = parseArgs(process.argv.slice(2));
const abs = path.resolve(process.cwd(), file);

if (!fs.existsSync(abs)) {
  fail(`script not found: ${abs}`);
}

const shell = pickShell();
if (!shell) {
  fail(`neither 'pwsh' nor 'powershell' found on PATH`);
}

info(`using ${shell} to run ${file}`);

const args = [
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  abs,
  ...passthrough
];

const res = spawnSync(shell, args, {
  stdio: "inherit",
  shell: false,
  env: process.env
});

process.exit(res.status ?? 1);
