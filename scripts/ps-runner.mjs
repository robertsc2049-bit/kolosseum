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
  const res = spawnSync(
    cmd,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.ToString()"],
    { stdio: "ignore", shell: false, timeout: 10_000 }
  );
  return res.status === 0;
}

function pickShell() {
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

// Pass the script path + args via env to avoid PowerShell -Command arg binding weirdness.
const env = { ...process.env };
env.KOLOSSEUM_PSRUNNER_SCRIPT = abs;
env.KOLOSSEUM_PSRUNNER_ARGS_JSON = JSON.stringify(passthrough);

// Force UTF-8 output inside the PowerShell host process, then invoke the script.
const command = [
  "$ErrorActionPreference = 'Stop';",
  "$ScriptPath = $env:KOLOSSEUM_PSRUNNER_SCRIPT;",
  "if ([string]::IsNullOrWhiteSpace($ScriptPath)) { throw 'ps-runner: missing KOLOSSEUM_PSRUNNER_SCRIPT'; }",
  "$ArgsJson = $env:KOLOSSEUM_PSRUNNER_ARGS_JSON;",
  "if ([string]::IsNullOrWhiteSpace($ArgsJson)) { $ArgsJson = '[]'; }",
  "$ScriptArgs = @();",
  "try { $ScriptArgs = (ConvertFrom-Json -InputObject $ArgsJson); } catch { throw ('ps-runner: invalid KOLOSSEUM_PSRUNNER_ARGS_JSON: ' + $ArgsJson); }",
  "if ($null -eq $ScriptArgs) { $ScriptArgs = @(); }",
  "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false);",
  "$OutputEncoding = [Console]::OutputEncoding;",
  "& $ScriptPath @ScriptArgs;",
  "exit $LASTEXITCODE;",
].join(" ");

const args = [
  "-NoLogo",
  "-NoProfile",
  "-NonInteractive",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  command,
];

const res = spawnSync(shell, args, {
  stdio: "inherit",
  shell: false,
  env,
  timeout: 10 * 60 * 1000, // 10 minutes hard stop to prevent "hours"
});

if (res.error && res.error.code === "ETIMEDOUT") {
  fail(`timed out running ${file}`);
}

process.exit(res.status ?? 1);
