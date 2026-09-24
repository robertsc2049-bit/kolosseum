// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * @file S-V1-G-03 controlled launch release tag currency confirmation guard.
 * @desc Proves the current release tag is covered by fresh, passing evidence without
 * reissuing a GO/NO-GO decision or rewriting the S-V1-F-12 historical record.
 */

import { spawnSync } from "node:child_process";

const TOKEN = "CI_V1_RELEASE_TAG_CURRENCY_CONFIRMATION";

const result = spawnSync(process.execPath, [
  "ci/scripts/run_s_v1_g_03_controlled_launch_release_tag_currency_confirmation.mjs",
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
    guard: "S-V1-G-03",
    token: TOKEN,
    message: "Release tag currency confirmation guard failed."
  }, null, 2));
  process.exitCode = result.status || 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    guard: "S-V1-G-03",
    token: TOKEN,
    message: "Release tag currency confirmation guard passed."
  }, null, 2));
}
