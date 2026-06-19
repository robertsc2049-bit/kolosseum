#!/usr/bin/env node
/**
 * DEV NOTE: S-V1-F-12 controlled launch go/no-go runner.
 * Purpose: validates the final controlled launch GO/NO-GO decision record as
 * an evidence-bound decision surface only. It does not authorise product code,
 * engine behaviour, acceptance law, release-tag mutation, or post-v1 scope.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const JSON_PATH = "docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.json";
const MD_PATH = "docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.md";

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    runner: "S-V1-F-12",
    token: "controlled_launch_go_no_go_record_invalid",
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

function validate() {
  const missing = [JSON_PATH, MD_PATH].filter((relativePath) => {
    return !fs.existsSync(path.join(ROOT, relativePath));
  });

  assert(missing.length === 0, "S-V1-F-12 required decision files missing.", { missing });

  const record = readJson(JSON_PATH);
  const markdown = readText(MD_PATH);

  assert(record.schema_version === "1.0.0", "schema_version mismatch.", { actual: record.schema_version });
  assert(record.slice_id === "S-V1-F-12", "slice_id mismatch.", { actual: record.slice_id });
  assert(record.record_id === "controlled_launch_go_no_go_record", "record_id mismatch.", { actual: record.record_id });
  assert(record.title === "Controlled Launch Go/No-Go Record", "title mismatch.", { actual: record.title });
  assert(["GO", "NO-GO"].includes(record.decision), "decision must be GO or NO-GO.", { actual: record.decision });
  assert(record.decision_scope === "controlled_launch_only", "decision_scope mismatch.", { actual: record.decision_scope });

  const expectedTagCommit = "43510e4c4d791effda647e80dc74d8452dc61f1f";
  assert(record.release_identity?.tag_name === "v1-controlled-launch", "tag name mismatch.");
  assert(record.release_identity?.expected_tag_commit === expectedTagCommit, "expected tag commit mismatch.");
  assert(record.release_identity?.verified_tag_commit === expectedTagCommit, "verified tag commit mismatch.");
  assert(record.release_identity?.tag_commit_match === true, "tag commit must match.");

  const rules = record.decision_rules ?? {};
  const requiredRules = {
    evidence_based_decision_required: true,
    any_failed_required_item_means_no_go: true,
    incomplete_completion_wording_forbidden: true,
    go_scope_is_controlled_launch_only: true,
    go_authorises_open_availability: false,
    product_code_change_allowed: false,
    engine_behaviour_change_allowed: false,
    feature_implementation_allowed: false,
    acceptance_gate_law_change_allowed: false,
    release_tag_change_allowed: false,
    post_v1_scope_activation_allowed: false
  };

  for (const [key, expected] of Object.entries(requiredRules)) {
    assert(rules[key] === expected, "decision rule mismatch.", { key, actual: rules[key], expected });
  }

  const requiredItems = Array.isArray(record.required_items) ? record.required_items : [];
  assert(requiredItems.length >= 8, "required_items count too small.", { actual: requiredItems.length });

  const failedRequiredItems = requiredItems.filter((item) => item.required === true && item.passed !== true);
  if (failedRequiredItems.length > 0) {
    assert(record.decision === "NO-GO", "failed required item must force NO-GO.", { failedRequiredItems });
    assert(typeof record.blocked_reason === "string" && record.blocked_reason.length > 0, "NO-GO requires blocked_reason.");
  }

  if (record.decision === "GO") {
    assert(failedRequiredItems.length === 0, "GO requires all required items to pass.", { failedRequiredItems });
    assert(record.blocked_reason === null, "GO must not carry blocked_reason.");
    assert(Array.isArray(record.failed_required_items) && record.failed_required_items.length === 0, "GO must not list failed required items.");
    assert(record.source_evidence?.final_ship_decision?.decision === "SHIP", "GO requires SHIP final decision.");
    assert(record.source_evidence?.release_evidence_snapshot?.status === "recorded", "GO requires recorded release evidence snapshot.");
    assert(record.source_evidence?.controlled_launch_execution_pack?.status === "prepared", "GO requires prepared launch execution pack.");
    assert(record.source_evidence?.controlled_launch_smoke_run?.status === "pass", "GO requires passed smoke run.");
    assert(record.source_evidence?.controlled_launch_smoke_run?.failed_required_command_count === 0, "GO requires zero failed required smoke commands.");
    assert(record.source_evidence?.controlled_launch_smoke_run?.launch_blocker_recorded === false, "GO requires no recorded launch blocker.");
  }

  const boundaries = record.boundaries ?? {};
  const requiredBoundaries = {
    decision_record_only: true,
    touches_product_code: false,
    touches_engine_behaviour: false,
    touches_feature_implementation: false,
    changes_acceptance_gate_law: false,
    changes_release_tag: false,
    activates_post_v1_scope: false,
    creates_open_signup: false,
    creates_marketplace_scope: false,
    creates_organisation_scope: false,
    creates_gym_scope: false,
    creates_team_scope: false,
    creates_federation_scope: false,
    creates_messaging_scope: false,
    creates_commercial_claims: false
  };

  for (const [key, expected] of Object.entries(requiredBoundaries)) {
    assert(boundaries[key] === expected, "boundary mismatch.", { key, actual: boundaries[key], expected });
  }

  for (const [key, value] of Object.entries(record.claim_boundary ?? {})) {
    assert(value === false, "claim boundary value must remain false.", { key, value });
  }

  const forbiddenDecisionText = [
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
  ];

  const combined = `${markdown}\n${JSON.stringify(record)}`.toLowerCase();
  for (const phrase of forbiddenDecisionText) {
    assert(!combined.includes(phrase), "forbidden wording found.", { phrase });
  }

  assert(markdown.includes("# Controlled Launch Go/No-Go Record"), "markdown title missing.");
  assert(markdown.includes(`Decision: ${record.decision}`), "markdown decision mismatch.");
  assert(markdown.includes("Any failed required item means NO-GO."), "NO-GO rule wording missing.");
  assert(markdown.includes("GO authorises controlled launch for the named founder group only."), "controlled launch GO scope wording missing.");
  assert(markdown.includes("This record is a decision record and evidence reference only."), "decision-only boundary missing.");

  return {
    ok: true,
    runner: "S-V1-F-12",
    decision: record.decision,
    message: "S-V1-F-12 controlled launch go/no-go record is valid."
  };
}

try {
  const result = validate();
  console.log(JSON.stringify(result, null, 2));
  console.log("S-V1-F-12 CONTROLLED_LAUNCH_GO_NO_GO_CHECK_PASS");
} catch (error) {
  fail(error.message, error.details ?? {});
}
