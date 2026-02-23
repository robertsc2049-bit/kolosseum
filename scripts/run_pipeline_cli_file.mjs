import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

// Parse args: --in <path>
const argv = process.argv.slice(2);
let inPath = null;
const passThrough = [];

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--in") {
    const v = argv[i + 1];
    if (!v) die("ERROR: --in requires a value");
    inPath = v;
    i++;
    continue;
  }
  passThrough.push(a);
}

// Resolve dist CLI path
const distCli = path.resolve(process.cwd(), "dist", "src", "run_pipeline_cli.js");
if (!fs.existsSync(distCli)) {
  die(`ERROR: missing dist CLI: ${distCli}\nRun: npm run build (or build:fast) first.`);
}

// Read input payload
let payload = "";
if (inPath) {
  const abs = path.resolve(process.cwd(), inPath);
  if (!fs.existsSync(abs)) die(`ERROR: --in file not found: ${abs}`);
  payload = fs.readFileSync(abs, "utf8");
} else {
  // If no --in, accept stdin (still supported, but not required anymore)
  payload = fs.readFileSync(0, "utf8");
}

const child = spawn(process.execPath, [distCli, ...passThrough], {
  stdio: ["pipe", "inherit", "inherit"],
});

child.stdin.write(payload);
child.stdin.end();

child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => die(`ERROR: failed to run dist CLI: ${err?.message || String(err)}`));