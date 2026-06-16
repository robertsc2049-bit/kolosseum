// @law: v1 Registry Content Production System
// @severity: high
// @scope: v1-registry

// DEV NOTE: S-V1-25 boundary guard. This guard proves the registry content
// production system before high-volume v1 registry content begins. It enforces
// source-control register fields, original/licensed source status, manual review,
// legal/commercial-use status, and no exact named-coach copying or protected
// formula visibility. It must not add active registry content.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const TOKEN = "CI_V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM";
const TOKEN_PREFIX = "v1_registry_content_production_system_";

const registryDomainIds = Object.freeze([
  "activity_registry",
  "movement_pattern_registry",
  "exercise_registry",
  "equipment_registry",
  "exercise_activity_applicability_registry",
  "exercise_equipment_compatibility_registry",
  "substitution_edge_registry",
  "programme_template_registry",
  "instruction_display_copy_registry",
  "copy_legal_claim_boundary_registry"
]);

const requiredSourceControlFields = Object.freeze([
  "source_record_id",
  "slice_id",
  "registry_domain_id",
  "candidate_record_id",
  "candidate_record_type",
  "content_execution_status",
  "source_status",
  "source_type",
  "source_reference",
  "source_visibility",
  "licence_status",
  "commercial_use_status",
  "attribution_status",
  "exact_copy_risk_status",
  "famous_coach_reference_status",
  "derivative_risk_status",
  "formula_visibility_status",
  "manual_review_status",
  "legal_review_status",
  "reviewer_role",
  "reviewed_at",
  "decision",
  "decision_notes",
  "evidence_paths",
  "copy_boundary_flags"
]);

const allowedSourceStatuses = Object.freeze([
  "founder_original",
  "original_equivalent",
  "licensed_source",
  "canonical_project_document",
  "public_rule_or_standard",
  "implementation_fixture",
  "unlicensed_named_coach_source"
]);

const allowedLicenceStatuses = Object.freeze([
  "not_required_original",
  "licensed",
  "public_domain_or_open_standard",
  "project_owned",
  "not_licensed"
]);

const allowedCommercialUseStatuses = Object.freeze([
  "permitted",
  "not_permitted",
  "review_required"
]);

const allowedExactCopyRiskStatuses = Object.freeze([
  "none",
  "low_rewritten_original",
  "review_required",
  "exact_copy"
]);

const allowedFamousCoachStatuses = Object.freeze([
  "none",
  "generic_principle_only",
  "named_reference_review_required",
  "named_famous_coach_reference"
]);

const allowedDerivativeRiskStatuses = Object.freeze([
  "none",
  "low_original_equivalent",
  "review_required",
  "near_copy"
]);

const allowedFormulaVisibilityStatuses = Object.freeze([
  "no_formula_present",
  "protected_formula_not_visible",
  "protected_formula_visible"
]);

const allowedManualReviewStatuses = Object.freeze([
  "not_reviewed",
  "reviewed",
  "approved",
  "blocked"
]);

const allowedLegalReviewStatuses = Object.freeze([
  "not_required_original",
  "not_reviewed",
  "reviewed",
  "approved",
  "blocked"
]);

const allowedDecisions = Object.freeze([
  "draft_only",
  "approved_for_active_registry_candidate",
  "approved_for_active_registry_accepted",
  "blocked"
]);

const forbiddenCandidateTerms = Object.freeze([
  "delroy-style",
  "westside-style",
  "paul smith method",
  "official coach method",
  "inspired by named coach",
  "exact famous coach programme",
  "exact famous coach program",
  "protected formula",
  "copy the formula"
]);

