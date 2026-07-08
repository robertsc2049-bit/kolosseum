#!/usr/bin/env node
/**
 * DEV NOTE: S-V0-31 active-scope negative fixture runner.
 * Purpose: prove the existing v0 active scope guard rejects known post-v0/v1
 * leakage when it appears inside an active scanned code surface.
 * Boundary: this script does not add v1 features, does not weaken the active
 * guard, and does not mark future docs as active. It creates one temporary
 * probe file at a time, runs the real active-scope guard, then removes it.
 * Failure: emits the existing V0_ACTIVE_SCOPE_NEGATIVE_TESTS token and exits
 * non-zero if any forbidden fixture is not rejected by the active guard.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const fixturePath = "ci/fixtures/v0_active_scope_negative/s_v0_31_post_v0_v1_leakage.json";
const activeGuardPath = "ci/scripts/run_v0_active_scope_guard.mjs";
const existingNegativeRunnerPath = "ci/scripts/run_v0_active_scope_negative_tests.mjs";

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    token: "V0_ACTIVE_SCOPE_NEGATIVE_TESTS",
    guard: "s_v0_31_v0_active_scope_negative_fixture_runner",
    message,
    ...details
  }, null, 2));
  process.exit(1);
}

function readJson(relPath) {
  const absPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(absPath)) {
    fail("Required fixture file is missing.", { path: relPath });
  }

  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function ensureActiveSurfacesPresent() {
  for (const relPath of [activeGuardPath, existingNegativeRunnerPath]) {
    if (!fs.existsSync(path.join(repoRoot, relPath))) {
      fail("Required active-scope script is missing.", { path: relPath });
    }
  }
}

function runNodeScript(relPath) {
  return spawnSync(process.execPath, [relPath], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false
  });
}

function writeProbe(relPath, source) {
  const absPath = path.join(repoRoot, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, source.replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8");
}

function removeProbe(relPath) {
  const absPath = path.join(repoRoot, relPath);
  if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
}

ensureActiveSurfacesPresent();

const fixture = readJson(fixturePath);

if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) {
  fail("Fixture pack must be a JSON object.", { path: fixturePath });
}

if (fixture.fixture_pack_id !== "s_v0_31_v0_active_scope_negative_fixtures") {
  fail("Unexpected fixture pack id.", { actual: fixture.fixture_pack_id });
}

if (!Array.isArray(fixture.cases) || fixture.cases.length < 7) {
  fail("Fixture pack must contain the S-V0-31 negative cases.", { count: Array.isArray(fixture.cases) ? fixture.cases.length : null });
}

const probePath = fixture.probe_path;
if (probePath !== "shared/pilot-lifecycle/__s_v0_31_negative_probe__.mjs") {
  fail("Unexpected probe path.", { probe_path: probePath });
}

const requiredCaseIds = new Set([
  "post_v1_team_runtime_rejected",
  "post_v1_organisation_dashboard_rejected",
  "billing_driven_engine_behaviour_rejected",
  "recommendation_language_rejected",
  "proof_export_surface_rejected",
  "readiness_runtime_semantic_rejected",
  "auto_progression_surface_rejected"
]);

for (const required of requiredCaseIds) {
  if (!fixture.cases.some((candidate) => candidate.case_id === required)) {
    fail("Required S-V0-31 negative case is missing.", { case_id: required });
  }
}

const results = [];

try {
  removeProbe(probePath);

  const cleanBefore = runNodeScript(activeGuardPath);
  if (cleanBefore.status !== 0) {
    fail("Active scope guard must pass before injecting S-V0-31 negative probes.", {
      status: cleanBefore.status,
      stdout: cleanBefore.stdout,
      stderr: cleanBefore.stderr
    });
  }

  const existingNegative = runNodeScript(existingNegativeRunnerPath);
  if (existingNegative.status !== 0) {
    fail("Existing active scope negative tests must pass before S-V0-31 probes.", {
      status: existingNegative.status,
      stdout: existingNegative.stdout,
      stderr: existingNegative.stderr
    });
  }

  for (const testCase of fixture.cases) {
    if (!testCase.case_id || !testCase.expected_token || !testCase.expected_match_label || !testCase.probe_source) {
      fail("Malformed S-V0-31 negative case.", { case: testCase });
    }

    writeProbe(probePath, testCase.probe_source);

    const run = runNodeScript(activeGuardPath);
    const combined = `${run.stdout || ""}\n${run.stderr || ""}`;

    removeProbe(probePath);

    if (run.status === 0) {
      fail("Active scope guard accepted a forbidden S-V0-31 negative probe.", {
        case_id: testCase.case_id,
        expected_token: testCase.expected_token,
        expected_match_label: testCase.expected_match_label,
        stdout: run.stdout,
        stderr: run.stderr
      });
    }

    if (!combined.includes(testCase.expected_token)) {
      fail("Active scope guard rejected the probe but did not emit the expected token.", {
        case_id: testCase.case_id,
        expected_token: testCase.expected_token,
        expected_match_label: testCase.expected_match_label,
        status: run.status,
        stdout: run.stdout,
        stderr: run.stderr
      });
    }

    results.push({
      case_id: testCase.case_id,
      expected_token: testCase.expected_token,
      rejected: true
    });
  }
} finally {
  removeProbe(probePath);
}

const cleanAfter = runNodeScript(activeGuardPath);
if (cleanAfter.status !== 0) {
  fail("Active scope guard must pass after S-V0-31 probe cleanup.", {
    status: cleanAfter.status,
    stdout: cleanAfter.stdout,
    stderr: cleanAfter.stderr
  });
}

const existingNegativeAfter = runNodeScript(existingNegativeRunnerPath);
if (existingNegativeAfter.status !== 0) {
  fail("Existing active scope negative tests must still pass after S-V0-31 probes.", {
    status: existingNegativeAfter.status,
    stdout: existingNegativeAfter.stdout,
    stderr: existingNegativeAfter.stderr
  });
}

console.log(JSON.stringify({
  ok: true,
  guard: "s_v0_31_v0_active_scope_negative_fixture_runner",
  fixture_path: fixturePath,
  probe_path: probePath,
  cases_checked: results.length,
  results
}, null, 2));
