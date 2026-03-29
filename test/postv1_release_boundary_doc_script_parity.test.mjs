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
  const scriptPath = path.resolve(process.cwd(), "ci/scripts/run_postv1_release_boundary_doc_script_parity_verifier.mjs");
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p58-release-boundary-doc-script-parity-"));

  writeJson(path.join(root, "docs", "releases", "V1_FINAL_ACCEPTANCE_BOUNDARY.json"), {
    boundary_id: "v1_final_acceptance_boundary",
    checks: [
      {
        check_id: "release_claim",
        script_path: "ci/scripts/run_postv1_release_claim_validator_boundary_adapter.mjs"
      },
      {
        check_id: "final_acceptance_boundary",
        script_path: "ci/scripts/run_postv1_final_acceptance_boundary_runner.mjs"
      }
    ]
  });

  writeJson(path.join(root, "docs", "releases", "V1_PROMOTION_READINESS.json"), {
    readiness_id: "v1_promotion_readiness",
    prerequisites: [
      {
        prereq_id: "promotion_flow_legality_chain",
        script_path: "ci/scripts/run_postv1_promotion_flow_legality_chain_verifier.mjs"
      },
      {
        prereq_id: "final_acceptance_boundary",
        script_path: "ci/scripts/run_postv1_final_acceptance_boundary_runner.mjs"
      }
    ]
  });

  writeJson(path.join(root, "docs", "releases", "V1_RELEASE_CLOSURE.json"), {
    closure_id: "v1_release_closure",
    post_merge_checks: [
      {
        check_id: "final_acceptance_boundary",
        script_path: "ci/scripts/run_postv1_final_acceptance_boundary_runner.mjs"
      },
      {
        check_id: "promotion_readiness",
        script_path: "ci/scripts/run_postv1_promotion_readiness_runner.mjs"
      }
    ]
  });

  writeText(path.join(root, "ci", "scripts", "run_postv1_final_acceptance_boundary_runner.mjs"), "// fixture\n");
  writeText(path.join(root, "ci", "scripts", "run_postv1_promotion_readiness_runner.mjs"), "// fixture\n");
  writeText(path.join(root, "ci", "scripts", "run_postv1_release_closure_verifier.mjs"), "// fixture\n");
  writeText(path.join(root, "ci", "scripts", "run_postv1_release_claim_validator_boundary_adapter.mjs"), "// fixture\n");
  writeText(path.join(root, "ci", "scripts", "run_postv1_promotion_flow_legality_chain_verifier.mjs"), "// fixture\n");

  const declarationPath = path.join(root, "docs", "releases", "V1_RELEASE_BOUNDARY_DOC_SCRIPT_PARITY.json");
  writeJson(declarationPath, {
    parity_id: "v1_release_boundary_doc_script_parity",
    doc_paths: [
      "docs/releases/V1_FINAL_ACCEPTANCE_BOUNDARY.json",
      "docs/releases/V1_PROMOTION_READINESS.json",
      "docs/releases/V1_RELEASE_CLOSURE.json"
    ],
    script_paths: [
      "ci/scripts/run_postv1_final_acceptance_boundary_runner.mjs",
      "ci/scripts/run_postv1_promotion_readiness_runner.mjs",
      "ci/scripts/run_postv1_release_closure_verifier.mjs",
      "ci/scripts/run_postv1_release_claim_validator_boundary_adapter.mjs",
      "ci/scripts/run_postv1_promotion_flow_legality_chain_verifier.mjs"
    ],
    required_check_ids: [
      "final_acceptance_boundary",
      "promotion_readiness"
    ]
  });

  return { root, declarationPath };
}

test("P58: release boundary doc/script parity passes when declared docs and scripts agree", () => {
  const fixture = createFixture();
  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);

  assert.equal(status, 0);
  assert.equal(report.ok, true);
  assert.deepEqual(report.verified_check_ids, [
    "final_acceptance_boundary",
    "promotion_readiness"
  ]);
});

test("P58: release boundary doc/script parity fails when doc boundary references undeclared script surface", () => {
  const fixture = createFixture();

  writeJson(path.join(fixture.root, "docs", "releases", "V1_RELEASE_CLOSURE.json"), {
    closure_id: "v1_release_closure",
    post_merge_checks: [
      {
        check_id: "final_acceptance_boundary",
        script_path: "ci/scripts/run_postv1_final_acceptance_boundary_runner.mjs"
      },
      {
        check_id: "promotion_readiness",
        script_path: "ci/scripts/run_postv1_missing_script.mjs"
      }
    ]
  });

  const { status, report } = runVerifier(fixture.declarationPath, fixture.root);

  assert.equal(status, 1);
  assert.equal(report.ok, false);
  assert.ok(
    report.failures.some((failure) => failure.token === "parity_doc_script_contradiction"),
    `expected parity_doc_script_contradiction, got ${JSON.stringify(report, null, 2)}`
  );
});