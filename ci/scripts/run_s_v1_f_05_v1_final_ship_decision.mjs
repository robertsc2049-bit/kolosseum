#!/usr/bin/env node
/**
 * DEV NOTE: S-V1-F-05 final ship decision runner.
 * Purpose: validates the final v1 ship decision record as a release evidence
 * surface only. It does not create product law, engine law, registry law,
 * tag authority, package-version authority, or feature implementation authority.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const JSON_PATH = "docs/releases/V1_FINAL_SHIP_DECISION.json";
const MD_PATH = "docs/releases/V1_FINAL_SHIP_DECISION.md";

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    runner: "S-V1-F-05",
    token: "v1_final_ship_decision_invalid",
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

  assert(missing.length === 0, "S-V1-F-05 required decision files missing.", { missing });

  const record = readJson(JSON_PATH);
  const markdown = readText(MD_PATH);

  assert(record.record_id === "v1_final_ship_decision", "record_id mismatch.", { actual: record.record_id });
  assert(record.slice_id === "S-V1-F-05", "slice_id mismatch.", { actual: record.slice_id });
  assert(record.title === "V1 Final Ship Decision", "title mismatch.", { actual: record.title });
  assert(["SHIP", "BLOCKED"].includes(record.decision), "decision must be SHIP or BLOCKED.", { actual: record.decision });
  assert(record.decision_scope === "controlled_v1", "decision_scope mismatch.", { actual: record.decision_scope });

  const rules = record.ship_blocking_rules ?? {};
  const requiredRuleValues = {
    evidence_based_decision_required: true,
    failed_acceptance_item_blocks_v1: true,
    incomplete_v1_completion_wording_forbidden: true,
    product_code_change_allowed: false,
    feature_implementation_allowed: false,
    release_tag_creation_allowed: false,
    package_version_change_allowed: false,
    engine_behaviour_change_allowed: false,
    registry_content_change_allowed: false,
    post_v1_scope_activation_allowed: false
  };

  for (const [key, expected] of Object.entries(requiredRuleValues)) {
    assert(rules[key] === expected, "ship blocking rule mismatch.", { key, actual: rules[key], expected });
  }

  const evidence = Array.isArray(record.required_evidence) ? record.required_evidence : [];
  const requiredCommands = [
    "npm.cmd run acceptance:v1:check",
    "npm.cmd run proof:s-v1-f-04",
    "npm.cmd run lint:fast"
  ];

  for (const command of requiredCommands) {
    assert(
      evidence.some((item) => item.label === command && item.command === command),
      "required evidence command missing.",
      { command }
    );
  }

  const mainline = record.mainline_evidence ?? {};
  assert(typeof mainline.head_sha === "string" && /^[0-9a-f]{40}$/.test(mainline.head_sha), "head_sha must be a git SHA.");
  assert(typeof mainline.origin_main_sha === "string" && /^[0-9a-f]{40}$/.test(mainline.origin_main_sha), "origin_main_sha must be a git SHA.");
  assert(typeof mainline.main_clean_before_decision === "boolean", "main clean evidence must be boolean.");
  assert(typeof mainline.head_equals_origin_main === "boolean", "main/origin equality evidence must be boolean.");
  assert(typeof mainline.required_checks_green === "boolean", "required checks evidence must be boolean.");

  if (record.decision === "SHIP") {
    assert(mainline.main_clean_before_decision === true, "SHIP requires clean main evidence.");
    assert(mainline.head_equals_origin_main === true, "SHIP requires HEAD to equal origin/main.");
    assert(mainline.required_checks_green === true, "SHIP requires required checks green.");
    for (const item of evidence) {
      assert(item.exit_code === 0 && item.passed === true, "SHIP requires every evidence command to pass.", item);
    }
    assert(record.blocked_reason === null, "SHIP must not carry a blocked reason.");
  }

  if (record.decision === "BLOCKED") {
    assert(typeof record.blocked_reason === "string" && record.blocked_reason.length > 0, "BLOCKED requires blocked_reason.");
  }

  const forbiddenDecisionText = [
    "partial-complete",
    "partial complete",
    "almost complete",
    "nearly complete",
    "mostly complete"
  ];

  const combined = `${markdown}\n${JSON.stringify(record)}`.toLowerCase();
  for (const phrase of forbiddenDecisionText) {
    assert(!combined.includes(phrase), "forbidden incomplete completion wording found.", { phrase });
  }

  assert(markdown.includes("# V1 Final Ship Decision"), "markdown title missing.");
  assert(markdown.includes(`Decision: ${record.decision}`), "markdown decision mismatch.");
  assert(markdown.includes("Any failed required acceptance item blocks v1."), "blocking rule wording missing.");
  assert(markdown.includes("This record does not change product code"), "non-scope boundary missing.");

  return {
    ok: true,
    runner: "S-V1-F-05",
    decision: record.decision,
    message: "S-V1-F-05 final ship decision record is valid."
  };
}

try {
  const result = validate();
  console.log(JSON.stringify(result, null, 2));
  console.log("S-V1-F-05 V1_FINAL_SHIP_DECISION_CHECK_PASS");
} catch (error) {
  fail(error.message, error.details ?? {});
}
