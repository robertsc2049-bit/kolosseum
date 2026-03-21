import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("phase1 v0 truth surface drift guard: pinned v0 boundary stays stable", () => {
  const repo = process.cwd();
  const truthPath = path.join(repo, "ci", "contracts", "phase1_v0_truth_surface.json");
  const jsPath = path.join(repo, "scripts", "ci-enforce-phase1.mjs");

  const truth = JSON.parse(fs.readFileSync(truthPath, "utf8"));
  const jsSrc = fs.readFileSync(jsPath, "utf8");

  assert.equal(
    truth.schema_version,
    "kolosseum.phase1.v0.truth-surface.v1",
    "expected pinned truth-surface schema version"
  );

  assert.deepEqual(
    truth.allowed_actor_types,
    ["individual_user", "coach"],
    "v0 actors must remain individual_user + coach only"
  );

  assert.deepEqual(
    truth.allowed_execution_scopes,
    ["individual", "coach_managed"],
    "v0 execution scopes must remain individual + coach_managed only"
  );

  assert.deepEqual(
    truth.allowed_activities,
    ["powerlifting", "rugby_union", "general_strength"],
    "v0 activities must remain powerlifting + rugby_union + general_strength only"
  );

  assert.match(
    jsSrc,
    /const TRUTH_SURFACE_PATH = "ci\/contracts\/phase1_v0_truth_surface\.json";/,
    "expected enforcer to keep consuming the committed truth surface path"
  );
});
