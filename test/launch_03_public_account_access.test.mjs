// DEV NOTE: LAUNCH-03 direct proof. Persistent HTTP account/relationship proof is
// separately indexed into test:ci:integration; this file proves authority closure
// and byte-identical deterministic engine output under auth-only shadow-state changes.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { LAUNCH_03_REASON_CODES, runLaunch03Guard, validateLaunch03Authority } from "../scripts/launch_03_public_account_access_guard.mjs";

const root = process.cwd();
const authority = JSON.parse(fs.readFileSync(path.join(root, "docs/releases/PUBLIC_LAUNCH_ACCOUNT_ACCESS.json"), "utf8"));
const sha = (text) => createHash("sha256").update(text, "utf8").digest("hex");

function engineCli() {
  const cli = path.join(root, "dist", "src", "run_pipeline_cli.js");
  if (fs.existsSync(cli)) return cli;
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const build = spawnSync(npm, ["run", "build:fast"], { cwd: root, encoding: "utf8" });
  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
  return cli;
}
function runEngine(environment = {}) {
  const result = spawnSync(process.execPath, [engineCli(), "--in", "examples/hello_world.json"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...environment }
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

test("LAUNCH-03 canonical account-access authority passes", () => {
  const result = runLaunch03Guard();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.pass_token, "PUBLIC_LAUNCH_ACCOUNT_ACCESS: PASS");
});

test("LAUNCH-03 public roles are exactly athlete and coach", () => {
  assert.deepEqual(authority.active_public_roles, ["athlete", "coach"]);
  assert.equal(authority.relationship_access.organisation_team_gym_scope_active, false);
  assert.equal(authority.identity_policy.implicit_role_promotion_permitted, false);
});

test("LAUNCH-03 rejects undeclared active roles", () => {
  const candidate = structuredClone(authority);
  candidate.active_public_roles.push("org_owner");
  const result = validateLaunch03Authority(candidate);
  assert.equal(result.ok, false);
  assert.equal(result.reason_code, LAUNCH_03_REASON_CODES.ROLE_SCOPE_INVALID);
});

test("LAUNCH-03 rejects implicit role promotion", () => {
  const candidate = structuredClone(authority);
  candidate.identity_policy.implicit_role_promotion_permitted = true;
  const result = validateLaunch03Authority(candidate);
  assert.equal(result.ok, false);
  assert.equal(result.reason_code, LAUNCH_03_REASON_CODES.IDENTITY_POLICY_INVALID);
});

test("LAUNCH-03 rejects organisation/team/gym relationship activation", () => {
  const candidate = structuredClone(authority);
  candidate.relationship_access.organisation_team_gym_scope_active = true;
  const result = validateLaunch03Authority(candidate);
  assert.equal(result.ok, false);
  assert.equal(result.reason_code, LAUNCH_03_REASON_CODES.RELATIONSHIP_POLICY_INVALID);
});

test("LAUNCH-03 rejects account/auth coupling to engine truth", () => {
  const candidate = structuredClone(authority);
  candidate.engine_isolation.authentication_metadata_in_deterministic_engine_input = true;
  const result = validateLaunch03Authority(candidate);
  assert.equal(result.ok, false);
  assert.equal(result.reason_code, LAUNCH_03_REASON_CODES.ENGINE_COUPLING_INVALID);
});

test("LAUNCH-03 relationship policy denies unassigned coach and preserves athlete self authority", () => {
  assert.equal(authority.relationship_access.accepted_state_required_for_coach_access, true);
  assert.equal(authority.relationship_access.unassigned_coach_access, "denied");
  assert.equal(authority.relationship_access.athlete_self_access_requires_relationship, false);
});

test("LAUNCH-03 account/auth shadow state cannot change actual deterministic engine output", () => {
  const baseline = runEngine();
  const baselineHash = sha(baseline);
  const variants = [
    { KOLOSSEUM_ACCOUNT_STATE: "suspended" },
    { KOLOSSEUM_ACCOUNT_ROLE: "coach" },
    { KOLOSSEUM_SESSION_TOKEN: "shadow-session-token" },
    { KOLOSSEUM_EMAIL_VERIFIED: "0" },
    { KOLOSSEUM_RELATIONSHIP_STATE: "revoked" }
  ];
  for (const environment of variants) {
    const output = runEngine(environment);
    assert.equal(sha(output), baselineHash, `engine output changed for ${JSON.stringify(environment)}`);
    assert.equal(output, baseline);
  }
});
