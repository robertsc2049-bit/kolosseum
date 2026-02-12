import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function parseArgs(argv) {
  // Expected:
  //   node scripts/ps-runner.mjs --file <path> [--] [passthrough...]
  const out = { file: null, passthrough: [] };

  const a = argv.slice(2);
  const dd = a.indexOf("--");
  const main = dd >= 0 ? a.slice(0, dd) : a;
  const pass = dd >= 0 ? a.slice(dd + 1) : [];

  for (let i = 0; i < main.length; i++) {
    const tok = main[i];
    if (tok === "--file") {
      const v = main[i + 1];
      if (!v) die("ps-runner: missing value for --file");
      out.file = v;
      i++;
      continue;
    }
    if (tok === "--help" || tok === "-h") {
      out.help = true;
      continue;
    }
    die(`ps-runner: unknown arg: ${tok}`);
  }

  out.passthrough = pass;
  return out;
}

const { file, passthrough, help } = parseArgs(process.argv);

if (help) {
  console.log("Usage: node scripts/ps-runner.mjs --file <script.ps1> [--] [pwsh-args...]");
  process.exit(0);
}

if (!file) die("ps-runner: --file is required");

const scriptPath = path.resolve(process.cwd(), file);
if (!fs.existsSync(scriptPath)) die(`ps-runner: script not found: ${scriptPath}`);

const pwsh = "pwsh";
const args = [
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  scriptPath,
  ...passthrough,
];

console.log(`ps-runner: using pwsh to run ${file}`);
const r = spawnSync(pwsh, args, { stdio: "inherit" });

if (typeof r.status === "number") process.exit(r.status);
if (r.error) die(`ps-runner: failed to start pwsh: ${r.error.message}`);
die("ps-runner: pwsh terminated unexpectedly");