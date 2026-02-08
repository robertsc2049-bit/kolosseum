import { spawnSync } from "node:child_process";

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function npmInvocation() {
  // When invoked via `npm run ...`, npm sets npm_execpath to the npm CLI JS file.
  // Spawning Node + npm-cli.js is the most reliable cross-platform call (avoids npm.cmd EINVAL on Windows).
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && typeof npmExecPath === "string" && npmExecPath.length > 0) {
    return { cmd: process.execPath, prefix: [npmExecPath] };
  }

  // Fallback for odd environments (still try direct npm).
  const cmd = process.platform === "win32" ? "npm.cmd" : "npm";
  return { cmd, prefix: [] };
}

function runRaw(stepName, cmd, args) {
  console.log("");
  console.log(`== GREEN:FAST STEP: ${stepName} ==`);
  console.log("");

  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  if (r.error) die(`GREEN_FAST_FAIL: ${stepName}: ${r.error.message}`, 1);
  const code = typeof r.status === "number" ? r.status : 1;
  if (code !== 0) die(`GREEN_FAST_FAIL: ${stepName} failed with exit code ${code}`, code);
}

function runNpm(stepName, npmArgs) {
  const inv = npmInvocation();
  runRaw(stepName, inv.cmd, [...inv.prefix, ...npmArgs]);
}

function main() {
  // Establish the GREEN nonce so nested clean_tree_guard behaves like it does inside ci/scripts/green.mjs
  runRaw("green_entrypoint_guard (establish nonce)", process.execPath, ["ci/guards/green_entrypoint_guard.mjs"]);

  // Minimal authoritative local chain, no e2e:
  // - lint:fast (guards + schema + evidence + registry law)
  // - test:unit (CI-focused unit tests)
  // - build:fast (tsc + shim check)
  runNpm("npm run lint:fast", ["run", "lint:fast"]);
  runNpm("npm run test:unit", ["run", "test:unit"]);
  runNpm("npm run build:fast", ["run", "build:fast"]);

  console.log("");
  console.log("GREEN_FAST_OK: minimal local chain passed.");
}

main();
