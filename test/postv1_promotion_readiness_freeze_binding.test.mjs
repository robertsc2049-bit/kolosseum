import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildPromotionReadiness } from "../ci/scripts/run_postv1_promotion_readiness_runner.mjs";

function writeUtf8(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function makeRepoFixture() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-p103-"));
}

function makeJsonRunner(repoRoot, relativeScriptPath, payload, exitCode = 0) {
  const scriptPath = path.join(repoRoot, relativeScriptPath);
  const script = [
    `process.stdout.write(${JSON.stringify(JSON.stringify(payload))});`,
    `process.exit(${String(exitCode)});`
  ].join("\n");

  writeUtf8(scriptPath, script + "\n");
}

test("promotion readiness passes when freeze prerequisite is present and ok", () => {
  const repoRoot = makeRepoFixture();

  writeUtf8(
    path.join(repoRoot, "docs/releases/V1_FREEZE_ARTEFACT_REGISTRY.json"),
    JSON.stringify({ ok: true }, null, 2) + "\n"
  );

  makeJsonRunner(
    repoRoot,
    "ci/scripts/run_postv1_freeze_artefact_registry_verifier.mjs",
    { ok: true, registry_id: "freeze_registry" },
    0
  );

  const readiness = buildPromotionReadiness({
    repoRoot,
    prerequisites: [
      {
        prerequisite_id: "freeze_readiness",
        runner_script: "ci/scripts/run_postv1_freeze_artefact_registry_verifier.mjs",
        required_artefact: "docs/releases/V1_FREEZE_ARTEFACT_REGISTRY.json"
      }
    ]
  });

  assert.equal(readiness.ok, true);
  assert.equal(readiness.promotion_ready, true);
  assert.equal(readiness.prerequisites.length, 1);
  assert.equal(readiness.prerequisites[0].ok, true);
});

test("promotion readiness fails when freeze artefact is missing", () => {
  const repoRoot = makeRepoFixture();

  makeJsonRunner(
    repoRoot,
    "ci/scripts/run_postv1_freeze_artefact_registry_verifier.mjs",
    { ok: true, registry_id: "freeze_registry" },
    0
  );

  const readiness = buildPromotionReadiness({
    repoRoot,
    prerequisites: [
      {
        prerequisite_id: "freeze_readiness",
        runner_script: "ci/scripts/run_postv1_freeze_artefact_registry_verifier.mjs",
        required_artefact: "docs/releases/V1_FREEZE_ARTEFACT_REGISTRY.json"
      }
    ]
  });

  assert.equal(readiness.ok, false);
  assert.equal(readiness.promotion_ready, false);
  assert.equal(readiness.failure.prerequisite_id, "freeze_readiness");
  assert.equal(readiness.failure.reason, "required_artefact_missing");
});

test("promotion readiness fails when freeze verifier returns ok false", () => {
  const repoRoot = makeRepoFixture();

  writeUtf8(
    path.join(repoRoot, "docs/releases/V1_FREEZE_ARTEFACT_REGISTRY.json"),
    JSON.stringify({ ok: true }, null, 2) + "\n"
  );

  makeJsonRunner(
    repoRoot,
    "ci/scripts/run_postv1_freeze_artefact_registry_verifier.mjs",
    { ok: false, reason: "freeze_missing_surface" },
    0
  );

  const readiness = buildPromotionReadiness({
    repoRoot,
    prerequisites: [
      {
        prerequisite_id: "freeze_readiness",
        runner_script: "ci/scripts/run_postv1_freeze_artefact_registry_verifier.mjs",
        required_artefact: "docs/releases/V1_FREEZE_ARTEFACT_REGISTRY.json"
      }
    ]
  });

  assert.equal(readiness.ok, false);
  assert.equal(readiness.promotion_ready, false);
  assert.equal(readiness.failure.prerequisite_id, "freeze_readiness");
  assert.equal(readiness.failure.reason, "prerequisite_not_ready");
});