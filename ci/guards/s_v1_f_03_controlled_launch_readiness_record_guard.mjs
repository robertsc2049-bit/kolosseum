// @law: Repo Governance
// @severity: medium
// @scope: repo
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const ROOT = process.cwd();
const TOKEN = "CI_V1_CONTROLLED_LAUNCH_RECORD_GUARD";

const RECORD_MD = "docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.md";
const RECORD_JSON = "docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.json";

const REQUIRED_ITEM_IDS = [
  "CLRR-001",
  "CLRR-002",
  "CLRR-003",
  "CLRR-004",
  "CLRR-005",
  "CLRR-006",
  "CLRR-007",
  "CLRR-008",
  "CLRR-009",
  "CLRR-010",
  "CLRR-011",
  "CLRR-012"
];

const FORBIDDEN_POSITIVE_PATTERNS = [
  /\bis\s+safe\b/i,
  /\bare\s+safe\b/i,
  /\bsafe\s+to\s+(start|train|launch|execute|return)\b/i,
  /\bsafety\s+(approved|approval|certified|certification|guaranteed|guarantee)\b/i,
  /\bis\s+suitable\b/i,
  /\bsuitability\s+(approved|approval|certified|certification|guaranteed|guarantee)\b/i,
  /\bis\s+ready\b/i,
  /\breadiness\s+(approved|approval|certified|certification|guaranteed|guarantee|score|scoring)\b/i,
  /\bis\s+effective\b/i,
  /\beffectiveness\s+(approved|approval|certified|certification|guaranteed|guarantee)\b/i,
  /\bexternally\s+approved\b/i,
  /\bapproved\s+by\s+(a|an|the)?\s*(external|third[- ]party|governing|regulatory)\b/i,
  /\bcertified\s+by\s+(a|an|the)?\s*(external|third[- ]party|governing|regulatory)\b/i,
  /\bguarantee[sd]?\s+(outcome|result|progress|performance)\b/i,
  /\bopen[- ]ended\s+launch\s+(approved|permitted|allowed)\b/i,
  /\bbroad\s+rollout\s+(approved|permitted|allowed)\b/i,
  /\bmarketing\s+expansion\s+(approved|permitted|allowed)\b/i,
  /\benterprise\s+launch\s+(approved|permitted|allowed)\b/i
];

const failures = [];

function fail(token, file, detail) {
  failures.push({ token, file, detail });
}

function readText(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    fail("controlled_launch_record_missing", relPath, "Required record file is missing.");
    return "";
  }
  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relPath) {
  const raw = readText(relPath);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    fail("controlled_launch_record_json_invalid", relPath, error.message);
    return null;
  }
}

function assertBooleanFalse(value, relPath, fieldName) {
  if (value !== false) {
    fail("controlled_launch_expansion_boundary_invalid", relPath, `${fieldName} must be false.`);
  }
}

function assertBooleanTrue(value, relPath, fieldName) {
  if (value !== true) {
    fail("controlled_launch_required_boolean_invalid", relPath, `${fieldName} must be true.`);
  }
}

function checkPositiveClaims(relPath, text) {
  for (const pattern of FORBIDDEN_POSITIVE_PATTERNS) {
    const hit = text.match(pattern);
    if (hit) {
      fail("controlled_launch_positive_claim_detected", relPath, `Forbidden positive claim pattern: ${hit[0]}`);
    }
  }
}

const markdown = readText(RECORD_MD);
const record = readJson(RECORD_JSON);

if (markdown) {
  for (const requiredText of [
    "Slice: S-V1-F-03",
    "Scope: controlled launch only",
    "Initial record state: not signed.",
    "The controlled launch is limited to named participants",
    "If this record is unsigned, controlled launch operation is not recorded as permitted."
  ]) {
    if (!markdown.includes(requiredText)) {
      fail("controlled_launch_record_markdown_required_text_missing", RECORD_MD, `Missing text: ${requiredText}`);
    }
  }

  checkPositiveClaims(RECORD_MD, markdown);
}

