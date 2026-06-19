import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const token = "CI_V1_REGISTRY_WORKABILITY_AUDIT_LAUNCH_HOLD";

function fail(message) {
  console.error(JSON.stringify({ ok: false, runner: "S-V1-G-02", token, message }, null, 2));
  process.exitCode = 1;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function runRegistryLawCounts() {
  const result = spawnSync(process.execPath, ["ci/guards/registry_law_guard.mjs"], {
    cwd: root,
    encoding: "utf8"
  });

  const output = `${result.stdout || ""}\n${result.stderr || ""}`;

  if (result.status !== 0) {
    throw new Error(`registry_law_guard failed while collecting counts:\n${output}`);
  }

  const match = output.match(/activity=(\d+), movement=(\d+), exercise=(\d+), program=(\d+)/);
  if (!match) {
    throw new Error(`Could not parse registry_law_guard counts from output:\n${output}`);
  }

  return {
    activity: Number(match[1]),
    movement: Number(match[2]),
    exercise: Number(match[3]),
    program: Number(match[4])
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const recordPath = "docs/releases/CONTROLLED_LAUNCH_REGISTRY_WORKABILITY_HOLD.json";
  const markdownPath = "docs/releases/CONTROLLED_LAUNCH_REGISTRY_WORKABILITY_HOLD.md";
  const goRecordPath = "docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.json";
  const smokeRunPath = "docs/releases/CONTROLLED_LAUNCH_SMOKE_RUN.md";

  assert(fs.existsSync(path.join(root, recordPath)), `Missing ${recordPath}`);
  assert(fs.existsSync(path.join(root, markdownPath)), `Missing ${markdownPath}`);
  assert(fs.existsSync(path.join(root, goRecordPath)), `Missing ${goRecordPath}`);
  assert(fs.existsSync(path.join(root, smokeRunPath)), `Missing ${smokeRunPath}`);

  const record = readJson(recordPath);
  const goRecord = readJson(goRecordPath);
  const currentCounts = runRegistryLawCounts();

  assert(record.slice_id === "S-V1-G-02", "slice_id mismatch");
  assert(record.record_id === "controlled_launch_registry_workability_hold", "record_id mismatch");
  assert(record.token === token, "token mismatch");
  assert(record.status === "HOLD", "status must be HOLD");
  assert(record.operational_launch_status === "HOLD_REGISTRY_WORKABILITY_NOT_PROVEN", "operational launch status mismatch");
  assert(record.controlled_launch_user_start_authorised === false, "controlled launch user start must be false");
  assert(record.decision_scope === "controlled_launch_only", "decision scope mismatch");

  assert(goRecord.decision === "GO", "S-V1-F-12 GO record should remain GO");
  assert(record.recorded_after.go_no_go_decision === goRecord.decision, "recorded GO decision mismatch");
  assert(record.recorded_after.go_no_go_scope === goRecord.decision_scope, "recorded GO scope mismatch");

  for (const key of ["activity", "movement", "exercise", "program"]) {
    assert(record.registry_law_counts[key] === currentCounts[key], `registry_law_counts.${key} does not match current registry law guard output`);
  }

  assert(record.workability_findings.structural_registry_gates_pass === true, "structural gate observation must be true");
  assert(record.workability_findings.registry_content_workability_proven === false, "registry content workability must not be marked proven");
  assert(record.workability_findings.minimum_real_execution_content_proven === false, "minimum real execution content must not be marked proven");
  assert(record.workability_findings.real_coach_athlete_launch_path_with_current_registry_content_proven === false, "real launch path must not be marked proven");
  assert(record.workability_findings.release_go_record_changes_registry_content === false, "GO record must not change registry content");
  assert(record.workability_findings.smoke_run_changes_registry_content === false, "smoke run must not change registry content");

  const requiredCodes = [
    "REGISTRY_WORKABILITY_NOT_PROVEN",
    "MINIMUM_REAL_EXECUTION_CONTENT_NOT_PROVEN",
    "CONTROLLED_LAUNCH_GO_RECORD_IS_NOT_REGISTRY_CONTENT_PROOF"
  ];

  for (const code of requiredCodes) {
    assert(record.blocker_reason_codes.includes(code), `Missing blocker reason code: ${code}`);
  }

  assert(record.invariants.decision_record_only === true, "record must be decision-only");
  assert(record.invariants.does_not_change_existing_go_no_go_record === true, "must not change existing GO record");
  assert(record.invariants.does_not_change_release_tag === true, "must not change release tag");
  assert(record.invariants.does_not_change_product_code === true, "must not change product code");
  assert(record.invariants.does_not_change_engine_code === true, "must not change engine code");
  assert(record.invariants.does_not_change_registry_content === true, "must not change registry content");
  assert(record.invariants.does_not_change_acceptance_gate_law === true, "must not change acceptance gate law");
  assert(record.invariants.does_not_authorise_open_availability === true, "must not authorise open availability");
  assert(record.invariants.does_not_authorise_post_v1_scope === true, "must not authorise post-v1 scope");
  assert(record.invariants.no_coaching_advice === true, "must not create coaching advice");
  assert(record.invariants.no_safety_readiness_or_optimisation_claims === true, "must not create safety readiness or optimisation claims");

  const markdown = fs.readFileSync(path.join(root, markdownPath), "utf8");
  const requiredMarkdown = [
    "Operational launch status: HOLD_REGISTRY_WORKABILITY_NOT_PROVEN",
    "Controlled launch user start authorised: false",
    "structural gates are not the same as a workable registry",
    "Operational launch status: HOLD until registry workability is proven",
    "do not start real controlled launch users from the current registry state"
  ];

  for (const text of requiredMarkdown) {
    assert(markdown.includes(text), `Markdown missing required text: ${text}`);
  }

  console.log(JSON.stringify({
    ok: true,
    runner: "S-V1-G-02",
    token,
    status: record.status,
    operational_launch_status: record.operational_launch_status,
    registry_law_counts: currentCounts,
    message: "Registry workability audit launch hold is valid."
  }, null, 2));
  console.log("S-V1-G-02 REGISTRY_WORKABILITY_AUDIT_LAUNCH_HOLD_CHECK_PASS");
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