const requiredFiles = Object.freeze([
  "docs/v1/V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM.md",
  "ci/fixtures/v1_registry_content_production_system_negative/s_v1_25_exact_famous_coach_copy_negative.json",
  "test/s_v1_25_registry_content_production_system.test.mjs",
  "ci/guards/s_v1_25_registry_content_production_system_guard.mjs",
  "docs/roadmap/V1_REGISTRY_CONTENT_PRODUCTION_CONTRACT.md",
  "ci/guards/v1_registry_content_production_contract_guard.mjs",
  "docs/v1/V1_EXERCISE_REGISTRY_CONTRACT.md",
  "docs/v1/V1_EQUIPMENT_REGISTRY_COVERAGE_CONTRACT.md",
  "docs/v1/V1_EXERCISE_ACTIVITY_APPLICABILITY_COVERAGE_CONTRACT.md",
  "docs/v1/V1_REGISTRY_LOAD_ORDER_FK_CLOSURE_CONTRACT.md"
]);

function failGuard(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: "S-V1-25",
    token: TOKEN,
    message,
    ...details
  }));
  process.exit(1);
}

function contractFail(code, message, details = {}) {
  const error = new Error(`${TOKEN_PREFIX}${code}: ${message}`);
  error.code = `${TOKEN_PREFIX}${code}`;
  error.details = details;
  throw error;
}

