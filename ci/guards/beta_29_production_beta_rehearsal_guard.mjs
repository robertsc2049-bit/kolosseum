// @law: Repo Governance
// @severity: high
// @scope: release
// DEV NOTE: BETA-29 production beta rehearsal composition guard.

import crypto from "node:crypto";
import fs from "node:fs";

let failed = false;

function fail(message) {
  failed = true;

  console.error(
    "CI_BETA_29_PRODUCTION_BETA_REHEARSAL::FAIL::" +
    message
  );
}

function read(relativePath) {
  if (!fs.existsSync(relativePath)) {
    fail(
      "missing::" +
      relativePath
    );

    return "";
  }

  return fs.readFileSync(
    relativePath,
    "utf8"
  );
}

function readJson(relativePath) {
  const text =
    read(relativePath);

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  }
  catch (error) {
    fail(
      "invalid_json::" +
      relativePath +
      "::" +
      String(
        error?.message ??
        error
      )
    );

    return null;
  }
}

function sha256File(relativePath) {
  return crypto
    .createHash("sha256")
    .update(
      fs.readFileSync(
        relativePath
      )
    )
    .digest("hex");
}

const files = {
  contract:
    "replay/contracts/beta29_production_beta_rehearsal_contract.json",
  manifest:
    "replay/suite/beta_phase1_8/production_beta_rehearsal_manifest.json",
  runner:
    "ci/scripts/run_beta_29_production_beta_rehearsal.mjs",
  test:
    "test/beta_29_production_beta_rehearsal.test.mjs",
  rehearsalDocument:
    "docs/releases/BETA_29_PRODUCTION_BETA_REHEARSAL.md",
  openingChecklist:
    "docs/releases/BETA_29_BETA_OPENING_CHECKLIST.md",
  package:
    "package.json",
  entrypoints:
    "ci/guards/_entrypoints.json",
  guardsIndex:
    "docs/GUARDS_INDEX.md",
  releaseWorkflow:
    ".github/workflows/release.yml",
  operationsRunbook:
    "docs/ops/V1_RUNBOOK.md",
  rollbackRunbook:
    "docs/releases/V1_ROLLBACK_RUNBOOK.md",
  releaseTag:
    "docs/releases/V1_RELEASE_TAG_PREPARATION.md"
};

const text = {};

for (
  const [key, relativePath]
  of Object.entries(files)
) {
  text[key] =
    read(relativePath);
}

const contract =
  readJson(files.contract);

const manifest =
  readJson(files.manifest);

const pkg =
  readJson(files.package);

const entrypoints =
  readJson(files.entrypoints);

if (
  contract?.slice_id !==
    "BETA-29" ||
  contract?.contract_id !==
    "beta29_production_beta_rehearsal" ||
  contract?.proof_command_windows !==
    "npm.cmd run rehearsal:beta"
) {
  fail(
    "contract_identity_invalid"
  );
}

const expectedAssertions = [
  "clean_individual_phase1_8",
  "coach_managed_path",
  "runner_verdict_accepted",
  "phase8_evidence_sealed",
  "projection_export_byte_identical",
  "evidence_export_byte_identical",
  "forbidden_copy_scan_passed",
  "org_team_unit_gym_runtime_unreachable"
];

if (
  JSON.stringify(
    contract?.required_assertions
  ) !==
  JSON.stringify(
    expectedAssertions
  )
) {
  fail(
    "required_assertions_invalid"
  );
}

for (
  const boundary
  of [
    "new_product_features",
    "engine_behavior_changed",
    "registry_content_changed",
    "runtime_scope_broadened",
    "release_tag_created",
    "production_data_accessed",
    "production_secret_values_recorded"
  ]
) {
  if (
    contract?.boundaries?.[boundary] !==
      false
  ) {
    fail(
      "boundary_invalid::" +
      boundary
    );
  }
}

if (
  manifest?.slice_id !==
    "BETA-29" ||
  manifest?.schema_version !==
    "kolosseum.beta29.production_beta_rehearsal_manifest.v1.0.0" ||
  manifest?.source_count !==
    Object.keys(
      manifest?.paths ??
      {}
    ).length
) {
  fail(
    "manifest_identity_invalid"
  );
}

