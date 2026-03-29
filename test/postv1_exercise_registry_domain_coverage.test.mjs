import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function runVerifier(declarationPath, cwd) {
  const scriptPath = path.resolve(process.cwd(), "ci/scripts/run_postv1_exercise_registry_domain_coverage_verifier.mjs");
  const result = spawnSync(process.execPath, [scriptPath, declarationPath], {
    cwd,
    encoding: "utf8",
  });

  const stdout = result.stdout.trim();
  assert.notEqual(stdout, "", "verifier should emit JSON report to stdout");

  let report;
  try {
    report = JSON.parse(stdout);
  } catch (error) {
    assert.fail(`verifier stdout was not valid JSON.\nstdout:\n${stdout}\nerror: ${error}`);
  }

  return {
    status: result.status,
    report,
  };
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p57-exercise-domain-coverage-"));

  writeText(path.join(root, "ci", "scripts", "run_postv1_exercise_registry_domain_coverage_verifier.mjs"), "// fixture\n");

  const declarationPath = path.join(root, "docs", "releases", "V1_EXERCISE_REGISTRY_DOMAIN_COVERAGE.json");
  writeJson(declarationPath, {
    coverage_id: "v1_exercise_registry_domain_coverage",
    required_surfaces: [
      "ci/scripts/run_postv1_exercise_registry_domain_coverage_verifier.mjs",
      "docs/releases/V1_EXERCISE_REGISTRY_DOMAIN_COVERAGE.json",
    ],
    required_registry_domains: [
      "exercise_registry_3a",
      "exercise_token_registry_3b",
      "exercise_alias_registry_3c",
      "exercise_variant_applicability_registry_3d",
    ],
    declared_registry_domain_claims: [
      "exercise_registry_3a",
      "exercise_token_registry_3b",
      "exercise_alias_registry_3c",
      "exercise_variant_applicability_registry_3d",
    ],
  });

  return { root, declarationPath };
}

test("P57: exercise registry domain coverage verifier passes when all required domain claims are present", () => {
  const fixture = createFixture();
  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);

  assert.equal(status, 0);
  assert.equal(report.ok, true);
  assert.deepEqual(report.verified_registry_domains, [
    "exercise_registry_3a",
    "exercise_token_registry_3b",
    "exercise_alias_registry_3c",
    "exercise_variant_applicability_registry_3d",
  ]);
});

test("P57: exercise registry domain coverage verifier fails when a required exercise registry domain is missing", () => {
  const fixture = createFixture();

  writeJson(fixture.declarationPath, {
    coverage_id: "v1_exercise_registry_domain_coverage",
    required_surfaces: [
      "ci/scripts/run_postv1_exercise_registry_domain_coverage_verifier.mjs",
      "docs/releases/V1_EXERCISE_REGISTRY_DOMAIN_COVERAGE.json",
    ],
    required_registry_domains: [
      "exercise_registry_3a",
      "exercise_token_registry_3b",
      "exercise_alias_registry_3c",
      "exercise_variant_applicability_registry_3d",
    ],
    declared_registry_domain_claims: [
      "exercise_registry_3a",
      "exercise_token_registry_3b",
      "exercise_alias_registry_3c"
    ],
  });

  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);

  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(
    report.failures.some((failure) => failure.token === "coverage_required_domain_missing"),
    `expected coverage_required_domain_missing, got ${JSON.stringify(report, null, 2)}`
  );
});