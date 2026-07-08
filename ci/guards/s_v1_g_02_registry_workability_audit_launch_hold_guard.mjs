// @law: Registry Law
// @severity: high
// @scope: registry
import { spawnSync } from "node:child_process";

const TOKEN = "CI_V1_REGISTRY_WORKABILITY_AUDIT_LAUNCH_HOLD";

const result = spawnSync(process.execPath, [
  "ci/scripts/run_s_v1_g_02_registry_workability_audit_launch_hold.mjs",
  "--check"
], {
  cwd: process.cwd(),
  encoding: "utf8"
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.status !== 0) {
  console.error(JSON.stringify({
    ok: false,
    guard: "S-V1-G-02",
    token: TOKEN,
    message: "Registry workability hold closure guard failed."
  }, null, 2));
  process.exitCode = result.status || 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    guard: "S-V1-G-02",
    token: TOKEN,
    message: "Registry workability hold closure guard passed."
  }, null, 2));
}
