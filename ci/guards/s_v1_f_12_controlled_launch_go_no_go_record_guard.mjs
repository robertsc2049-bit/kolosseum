// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * @file S-V1-F-12 controlled launch go/no-go record guard.
 * @desc Proves the final controlled launch GO/NO-GO record is evidence-based and bounded.
 *
 * DEV NOTE: S-V1-F-12 guard. This guard protects the final controlled launch
 * decision record from becoming product code, engine behaviour, acceptance law,
 * release-tag authority, commercial authority, or post-v1 scope activation.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const TOKEN = "CI_V1_CONTROLLED_LAUNCH_GO_NO_GO_RECORD";
const EXPECTED_PROOF = "node --test test/s_v1_f_12_controlled_launch_go_no_go_record.test.mjs && node ci/guards/s_v1_f_12_controlled_launch_go_no_go_record_guard.mjs && node ci/scripts/run_s_v1_f_12_controlled_launch_go_no_go_record.mjs --check";

const REQUIRED_FILES = [
  "docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.md",
  "docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.json",
  "docs/releases/V1_FINAL_SHIP_DECISION.md",
  "docs/releases/V1_FINAL_SHIP_DECISION.json",
  "docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.md",
  "docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json",
  "docs/releases/CONTROLLED_LAUNCH_EXECUTION_PACK.md",
  "docs/releases/CONTROLLED_LAUNCH_EXECUTION_PACK.json",
  "docs/releases/CONTROLLED_LAUNCH_SMOKE_RUN.md",
  "docs/releases/CONTROLLED_LAUNCH_SMOKE_RUN.json",
  "docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.md",
  "docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.json",
  "docs/v1/V1_ACCEPTANCE_GATE_MANIFEST.json",
  "test/s_v1_f_12_controlled_launch_go_no_go_record.test.mjs",
  "ci/guards/s_v1_f_12_controlled_launch_go_no_go_record_guard.mjs",
  "ci/scripts/run_s_v1_f_12_controlled_launch_go_no_go_record.mjs"
];

const REQUIRED_DOC_LINKS = [
  {
    path: "docs/v1/V1_ACCEPTANCE_GATE.md",
    phrase: "## S-V1-F-12 Controlled Launch Go/No-Go Record"
  },
  {
    path: "docs/v1/V1_RELEASE_BOUNDARY.md",
    phrase: "## S-V1-F-12 Controlled Launch Go/No-Go Record"
  },
  {
    path: "docs/v1/V1_NOT_IN_SCOPE.md",
    phrase: "## S-V1-F-12 Controlled Launch Go/No-Go Record Non-Scope"
  },
  {
    path: "docs/v1/V1_DOC_AUTHORITY_MAP.md",
    phrase: "## S-V1-F-12 Controlled Launch Go/No-Go Record Authority"
  }
];

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: "S-V1-F-12",
    token: TOKEN,
    message,
    details
  }, null, 2));
  process.exitCode = 1;
}

function assert(condition, message, details = {}) {
  if (!condition) {
    throw Object.assign(new Error(message), { details });
  }
}

