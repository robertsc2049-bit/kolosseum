// Two-step sign-in for the admin console (admin_two_step.ts). Behaviour is
// proven against a real database in admin_two_step_persistent.integration
// .test.mjs; this pins the wiring the unit job can see without a build.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("a password alone never gets a session when two-step sign-in is on", () => {
  const service = read("src/api/product_admin_account_service.ts");
  assert.match(service, /if \(row\.two_step_enabled\) \{\s*return Object\.freeze\(\{ two_step_required: true, challenge_token: await createSignInChallenge\(row\.user_id\) \}\);/u);
  const routes = read("src/api/product_admin.routes.ts");
  assert.match(routes, /if \("two_step_required" in outcome\) \{\s*return response\.status\(200\)\.json\(\{ two_step_required: true, challenge_token: outcome\.challenge_token \}\);/u, "no cookie is set for the challenge");
});

test("in production, an admin without it can only reach the set-up routes", () => {
  const auth = read("src/api/product_admin_auth.ts");
  assert.match(auth, /if \(session\.two_step_setup_required && !options\.allowTwoStepSetup\) \{\s*throw forbidden\("ADMIN_TWO_STEP_SETUP_REQUIRED"/u);
  const routes = read("src/api/product_admin.routes.ts");
  const allowed = routes.split("productAdminRouter.").slice(1)
    .filter((block) => block.includes("allowTwoStepSetup: true"))
    .map((block) => block.match(/^(?:get|post)\(\s*"([^"]+)"/u)?.[1]);
  assert.deepEqual(allowed, ["/two-step", "/two-step/setup", "/two-step/setup/confirm"]);
  assert.match(read("src/api/admin_two_step.ts"), /return process\.env\.NODE_ENV === "production" && twoStepAvailable\(\);/u);
});

test("the server passes the key through, and the operator can reset a locked-out admin", () => {
  assert.match(read("docker-compose.prod.yml"), /KOLOSSEUM_ADMIN_TWO_STEP_KEY: \$\{KOLOSSEUM_ADMIN_TWO_STEP_KEY:-\}/u);
  assert.match(read("deploy/env.production.example"), /^KOLOSSEUM_ADMIN_TWO_STEP_KEY=$/mu);
  const script = read("scripts/bootstrap_admin_account.mjs");
  assert.match(script, /process\.argv\.includes\("--reset-two-step"\)/u);
  assert.match(script, /UPDATE product_admin_sessions SET revoked_at = now\(\) WHERE user_id = \$1 AND revoked_at IS NULL/u);
  assert.match(read("docs/ops/IONOS_VPS_DEPLOYMENT.md"), /--reset-two-step --email/u);
  assert.match(script, /process\.argv\.includes\("--reset-password"\)/u);
  assert.match(script, /SET password_salt = \$2, password_hash = \$3, failed_sign_in_count = 0, locked_until = NULL/u, "a reset clears the lockout");
  assert.match(script, /if \(!input\.isTTY\) \{/u, "the new password is only ever typed, never piped or passed as an argument");
  assert.match(read("docs/ops/IONOS_VPS_DEPLOYMENT.md"), /--reset-password --email/u);
});

test("the console asks for the code, sets it up, and shows backup codes once", () => {
  const html = read("public/admin/index.html");
  const js = read("public/admin/admin.js");
  assert.match(html, /<input id="adminTwoStepCode" type="text" required autocomplete="one-time-code"/u);
  for (const id of ["adminTwoStepSetupSection", "adminTwoStepQr", "adminTwoStepConfirmForm", "adminBackupCodesSection", "adminTwoStepStatus", "adminReplaceCodesForm"]) {
    assert.match(html, new RegExp(`id="${id}"`, "u"), id);
  }
  assert.match(js, /if \(result\.two_step_required\) \{/u);
  assert.match(js, /api\("POST", "\/admin\/sign-in\/two-step"/u);
  assert.match(js, /if \(state\.twoStep\?\.required && !state\.twoStep\.enabled\) \{\s*el\("adminSignInSection"\)\.hidden = true;\s*openTwoStepSetup\(true\);\s*return;/u, "set-up comes before the workspace");
  assert.match(js, /el\("adminBackupCodesList"\)\.innerHTML = "";/u, "codes are cleared once saved");
});
