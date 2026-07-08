
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import fs from "node:fs";
import path from "node:path";

const REQUIRED_READINESS_IDS = [
  "CRP-001",
  "CRP-002",
  "CRP-003",
  "CRP-004",
  "CRP-005",
  "CRP-006",
  "CRP-007",
  "CRP-008",
  "CRP-009",
  "CRP-010",
  "CRP-011",
  "CRP-012",
  "CRP-013",
  "CRP-014",
  "CRP-015",
  "CRP-016",
  "CRP-017",
  "CRP-018"
];

const REQUIRED_NEGATIVE_IDS = [
  "CRP-N-001",
  "CRP-N-002",
  "CRP-N-003",
  "CRP-N-004",
  "CRP-N-005",
  "CRP-N-006",
  "CRP-N-007",
  "CRP-N-008",
  "CRP-N-009",
  "CRP-N-010",
  "CRP-N-011",
  "CRP-N-012",
  "CRP-N-013"
];

const REQUIRED_MD_HEADINGS = [
  "# COACH-READY PILOT ACCEPTANCE PACK",
  "## 1. Purpose",
  "## 2. v0 boundary",
  "## 3. Pass definition",
  "## 4. Evidence-of-readiness matrix",
  "## 5. Required checklist",
  "## 6. Negative boundary checklist",
  "## 7. Operator sign-off flow",
  "## 9. Fail-closed rules",
  "## 10. Final lock"
];

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function arraysEqual(a, b) {
  return Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((value, index) => value === b[index]);
}

function hasUniqueValues(values) {
  return new Set(values).size === values.length;
}