try {
  for (const file of REQUIRED_FILES) {
    assert(fs.existsSync(path.join(ROOT, file)), "S-V1-F-12 required file missing.", { file });
  }

  for (const link of REQUIRED_DOC_LINKS) {
    const text = readText(link.path);
    assert(text.includes(link.phrase), "S-V1-F-12 required authority link missing.", link);
  }

  const record = readJson("docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.json");
  const markdown = readText("docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.md");
  const pkg = readJson("package.json");

  assert(record.schema_version === "1.0.0", "schema_version mismatch.", { actual: record.schema_version });
  assert(record.slice_id === "S-V1-F-12", "slice_id mismatch.", { actual: record.slice_id });
  assert(record.record_id === "controlled_launch_go_no_go_record", "record_id mismatch.", { actual: record.record_id });
  assert(["GO", "NO-GO"].includes(record.decision), "decision must be GO or NO-GO.", { actual: record.decision });
  assert(record.decision_scope === "controlled_launch_only", "decision_scope mismatch.", { actual: record.decision_scope });

  assert(record.release_identity?.tag_name === "v1-controlled-launch", "tag name mismatch.");
  assert(record.release_identity?.expected_tag_commit === "43510e4c4d791effda647e80dc74d8452dc61f1f", "expected tag commit mismatch.");
  assert(record.release_identity?.verified_tag_commit === "43510e4c4d791effda647e80dc74d8452dc61f1f", "verified tag commit mismatch.");
  assert(record.release_identity?.tag_commit_match === true, "tag commit match must be true.");

  const rules = record.decision_rules ?? {};
  assert(rules.evidence_based_decision_required === true, "evidence-based rule missing.");
  assert(rules.any_failed_required_item_means_no_go === true, "NO-GO blocker rule missing.");
  assert(rules.incomplete_completion_wording_forbidden === true, "incomplete wording rule missing.");
  assert(rules.go_scope_is_controlled_launch_only === true, "controlled launch GO scope rule missing.");
  assert(rules.go_authorises_open_availability === false, "GO must not authorise open availability.");
  assert(rules.product_code_change_allowed === false, "product code non-scope missing.");
  assert(rules.engine_behaviour_change_allowed === false, "engine behaviour non-scope missing.");
  assert(rules.feature_implementation_allowed === false, "feature implementation non-scope missing.");
  assert(rules.acceptance_gate_law_change_allowed === false, "acceptance law non-scope missing.");
  assert(rules.release_tag_change_allowed === false, "release tag non-scope missing.");
  assert(rules.post_v1_scope_activation_allowed === false, "post-v1 non-scope missing.");

  const requiredItems = Array.isArray(record.required_items) ? record.required_items : [];
  assert(requiredItems.length >= 8, "required item count too small.", { actual: requiredItems.length });

  const failedRequiredItems = requiredItems.filter((item) => item.required === true && item.passed !== true);
  if (failedRequiredItems.length > 0) {
    assert(record.decision === "NO-GO", "failed required items must force NO-GO.", { failedRequiredItems });
    assert(typeof record.blocked_reason === "string" && record.blocked_reason.length > 0, "NO-GO requires blocked_reason.");
  }

  if (record.decision === "GO") {
    assert(failedRequiredItems.length === 0, "GO requires all required items to pass.");
    assert(record.blocked_reason === null, "GO must not carry blocked_reason.");
    assert(Array.isArray(record.failed_required_items) && record.failed_required_items.length === 0, "GO must list no failed required items.");
    assert(record.source_evidence?.final_ship_decision?.decision === "SHIP", "GO requires SHIP final decision.");
    assert(record.source_evidence?.release_evidence_snapshot?.status === "recorded", "GO requires recorded release evidence.");
    assert(record.source_evidence?.controlled_launch_execution_pack?.status === "prepared", "GO requires prepared launch execution pack.");
    assert(record.source_evidence?.controlled_launch_smoke_run?.status === "pass", "GO requires passed smoke.");
    assert(record.source_evidence?.controlled_launch_smoke_run?.failed_required_command_count === 0, "GO requires zero failed smoke commands.");
    assert(record.source_evidence?.controlled_launch_smoke_run?.launch_blocker_recorded === false, "GO requires no smoke blocker.");
    assert(record.permitted_next_action === "start_controlled_launch_for_named_founder_group_only", "GO permitted next action mismatch.");
  }

  for (const [key, value] of Object.entries(record.claim_boundary ?? {})) {
    assert(value === false, "claim boundary value must remain false.", { key, value });
  }

  for (const phrase of [
    "partial-complete",
    "partial complete",
    "partially complete",
    "partially-complete",
    "almost complete",
    "nearly complete",
    "mostly complete",
    "guaranteed outcome",
    "guarantees outcomes",
    "athlete clearance",
    "coach clearance",
    "return to play",
    "return-to-play",
    "return to run",
    "return-to-run",
    "fitness for duty",
    "fitness-for-duty",
    "recommended programme",
    "optimal programme"
  ]) {
    assert(!`${markdown}\n${JSON.stringify(record)}`.toLowerCase().includes(phrase), "forbidden wording found.", { phrase });
  }

  assert(markdown.includes("# Controlled Launch Go/No-Go Record"), "markdown title missing.");
  assert(markdown.includes("Any failed required item means NO-GO."), "NO-GO decision rule missing.");
  assert(markdown.includes("GO authorises controlled launch for the named founder group only."), "GO controlled-launch-only wording missing.");
  assert(markdown.includes("This record is a decision record and evidence reference only."), "decision-only boundary missing.");

  assert(pkg.scripts?.["proof:s-v1-f-12"] === EXPECTED_PROOF, "proof:s-v1-f-12 script mismatch.", {
    actual: pkg.scripts?.["proof:s-v1-f-12"]
  });
  assert(pkg.scripts?.["acceptance:v1:go-no-go:check"] === "node ci/scripts/run_s_v1_f_12_controlled_launch_go_no_go_record.mjs --check", "go/no-go check script mismatch.");
  assert(pkg.scripts?.["lint:fast"]?.includes(EXPECTED_PROOF), "lint:fast does not include S-V1-F-12 gate.");
  assert(pkg.scripts?.["lint:fast:inline"]?.includes(EXPECTED_PROOF), "lint:fast:inline does not include S-V1-F-12 gate.");

  const runnerResult = spawnSync(process.execPath, ["ci/scripts/run_s_v1_f_12_controlled_launch_go_no_go_record.mjs", "--check"], {
    cwd: ROOT,
    encoding: "utf8"
  });

  if (runnerResult.status !== 0) {
    throw Object.assign(new Error("S-V1-F-12 runner check failed."), {
      details: {
        status: runnerResult.status,
        stdout: runnerResult.stdout,
        stderr: runnerResult.stderr
      }
    });
  }

  assert(runnerResult.stdout.includes("S-V1-F-12 CONTROLLED_LAUNCH_GO_NO_GO_CHECK_PASS"), "runner success marker missing.");

  console.log(JSON.stringify({
    ok: true,
    guard: "S-V1-F-12",
    token: TOKEN,
    decision: record.decision,
    message: "Controlled launch go/no-go record passed."
  }, null, 2));
} catch (error) {
  fail(error.message, error.details ?? {});
}
