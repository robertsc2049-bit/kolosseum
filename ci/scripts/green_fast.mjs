import { spawnSync } from "node:child_process";

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function npmCmd() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function run(stepName, args) {
  console.log("");
  console.log(`== GREEN:FAST STEP: ${stepName} ==`);
  console.log("");

  const cmd = npmCmd();
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  if (r.error) die(`GREEN_FAST_FAIL: ${stepName}: ${r.error.message}`, 1);
  const code = typeof r.status === "number" ? r.status : 1;
  if (code !== 0) die(`GREEN_FAST_FAIL: ${stepName} failed with exit code ${code}`, code);
}

function main() {
  // Minimal authoritative local chain, no e2e:
  // - lint:fast (guards + schema + evidence + registry law)
  // - test:unit (CI-focused unit tests)
  // - build:fast (tsc + shim check)
  run("npm run lint:fast", ["run", "lint:fast"]);
  run("npm run test:unit", ["run", "test:unit"]);
  run("npm run build:fast", ["run", "build:fast"]);

  console.log("");
  console.log("GREEN_FAST_OK: minimal local chain passed.");
}

main();