for (
  const [key, relativePath]
  of Object.entries(
    manifest?.paths ??
    {}
  )
) {
  if (!fs.existsSync(relativePath)) {
    fail(
      "manifest_source_missing::" +
      key +
      "::" +
      relativePath
    );

    continue;
  }

  if (
    manifest?.sha256?.[key] !==
    sha256File(relativePath)
  ) {
    fail(
      "manifest_hash_mismatch::" +
      key
    );
  }
}

if (
  pkg?.scripts?.["rehearsal:beta"] !==
    "node ci/scripts/run_beta_29_production_beta_rehearsal.mjs && node ci/guards/beta_29_production_beta_rehearsal_guard.mjs" ||
  pkg?.scripts?.["proof:beta-29"] !==
    "npm run rehearsal:beta" ||
  !pkg?.scripts?.["lint:fast:inline"]
    ?.includes(
      "npm run proof:beta-29"
    )
) {
  fail(
    "package_script_wiring_invalid"
  );
}

if (
  !entrypoints?.package_json_scripts
    ?.includes(
      "proof:beta-29"
    )
) {
  fail(
    "guard_entrypoint_missing"
  );
}

if (
  !text.guardsIndex.includes(
    "beta_29_production_beta_rehearsal_guard.mjs"
  )
) {
  fail(
    "guards_index_missing"
  );
}

for (
  const required
  of [
    "test/beta_29_production_beta_rehearsal.test.mjs",
    "ci/scripts/run_beta_22_replay_verify.mjs",
    "ci/scripts/kolosseum_v0_test_suite.mjs",
    "ci/scripts/run_beta_28_secret_scan.mjs",
    "ci/scripts/run_beta_28_dependency_audit.mjs",
    "CI_BETA_29_PRODUCTION_BETA_REHEARSAL::PASS"
  ]
) {
  if (!text.runner.includes(required)) {
    fail(
      "runner_stage_missing::" +
      required
    );
  }
}

for (
  const required
  of [
    "beta21_individual_powerlifting",
    "beta21_coach_managed_rugby_union",
    "ACCEPTED",
    "phase8_evidence_envelope_json",
    "phase7_projection_json",
    "org_managed",
    "team_managed",
    "unit_managed",
    "gym_managed"
  ]
) {
  if (!text.test.includes(required)) {
    fail(
      "integrated_test_marker_missing::" +
      required
    );
  }
}

for (
  const required
  of [
    "# BETA-29 Production Beta Rehearsal",
    "npm.cmd run rehearsal:beta",
    "Phase 1 through Phase 8",
    "byte-identical",
    "No product feature"
  ]
) {
  if (
    !text.rehearsalDocument
      .includes(required)
  ) {
    fail(
      "rehearsal_document_marker_missing::" +
      required
    );
  }
}

for (
  const required
  of [
    "## Beta opening checklist",
    "## Rollback checklist",
    "## Release tag checklist",
    "## Support and incident checklist",
    "OPEN or DO NOT OPEN",
    "npm.cmd run rehearsal:beta"
  ]
) {
  if (
    !text.openingChecklist
      .includes(required)
  ) {
    fail(
      "opening_checklist_marker_missing::" +
      required
    );
  }
}

for (
  const required
  of [
    "incident_recording",
    "pause_conditions",
    "daily_close"
  ]
) {
  if (
    !text.operationsRunbook
      .includes(required)
  ) {
    fail(
      "operations_runbook_marker_missing::" +
      required
    );
  }
}

for (
  const required
  of [
    "historical truth",
    "registry",
    "replay",
    "evidence"
  ]
) {
  if (
    !text.rollbackRunbook
      .toLowerCase()
      .includes(
        required.toLowerCase()
      )
  ) {
    fail(
      "rollback_marker_missing::" +
      required
    );
  }
}

for (
  const required
  of [
    "npm.cmd run acceptance:v1:check",
    "Candidate tag",
    "working tree is dirty"
  ]
) {
  if (
    !text.releaseTag
      .includes(required)
  ) {
    fail(
      "release_tag_marker_missing::" +
      required
    );
  }
}

for (
  const required
  of [
    '- "rc-*"',
    "npm run ci",
    "npm run determinism:check",
    "/health"
  ]
) {
  if (
    !text.releaseWorkflow
      .includes(required)
  ) {
    fail(
      "release_workflow_marker_missing::" +
      required
    );
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  "CI_BETA_29_PRODUCTION_BETA_REHEARSAL::PASS"
);
