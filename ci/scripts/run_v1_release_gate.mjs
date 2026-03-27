import { spawnSync } from "node:child_process";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status);
}

//
// 1. build must succeed
//
run("npm", ["exec", "tsc", "--", "-p", "tsconfig.json"]);

//
// 2. full CI composition must pass
//
run("node", ["ci/scripts/run_test_ci_from_index.mjs"]);

//
// 3. golden replay must pass
//
run("node", ["ci/scripts/e2e_golden.mjs"]);

//
// 4. no-inference guard (S19 surface)
//
run("node", ["ci/scripts/run_no_inference_copy_guard.mjs"]);

//
// success = release boundary valid
//
console.log("V1_RELEASE_GATE_OK");