function readText(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    failGuard(`missing required file: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath));
  } catch (error) {
    failGuard(`invalid JSON in ${relativePath}: ${error?.message ?? String(error)}`);
  }
}

function assertIncludes(text, required, context) {
  if (!text.includes(required)) {
    failGuard(`${context} missing required text: ${required}`);
  }
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(Object(value), key);
}

function assertNonEmptyString(record, field, code, context) {
  if (typeof record[field] !== "string" || record[field].length === 0) {
    contractFail(code, `${field} must be a non-empty string`, context);
  }
}

function assertAllowed(value, allowed, code, context) {
  if (!allowed.includes(value)) {
    contractFail(code, "value is not in the allowed closed set", {
      ...context,
      value
    });
  }
}

function assertStringArray(value, code, context) {
  if (!Array.isArray(value)) {
    contractFail(code, "expected an explicit array", context);
  }

  const seen = new Set();

  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) {
      contractFail(code, "array must contain non-empty strings only", context);
    }

    if (seen.has(item)) {
      contractFail("duplicate_array_value", "array must not contain duplicate values", {
        ...context,
        value: item
      });
    }

    seen.add(item);
  }
}

function assertSourceControlRecordShape(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    contractFail("source_control_record_not_object", "source-control register entry must be an object");
  }

  for (const field of requiredSourceControlFields) {
    if (!hasOwn(record, field)) {
      contractFail("source_control_required_field_missing", `source-control register entry missing required field: ${field}`, {
        source_record_id: record?.source_record_id ?? null,
        field
      });
    }
  }

  for (const field of [
    "source_record_id",
    "slice_id",
    "registry_domain_id",
    "candidate_record_id",
    "candidate_record_type",
    "content_execution_status",
    "source_status",
    "source_type",
    "source_reference",
    "source_visibility",
    "licence_status",
    "commercial_use_status",
    "attribution_status",
    "exact_copy_risk_status",
    "famous_coach_reference_status",
    "derivative_risk_status",
    "formula_visibility_status",
    "manual_review_status",
    "legal_review_status",
    "decision",
    "decision_notes"
  ]) {
    assertNonEmptyString(record, field, "source_control_required_field_invalid", {
      source_record_id: record.source_record_id ?? null,
      field
    });
  }

  if (!registryDomainIds.includes(record.registry_domain_id)) {
    contractFail("unknown_registry_domain", "source-control register entry references an unknown registry domain", {
      source_record_id: record.source_record_id,
      registry_domain_id: record.registry_domain_id
    });
  }

  assertAllowed(record.source_status, allowedSourceStatuses, "source_status_invalid", {
    source_record_id: record.source_record_id
  });

  assertAllowed(record.licence_status, allowedLicenceStatuses, "licence_status_invalid", {
    source_record_id: record.source_record_id
  });

  assertAllowed(record.commercial_use_status, allowedCommercialUseStatuses, "commercial_use_status_invalid", {
    source_record_id: record.source_record_id
  });

  assertAllowed(record.exact_copy_risk_status, allowedExactCopyRiskStatuses, "exact_copy_risk_status_invalid", {
    source_record_id: record.source_record_id
  });

  assertAllowed(record.famous_coach_reference_status, allowedFamousCoachStatuses, "famous_coach_reference_status_invalid", {
    source_record_id: record.source_record_id
  });

  assertAllowed(record.derivative_risk_status, allowedDerivativeRiskStatuses, "derivative_risk_status_invalid", {
    source_record_id: record.source_record_id
  });

  assertAllowed(record.formula_visibility_status, allowedFormulaVisibilityStatuses, "formula_visibility_status_invalid", {
    source_record_id: record.source_record_id
  });

  assertAllowed(record.manual_review_status, allowedManualReviewStatuses, "manual_review_status_invalid", {
    source_record_id: record.source_record_id
  });

  assertAllowed(record.legal_review_status, allowedLegalReviewStatuses, "legal_review_status_invalid", {
    source_record_id: record.source_record_id
  });

  assertAllowed(record.decision, allowedDecisions, "decision_invalid", {
    source_record_id: record.source_record_id
  });

  assertStringArray(record.evidence_paths, "evidence_paths_invalid", {
    source_record_id: record.source_record_id
  });

  assertStringArray(record.copy_boundary_flags, "copy_boundary_flags_invalid", {
    source_record_id: record.source_record_id
  });

  if (record.manual_review_status === "approved" && (typeof record.reviewer_role !== "string" || record.reviewer_role.length === 0)) {
    contractFail("manual_review_reviewer_missing", "approved manual review requires reviewer_role", {
      source_record_id: record.source_record_id
    });
  }

  if (record.manual_review_status === "approved" && (typeof record.reviewed_at !== "string" || record.reviewed_at.length === 0)) {
    contractFail("manual_review_timestamp_missing", "approved manual review requires reviewed_at", {
      source_record_id: record.source_record_id
    });
  }

  if (record.licence_status === "not_licensed" && record.commercial_use_status === "permitted") {
    contractFail("unlicensed_commercial_use_refused", "unlicensed source cannot be marked commercial-use permitted", {
      source_record_id: record.source_record_id
    });
  }

  if (record.formula_visibility_status === "protected_formula_visible") {
    contractFail("protected_formula_visibility_refused", "protected formulas must not be visible in registry production records", {
      source_record_id: record.source_record_id
    });
  }

  if (
    record.source_status === "unlicensed_named_coach_source" ||
    record.exact_copy_risk_status === "exact_copy" ||
    record.famous_coach_reference_status === "named_famous_coach_reference" ||
    record.derivative_risk_status === "near_copy"
  ) {
    if (record.decision !== "blocked") {
      contractFail("unsafe_source_decision_refused", "unlicensed named coach, exact-copy, famous-coach reference, or near-copy sources must be blocked", {
        source_record_id: record.source_record_id,
        decision: record.decision
      });
    }
  }

  if (
    record.exact_copy_risk_status === "exact_copy" &&
    record.famous_coach_reference_status === "named_famous_coach_reference"
  ) {
    contractFail("exact_famous_coach_copy_refused", "exact famous-coach programme copying is refused", {
      source_record_id: record.source_record_id,
      candidate_record_id: record.candidate_record_id
    });
  }

  if (
    record.decision === "approved_for_active_registry_candidate" ||
    record.decision === "approved_for_active_registry_accepted"
  ) {
    if (record.manual_review_status !== "approved") {
      contractFail("manual_review_required", "active registry candidate or accepted content requires approved manual review", {
        source_record_id: record.source_record_id
      });
    }

    if (!["not_required_original", "approved"].includes(record.legal_review_status)) {
      contractFail("legal_review_required", "active registry candidate or accepted content requires legal review approval or original-source exemption", {
        source_record_id: record.source_record_id
      });
    }

    if (!["not_required_original", "licensed", "public_domain_or_open_standard", "project_owned"].includes(record.licence_status)) {
      contractFail("licence_status_required", "active registry candidate or accepted content requires acceptable licence status", {
        source_record_id: record.source_record_id
      });
    }

    if (record.commercial_use_status !== "permitted") {
      contractFail("commercial_use_permission_required", "active registry candidate or accepted content requires commercial-use permission", {
        source_record_id: record.source_record_id
      });
    }
  }
}

function assertCandidateRecordShape(candidate, sourceRecordsByCandidateId) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    contractFail("candidate_record_not_object", "candidate record must be an object");
  }

  for (const field of [
    "candidate_record_id",
    "registry_domain_id",
    "candidate_record_type",
    "status",
    "source_record_id",
    "declared_originality_status",
    "content_summary"
  ]) {
    assertNonEmptyString(candidate, field, "candidate_required_field_invalid", {
      candidate_record_id: candidate?.candidate_record_id ?? null,
      field
    });
  }

  if (!registryDomainIds.includes(candidate.registry_domain_id)) {
    contractFail("candidate_unknown_registry_domain", "candidate record references an unknown registry domain", {
      candidate_record_id: candidate.candidate_record_id,
      registry_domain_id: candidate.registry_domain_id
    });
  }

  const sourceRecord = sourceRecordsByCandidateId.get(candidate.candidate_record_id);

  if (!sourceRecord) {
    contractFail("candidate_source_record_missing", "candidate record must have exactly one matching source-control register entry", {
      candidate_record_id: candidate.candidate_record_id
    });
  }

  if (sourceRecord.source_record_id !== candidate.source_record_id) {
    contractFail("candidate_source_record_mismatch", "candidate source_record_id must match source-control register entry", {
      candidate_record_id: candidate.candidate_record_id,
      candidate_source_record_id: candidate.source_record_id,
      source_control_source_record_id: sourceRecord.source_record_id
    });
  }

  if (sourceRecord.registry_domain_id !== candidate.registry_domain_id) {
    contractFail("candidate_registry_domain_mismatch", "candidate registry_domain_id must match source-control register entry", {
      candidate_record_id: candidate.candidate_record_id
    });
  }

  const candidateText = JSON.stringify(candidate).toLowerCase();

  for (const term of forbiddenCandidateTerms) {
    if (candidateText.includes(term)) {
      contractFail("forbidden_candidate_copy_semantic", "candidate record contains forbidden named-coach copy or protected formula semantic", {
        candidate_record_id: candidate.candidate_record_id,
        term
      });
    }
  }
}

function validateRegistryContentProductionSystem(input) {
  const sourceControlRegister = input.source_control_register;
  const candidateRecords = input.candidate_records ?? [];

  if (!Array.isArray(sourceControlRegister)) {
    contractFail("source_control_register_not_array", "source_control_register must be an array");
  }

  if (!Array.isArray(candidateRecords)) {
    contractFail("candidate_records_not_array", "candidate_records must be an array");
  }

  if (sourceControlRegister.length === 0) {
    contractFail("source_control_register_empty", "source_control_register must contain explicit entries for production review");
  }

  const sourceIds = new Set();
  const sourceRecordsByCandidateId = new Map();

  for (const sourceRecord of sourceControlRegister) {
    assertSourceControlRecordShape(sourceRecord);

    if (sourceIds.has(sourceRecord.source_record_id)) {
      contractFail("duplicate_source_record_id", "source_record_id must be unique", {
        source_record_id: sourceRecord.source_record_id
      });
    }

    sourceIds.add(sourceRecord.source_record_id);

    if (sourceRecordsByCandidateId.has(sourceRecord.candidate_record_id)) {
      contractFail("duplicate_candidate_source_record", "candidate_record_id must have exactly one source-control register entry", {
        candidate_record_id: sourceRecord.candidate_record_id
      });
    }

    sourceRecordsByCandidateId.set(sourceRecord.candidate_record_id, sourceRecord);
  }

  for (const candidate of candidateRecords) {
    assertCandidateRecordShape(candidate, sourceRecordsByCandidateId);
  }

  return {
    ok: true,
    source_record_count: sourceControlRegister.length,
    candidate_record_count: candidateRecords.length
  };
}

function assertThrowsWithCode(fn, expectedCode, context) {
  try {
    fn();
  } catch (error) {
    if (error && error.code === expectedCode) {
      return error;
    }

    failGuard(`${context}: expected ${expectedCode}, got ${error && error.code ? error.code : "no_code"}`);
  }

  failGuard(`${context}: expected throw with ${expectedCode}`);
}

for (const file of requiredFiles) {
  readText(file);
}

for (const forbiddenPath of [
  "registries/source_control/source_control.registry.json",
  "registries/registry_content_source_control_register.json",
  "registries/programme_template/programme_template.registry.json",
  "shared/v1-registry/v1RegistryContentProductionSystem.mjs"
]) {
  if (fs.existsSync(path.join(repoRoot, forbiddenPath))) {
    failGuard(`forbidden active or implementation surface present: ${forbiddenPath}`);
  }
}

const fixturePath = "ci/fixtures/v1_registry_content_production_system_negative/s_v1_25_exact_famous_coach_copy_negative.json";
const fixture = readJson(fixturePath);

if (fixture.slice_id !== "S-V1-25") {
  failGuard(`${fixturePath} slice_id must be S-V1-25`);
}

if (fixture.expected_failure_code !== "v1_registry_content_production_system_exact_famous_coach_copy_refused") {
  failGuard(`${fixturePath} expected_failure_code mismatch`);
}

const error = assertThrowsWithCode(
  () => validateRegistryContentProductionSystem({
    source_control_register: fixture.source_control_register,
    candidate_records: fixture.candidate_records
  }),
  fixture.expected_failure_code,
  "exact famous-coach copy negative fixture"
);

if (error.details?.source_record_id !== fixture.source_control_register[0].source_record_id) {
  failGuard("negative fixture failed for wrong source_record_id");
}

const docText = readText("docs/v1/V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM.md");
const roadmapContractText = readText("docs/roadmap/V1_REGISTRY_CONTENT_PRODUCTION_CONTRACT.md");
const packageText = readText("package.json");
const guardsIndexText = readText("docs/GUARDS_INDEX.md");
const failureTokenText = readText("docs/dev/FAILURE_TOKEN_INDEX.md");

for (const field of requiredSourceControlFields) {
  assertIncludes(docText, field, "docs/v1/V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM.md");
}

for (const domainId of registryDomainIds) {
  assertIncludes(docText, domainId, "docs/v1/V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM.md");
}

for (const requiredText of [
  "S-V1-25",
  "Content must be original or licensed",
  "Source status and manual review must be recorded",
  "No exact famous-coach programme copying",
  "No high-volume registry content is added by this slice",
  "source-control register",
  "manual review",
  "licence status",
  "protected formulas must not be visible",
  "source-control register pattern",
  "review checklist"
]) {
  assertIncludes(docText, requiredText, "docs/v1/V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM.md");
}

for (const requiredText of [
  "source_classification",
  "copy_legal_review_status",
  "claim_language_review_status",
  "no registry content records are added"
]) {
  assertIncludes(roadmapContractText, requiredText, "docs/roadmap/V1_REGISTRY_CONTENT_PRODUCTION_CONTRACT.md");
}

assertIncludes(
  packageText,
  "node --test test/s_v1_25_registry_content_production_system.test.mjs",
  "package.json lint:fast"
);

assertIncludes(
  packageText,
  "node ci/guards/s_v1_25_registry_content_production_system_guard.mjs",
  "package.json lint:fast"
);

assertIncludes(
  guardsIndexText,
  "s_v1_25_registry_content_production_system_guard",
  "docs/GUARDS_INDEX.md"
);

assertIncludes(
  failureTokenText,
  TOKEN,
  "docs/dev/FAILURE_TOKEN_INDEX.md"
);

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-25",
  token: TOKEN,
  message: "Registry content production system passed."
}));
