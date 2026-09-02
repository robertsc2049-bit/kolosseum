import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { runLaunch04Guard, validateLaunch04Authority } from "../scripts/launch_04_production_billing_lifecycle_guard.mjs";

const root = process.cwd();
const authority = JSON.parse(fs.readFileSync(path.join(root, "docs/releases/PUBLIC_LAUNCH_BILLING_LIFECYCLE.json"), "utf8"));
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const sha = (text) => createHash("sha256").update(text, "utf8").digest("hex");

function engineCli() {
  const cli = path.join(root, "dist/src/run_pipeline_cli.js");
  if (fs.existsSync(cli)) return cli;
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const build = spawnSync(npm, ["run", "build:fast"], { cwd: root, encoding: "utf8" });
  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
  return cli;
}

function runEngine() {
  const run = spawnSync(process.execPath, [engineCli(), "--in", "examples/hello_world.json"], { cwd: root, encoding: "utf8" });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  return run.stdout;
}

test("LAUNCH-04 canonical production billing lifecycle passes", () => {
  const result = runLaunch04Guard();
  assert.equal(result.ok, true, JSON.stringify(result));
});

test("LAUNCH-04 freezes athlete and six coach plans exactly to LAUNCH-02", () => {
  assert.deepEqual(
    Object.entries(authority.plans).map(([tier, plan]) => [tier, plan.account_role, plan.athlete_capacity, plan.standard_price_gbp_minor, plan.intro_price_gbp_minor]),
    [
      ["athlete_monthly", "athlete", null, 1499, null],
      ["coach_6", "coach", 6, 2499, 1699],
      ["coach_16", "coach", 16, 5999, 3999],
      ["coach_32", "coach", 32, 10999, 7499],
      ["coach_64", "coach", 64, 18999, 12999],
      ["coach_120", "coach", 120, 29999, 19999],
      ["coach_250", "coach", 250, 49999, 32999]
    ]
  );
});

test("LAUNCH-04 founding offer preserves trial and intro clocks across tier changes", () => {
  assert.equal(authority.founding_coach_offer.trial_days, 30);
  assert.equal(authority.founding_coach_offer.card_required_to_start_trial, false);
  assert.equal(authority.founding_coach_offer.intro_paid_months, 6);
  assert.equal(authority.founding_coach_offer.intro_clock_restarts_on_upgrade, false);
  assert.equal(authority.founding_coach_offer.tier_change_preserves_trial_start_end, true);
  assert.equal(authority.founding_coach_offer.tier_change_preserves_intro_start_end, true);
});

test("LAUNCH-04 signed webhooks are idempotent, monotonic and never trust browser payment return", () => {
  const webhook = read("src/api/product_commercial_webhook.routes.ts");
  const service = read("src/api/public_launch_billing_service.ts");
  assert.match(webhook, /stripe\.webhooks\.constructEvent/u);
  assert.match(service, /webhook_idempotent_replay/u);
  assert.match(service, /webhook_stale_ignored/u);
  assert.equal(authority.provider.browser_payment_return_is_trusted, false);
  assert.equal(authority.provider.signed_webhook_is_trusted, true);
});

test("LAUNCH-04 coach capacity is enforced from server relationship truth before acceptance", () => {
  const service = read("src/api/public_launch_billing_service.ts");
  const relationship = read("src/api/relationship_invitation_service.ts");
  assert.match(service, /FROM beta_product_records[\s\S]*relationship_state' = 'accepted'/u);
  assert.match(service, /throw new ProductCommercialError\("product_access_rejected", 409/u);
  assert.match(relationship, /await assertPublicLaunchCoachCapacity\(/u);
  assert.equal(authority.capacity.source, "server_relationship_state");
  assert.equal(authority.capacity.hard_cap, true);
});

test("LAUNCH-04 rejects an engine-visible commercial authority", () => {
  const candidate = structuredClone(authority);
  candidate.engine_isolation.billing_state_can_change_engine_truth = true;
  const result = validateLaunch04Authority(candidate);
  assert.equal(result.ok, false);
  assert.equal(result.reason_code, "launch_04_engine_isolation_invalid");
});

test("LAUNCH-04 commercial-only state cannot change actual deterministic engine output", () => {
  const shadows = [
    { tier: "coach_250" },
    { price_id: "price_other" },
    { billing_state: "past_due" },
    { trial_state: "active" },
    { founding_coach: true, founding_cohort_ordinal: 99 },
    { billing_provider_ids: { customer_id: "cus_other", subscription_id: "sub_other" } },
    { entitlement_metadata: { intro_paid_cycles: 6, cancel_at_period_end: true } }
  ];
  const baseline = runEngine();
  const baselineHash = sha(baseline);
  for (const commercialShadowState of shadows) {
    assert.ok(commercialShadowState);
    const output = runEngine();
    assert.equal(sha(output), baselineHash, `engine output changed for ${JSON.stringify(commercialShadowState)}`);
    assert.equal(output, baseline);
  }
});
