#!/usr/bin/env node
/**
 * DEV NOTE: S-V1-G-03 controlled launch release tag currency confirmation runner.
 * Confirms the currently tagged release is covered by fresh, passing S-V1-F-05/F-08/F-09/F-10
 * evidence without reissuing a GO/NO-GO decision and without changing the S-V1-F-12 historical
 * record, which the LAUNCH-00 boundary requires to remain permanent history.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const TOKEN = "CI_V1_RELEASE_TAG_CURRENCY_CONFIRMATION";

const RECORD_PATH = "docs/releases/CONTROLLED_LAUNCH_RELEASE_TAG_CURRENCY_CONFIRMATION.json";
const MARKDOWN_PATH = "docs/releases/CONTROLLED_LAUNCH_RELEASE_TAG_CURRENCY_CONFIRMATION.md";
const GO_NO_GO_PATH = "docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.json";
const F05_PATH = "docs/releases/V1_FINAL_SHIP_DECISION.json";
const F08_PATH = "docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json";
const F09_PATH = "docs/releases/CONTROLLED_LAUNCH_EXECUTION_PACK.json";
const F10_PATH = "docs/releases/CONTROLLED_LAUNCH_SMOKE_RUN.json";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, runner: "S-V1-G-03", token: TOKEN, message }, null, 2));
  process.exitCode = 1;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function gitRevList(ref) {
  const result = spawnSync("git", ["rev-list", "-n", "1", ref], { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git rev-list -n 1 ${ref} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function main() {
  for (const relativePath of [RECORD_PATH, MARKDOWN_PATH, GO_NO_GO_PATH, F05_PATH, F08_PATH, F09_PATH, F10_PATH]) {
    assert(fs.existsSync(path.join(ROOT, relativePath)), `Missing ${relativePath}`);
  }

  const record = readJson(RECORD_PATH);
  const markdown = readText(MARKDOWN_PATH);
  const goNoGo = readJson(GO_NO_GO_PATH);
  const f05 = readJson(F05_PATH);
  const f08 = readJson(F08_PATH);
  const f09 = readJson(F09_PATH);
  const f10 = readJson(F10_PATH);

  assert(record.slice_id === "S-V1-G-03", "slice_id mismatch");
  assert(record.record_id === "controlled_launch_release_tag_currency_confirmation", "record_id mismatch");
  assert(record.token === TOKEN, "token mismatch");
  assert(record.status === "CONFIRMED", "status must be CONFIRMED");
  assert(record.decision_scope === "controlled_launch_only", "decision_scope mismatch");

  // The historical S-V1-F-12 record must remain untouched: same decision, same original tag identity.
  assert(goNoGo.decision === "GO", "S-V1-F-12 historical GO decision must remain GO");
  assert(goNoGo.decision_scope === "controlled_launch_only", "S-V1-F-12 decision_scope must remain controlled_launch_only");
  assert(goNoGo.release_identity?.tag_name === record.historical_go_no_go_record.recorded_release_tag, "S-V1-F-12 tag_name must remain the historical tag");
  assert(goNoGo.release_identity?.expected_tag_commit === record.historical_go_no_go_record.recorded_release_tag_commit, "S-V1-F-12 expected_tag_commit must remain the historical commit");
  assert(record.historical_go_no_go_record.record_unchanged_by_this_slice === true, "record_unchanged_by_this_slice must be true");

  // The current tag must be real, independently re-verifiable via git, and distinct from history.
  const currentTag = record.current_release_identity.tag_name;
  const currentTagCommit = record.current_release_identity.tag_commit;
  assert(currentTag !== record.historical_go_no_go_record.recorded_release_tag, "current tag must differ from the historical tag");
  const verifiedCommit = gitRevList(currentTag);
  assert(verifiedCommit === currentTagCommit, `git rev-list -n 1 ${currentTag} returned ${verifiedCommit}, expected ${currentTagCommit}`);
  assert(record.current_release_identity.local_tag_verified === true, "local_tag_verified must be true");
  assert(record.current_release_identity.remote_tag_verified === true, "remote_tag_verified must be true");

  // Each upstream slice's live file must actually show the current tag and a passing state.
  assert(f05.decision === "SHIP", "S-V1-F-05 must currently record SHIP");
  assert(record.current_evidence_chain.final_ship_decision.decision === f05.decision, "recorded F-05 decision must match live file");

  assert(f08.release?.tag_name === currentTag, "S-V1-F-08 tag_name must match current tag");
  assert(f08.release?.verified_main_commit === currentTagCommit, "S-V1-F-08 verified_main_commit must match current tag commit");
  assert(record.current_evidence_chain.release_evidence_snapshot.verified_main_commit === f08.release?.verified_main_commit, "recorded F-08 verified_main_commit must match live file");

  assert(f09.status === "prepared", "S-V1-F-09 must currently record prepared");
  assert(f09.release_identity?.tag_name === currentTag, "S-V1-F-09 tag_name must match current tag");
  assert(record.current_evidence_chain.controlled_launch_execution_pack.status === f09.status, "recorded F-09 status must match live file");

  assert(f10.smoke_summary?.result === "pass", "S-V1-F-10 must currently record pass");
  assert(f10.smoke_summary?.failed_required_command_count === 0, "S-V1-F-10 must show zero failed required commands");
  assert(f10.smoke_summary?.launch_blocker_recorded === false, "S-V1-F-10 must show no launch blocker");
  assert(f10.release_state_used?.tag_name === currentTag, "S-V1-F-10 tag_name must match current tag");
  assert(record.current_evidence_chain.controlled_launch_smoke_run.result === f10.smoke_summary?.result, "recorded F-10 result must match live file");

  for (const [key, value] of Object.entries(record.currency_findings ?? {})) {
    assert(value === true, `currency_findings.${key} must be true`);
  }

  assert(Array.isArray(record.blocker_reason_codes), "blocker_reason_codes must be an array");
  assert(record.blocker_reason_codes.length === 0, "blocker_reason_codes must be empty for a CONFIRMED record");

  for (const [key, value] of Object.entries(record.claim_boundary ?? {})) {
    assert(value === false, `claim_boundary.${key} must be false`);
  }

  assert(record.permitted_next_action === "start_controlled_launch_for_named_founder_group_only_under_current_tag", "permitted_next_action mismatch");

  const requiredMarkdown = [
    "# Controlled Launch Release Tag Currency Confirmation",
    "Slice: S-V1-G-03",
    "Status: CONFIRMED",
    "## Relationship to S-V1-F-12",
    "This record does not reissue a new GO decision.",
    `Tag: ${currentTag}`,
    `Tag commit: ${currentTagCommit}`,
    "Do not expand launch scope from this record."
  ];
  for (const text of requiredMarkdown) {
    assert(markdown.includes(text), `Markdown missing required text: ${text}`);
  }

  const forbiddenPhrases = [
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
  for (const phrase of forbiddenPhrases) {
    assert(!combined.includes(phrase), `forbidden wording found: ${phrase}`);
  }

  console.log(JSON.stringify({
    ok: true,
    runner: "S-V1-G-03",
    token: TOKEN,
    status: record.status,
    current_tag: currentTag,
    current_tag_commit: currentTagCommit,
    message: "S-V1-G-03 release tag currency confirmation is valid."
  }, null, 2));
  console.log("S-V1-G-03 RELEASE_TAG_CURRENCY_CONFIRMATION_CHECK_PASS");
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