if (record) {
  try {
    assert.equal(record.schema_version, "kolosseum.controlled_launch_readiness_record.v1.0.0");
    assert.equal(record.slice_id, "S-V1-F-03");
    assert.equal(record.record_id, "controlled_launch_readiness_record_v1");
    assert.equal(record.record_state, "template_not_signed");
    assert.equal(record.launch_decision?.status, "not_recorded");
    assert.equal(record.launch_decision?.signed_at_utc, null);
    assert.equal(record.launch_control?.type, "controlled");
  } catch (error) {
    fail("controlled_launch_record_identity_invalid", RECORD_JSON, error.message);
  }

  assertBooleanTrue(record.launch_control?.named_participants_only, RECORD_JSON, "launch_control.named_participants_only");
  assertBooleanFalse(record.launch_control?.open_signup_allowed, RECORD_JSON, "launch_control.open_signup_allowed");
  assertBooleanFalse(record.launch_control?.marketing_expansion_allowed, RECORD_JSON, "launch_control.marketing_expansion_allowed");
  assertBooleanFalse(record.launch_control?.broad_rollout_allowed, RECORD_JSON, "launch_control.broad_rollout_allowed");
  assertBooleanFalse(record.launch_control?.enterprise_launch_allowed, RECORD_JSON, "launch_control.enterprise_launch_allowed");
  assertBooleanFalse(record.launch_control?.post_v1_surfaces_allowed, RECORD_JSON, "launch_control.post_v1_surfaces_allowed");

  assertBooleanTrue(record.interpretation_limits?.factual_record_only, RECORD_JSON, "interpretation_limits.factual_record_only");
  assertBooleanTrue(record.interpretation_limits?.not_marketing_expansion, RECORD_JSON, "interpretation_limits.not_marketing_expansion");
  assertBooleanTrue(record.interpretation_limits?.not_broad_rollout, RECORD_JSON, "interpretation_limits.not_broad_rollout");
  assertBooleanTrue(record.interpretation_limits?.not_enterprise_launch, RECORD_JSON, "interpretation_limits.not_enterprise_launch");
  assertBooleanTrue(record.interpretation_limits?.not_external_approval, RECORD_JSON, "interpretation_limits.not_external_approval");
  assertBooleanTrue(record.interpretation_limits?.not_people_assessment, RECORD_JSON, "interpretation_limits.not_people_assessment");
  assertBooleanTrue(record.interpretation_limits?.not_outcome_claim, RECORD_JSON, "interpretation_limits.not_outcome_claim");

  if (record.signoff?.required !== true || record.signoff?.current_state !== "unsigned") {
    fail("controlled_launch_signoff_state_invalid", RECORD_JSON, "Signoff must be required and current_state must be unsigned.");
  }

  if (!Array.isArray(record.required_gate_items)) {
    fail("controlled_launch_gate_items_invalid", RECORD_JSON, "required_gate_items must be an array.");
  } else {
    const actualIds = record.required_gate_items.map((item) => item.item_id);
    if (JSON.stringify(actualIds) !== JSON.stringify(REQUIRED_ITEM_IDS)) {
      fail("controlled_launch_gate_item_ids_invalid", RECORD_JSON, `Expected ${REQUIRED_ITEM_IDS.join(", ")} but found ${actualIds.join(", ")}.`);
    }

    for (const item of record.required_gate_items) {
      if (item.status !== "unrecorded") {
        fail("controlled_launch_gate_item_initial_state_invalid", RECORD_JSON, `${item.item_id} must start as unrecorded.`);
      }

      if (!Array.isArray(item.evidence_refs) || item.evidence_refs.length !== 0) {
        fail("controlled_launch_gate_item_evidence_invalid", RECORD_JSON, `${item.item_id} must start with an empty evidence_refs array.`);
      }

      for (const fieldName of ["item_id", "label", "evidence_kind", "status", "evidence_refs"]) {
        if (!(fieldName in item)) {
          fail("controlled_launch_gate_item_shape_invalid", RECORD_JSON, `${item.item_id ?? "unknown"} missing ${fieldName}.`);
        }
      }
    }
  }

  checkPositiveClaims(RECORD_JSON, JSON.stringify(record, null, 2));
}

if (failures.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    guard: "s_v1_f_03_controlled_launch_readiness_record_guard", token: TOKEN,
    failures
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    guard: "s_v1_f_03_controlled_launch_readiness_record_guard", token: TOKEN,
    checked: [RECORD_MD, RECORD_JSON],
    required_gate_items: REQUIRED_ITEM_IDS.length
  }, null, 2));
}