export function verifyCoachReadyPilotAcceptancePack({
  repoRoot = process.cwd(),
  markdownPath = "docs/pilot/COACH_READY_PILOT_ACCEPTANCE_PACK.md",
  checklistPath = "docs/pilot/coach_ready_pilot_acceptance_checklist.json"
} = {}) {
  const mdFullPath = path.join(repoRoot, markdownPath);
  const jsonFullPath = path.join(repoRoot, checklistPath);

  assert(fs.existsSync(mdFullPath), `missing markdown pack: ${markdownPath}`);
  assert(fs.existsSync(jsonFullPath), `missing checklist json: ${checklistPath}`);

  const markdown = fs.readFileSync(mdFullPath, "utf8");
  const checklist = readJson(jsonFullPath);

  for (const heading of REQUIRED_MD_HEADINGS) {
    assert(markdown.includes(heading), `markdown missing heading: ${heading}`);
  }

  assert(checklist.checklist_id === "coach_ready_pilot_acceptance_checklist", "unexpected checklist_id");
  assert(checklist.slice_id === "S45", "unexpected slice_id");
  assert(checklist.scope === "kolosseum_v0_deterministic_execution_alpha", "unexpected scope");
  assert(checklist.pass_rule?.mode === "fail_closed", "pass rule must fail closed");
  assert(checklist.pass_rule?.required_readiness_items === "all_must_pass", "all readiness items must pass");
  assert(checklist.pass_rule?.negative_boundary_items === "all_must_pass", "all negative boundary items must pass");
  assert(checklist.pass_rule?.source_artefacts === "each_required_item_must_have_at_least_one", "source artefact rule missing");
  assert(checklist.pass_rule?.manual_override_allowed === false, "manual override must be false");
  assert(checklist.pass_rule?.partial_pass_allowed === false, "partial pass must be false");
  assert(checklist.pass_rule?.warnings_allowed_to_pass === false, "warnings must not pass");

  assert(arraysEqual(checklist.v0_boundary?.actors, ["individual_user", "coach"]), "v0 actors drifted");
  assert(arraysEqual(checklist.v0_boundary?.execution_scopes, ["individual", "coach_managed"]), "v0 execution scopes drifted");
  assert(arraysEqual(checklist.v0_boundary?.activities, ["powerlifting", "rugby_union", "general_strength"]), "v0 activities drifted");
  assert(arraysEqual(checklist.v0_boundary?.engine_phases, ["phase_1", "phase_2", "phase_3", "phase_4", "phase_5", "phase_6"]), "v0 phase boundary drifted");
  assert(checklist.v0_boundary?.coach_authority === "observational_only", "coach authority must remain observational only");
  assert(checklist.v0_boundary?.payment_effect === "access_only", "payment effect must remain access only");

  const readinessItems = checklist.required_readiness_items;
  assert(Array.isArray(readinessItems), "required_readiness_items must be array");
  const readinessIds = readinessItems.map((item) => item.id);
  assert(arraysEqual(readinessIds, REQUIRED_READINESS_IDS), "required readiness IDs/order drifted");
  assert(hasUniqueValues(readinessIds), "duplicate readiness IDs");

  for (const item of readinessItems) {
    assert(item.required === true, `${item.id} must be required`);
    assert(Array.isArray(item.source_artefacts) && item.source_artefacts.length > 0, `${item.id} missing source artefacts`);
    assert(typeof item.pass_condition === "string" && item.pass_condition.length > 0, `${item.id} missing pass condition`);
    assert(typeof item.fail_condition === "string" && item.fail_condition.length > 0, `${item.id} missing fail condition`);
  }

  const negativeItems = checklist.negative_boundary_checklist;
  assert(Array.isArray(negativeItems), "negative_boundary_checklist must be array");
  const negativeIds = negativeItems.map((item) => item.id);
  assert(arraysEqual(negativeIds, REQUIRED_NEGATIVE_IDS), "negative boundary IDs/order drifted");
  assert(hasUniqueValues(negativeIds), "duplicate negative boundary IDs");

  for (const item of negativeItems) {
    assert(typeof item.excluded_surface === "string" && item.excluded_surface.length > 0, `${item.id} missing excluded surface`);
    assert(typeof item.negative_check === "string" && item.negative_check.length > 0, `${item.id} missing negative check`);
  }

  const signoff = checklist.operator_signoff_flow;
  assert(Array.isArray(signoff) && signoff.length === 5, "operator signoff flow must contain exactly five steps");
  assert(arraysEqual(signoff.map((step) => step.step_id), ["SIGN-001", "SIGN-002", "SIGN-003", "SIGN-004", "SIGN-005"]), "operator signoff step order drifted");
  assert(signoff[1].not_applicable_allowed === false, "required readiness items must not allow not-applicable");
  assert(signoff[2].not_applicable_allowed === false, "negative boundary items must not allow not-applicable");
  assert(arraysEqual(signoff[4].allowed_final_statuses, ["coach_ready", "blocked"]), "final statuses drifted");
  assert(signoff[4].coach_ready_requires?.includes("all_required_readiness_items_passed"), "coach_ready missing all-required pass rule");
  assert(signoff[4].coach_ready_requires?.includes("all_negative_boundary_items_passed"), "coach_ready missing negative boundary pass rule");
  assert(signoff[4].coach_ready_requires?.includes("source_artefact_coverage_complete"), "coach_ready missing source artefact pass rule");
  assert(signoff[4].coach_ready_requires?.includes("no_forbidden_surface_exposed"), "coach_ready missing forbidden surface pass rule");
  assert(signoff[4].coach_ready_requires?.includes("v0_boundary_preserved"), "coach_ready missing v0 boundary pass rule");

  const forbiddenClaims = checklist.forbidden_acceptance_claims;
  assert(Array.isArray(forbiddenClaims) && forbiddenClaims.length === 11, "forbidden acceptance claims must contain exactly 11 entries");

  assert(markdown.includes("Payment confirms access only."), "markdown must state payment access-only rule");
  assert(markdown.includes("Coach Ready passes only when every required readiness item is passed."), "markdown must state all-items pass rule");
  assert(markdown.includes("A single failed negative check blocks Coach Ready."), "markdown must state negative-check fail rule");
  assert(markdown.includes("It must not be used as marketing copy."), "markdown must forbid marketing use");

  return {
    ok: true,
    checklist_id: checklist.checklist_id,
    readiness_count: readinessItems.length,
    negative_boundary_count: negativeItems.length,
    signoff_step_count: signoff.length
  };
}

export function main() {
  const result = verifyCoachReadyPilotAcceptancePack();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
