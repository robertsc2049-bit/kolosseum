import { spawnSync } from "node:child_process";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.error) return null;
  return r.status ?? 0;
}

const ps1 = "scripts/version-gate.ps1";

const candidates = [
  ["pwsh", ["-NoProfile", "-File", ps1]],
  ["powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1]],
];

for (const [cmd, args] of candidates) {
  const code = run(cmd, args);
  if (code !== null) process.exit(code);
}

console.error(`Neither 'pwsh' nor 'powershell' found on PATH. Tried: ${candidates.map(c => c[0]).join(", ")}`);
process.exit(127);
