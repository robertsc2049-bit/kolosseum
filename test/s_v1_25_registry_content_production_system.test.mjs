import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

const TOKEN_PREFIX = "v1_registry_content_production_system_";

const lockedActivityIds = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

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

function fail(code, message, details = {}) {
  const error = new Error(`${TOKEN_PREFIX}${code}: ${message}`);
  error.code = `${TOKEN_PREFIX}${code}`;
  error.details = details;
  throw error;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(Object(value), key);
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [value];
}

function assertNonEmptyString(record, field, code, context) {
  if (typeof record[field] !== "string" || record[field].length === 0) {
    fail(code, `${field} must be a non-empty string`, context);
  }
}

function assertAllowed(value, allowed, code, context) {
  if (!allowed.includes(value)) {
    fail(code, "value is not in the allowed closed set", {
      ...context,
      value
    });
  }
}

function assertStringArray(value, code, context) {
  if (!Array.isArray(value)) {
    fail(code, "expected an explicit array", context);
  }

  const seen = new Set();

  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) {
      fail(code, "array must contain non-empty strings only", context);
    }

    if (seen.has(item)) {
      fail("duplicate_array_value", "array must not contain duplicate values", {
        ...context,
        value: item
      });
    }

    seen.add(item);
  }
}

function assertSourceControlRecordShape(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    fail("source_control_record_not_object", "source-control register entry must be an object");
  }

  for (const field of requiredSourceControlFields) {
    if (!hasOwn(record, field)) {
      fail("source_control_required_field_missing", `source-control register entry missing required field: ${field}`, {
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
    fail("unknown_registry_domain", "source-control register entry references an unknown registry domain", {
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
    fail("manual_review_reviewer_missing", "approved manual review requires reviewer_role", {
      source_record_id: record.source_record_id
    });
  }

  if (record.manual_review_status === "approved" && (typeof record.reviewed_at !== "string" || record.reviewed_at.length === 0)) {
    fail("manual_review_timestamp_missing", "approved manual review requires reviewed_at", {
      source_record_id: record.source_record_id
    });
  }

  if (record.licence_status === "not_licensed" && record.commercial_use_status === "permitted") {
    fail("unlicensed_commercial_use_refused", "unlicensed source cannot be marked commercial-use permitted", {
      source_record_id: record.source_record_id
    });
  }

  if (record.formula_visibility_status === "protected_formula_visible") {
    fail("protected_formula_visibility_refused", "protected formulas must not be visible in registry production records", {
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
      fail("unsafe_source_decision_refused", "unlicensed named coach, exact-copy, famous-coach reference, or near-copy sources must be blocked", {
        source_record_id: record.source_record_id,
        decision: record.decision
      });
    }
  }

  if (
    record.exact_copy_risk_status === "exact_copy" &&
    record.famous_coach_reference_status === "named_famous_coach_reference"
  ) {
    fail("exact_famous_coach_copy_refused", "exact famous-coach programme copying is refused", {
      source_record_id: record.source_record_id,
      candidate_record_id: record.candidate_record_id
    });
  }

  if (
    record.decision === "approved_for_active_registry_candidate" ||
    record.decision === "approved_for_active_registry_accepted"
  ) {
    if (record.manual_review_status !== "approved") {
      fail("manual_review_required", "active registry candidate or accepted content requires approved manual review", {
        source_record_id: record.source_record_id
      });
    }

    if (!["not_required_original", "approved"].includes(record.legal_review_status)) {
      fail("legal_review_required", "active registry candidate or accepted content requires legal review approval or original-source exemption", {
        source_record_id: record.source_record_id
      });
    }

    if (!["not_required_original", "licensed", "public_domain_or_open_standard", "project_owned"].includes(record.licence_status)) {
      fail("licence_status_required", "active registry candidate or accepted content requires acceptable licence status", {
        source_record_id: record.source_record_id
      });
    }

    if (record.commercial_use_status !== "permitted") {
      fail("commercial_use_permission_required", "active registry candidate or accepted content requires commercial-use permission", {
        source_record_id: record.source_record_id
      });
    }
  }
}

function assertCandidateRecordShape(candidate, sourceRecordsByCandidateId) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    fail("candidate_record_not_object", "candidate record must be an object");
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
    fail("candidate_unknown_registry_domain", "candidate record references an unknown registry domain", {
      candidate_record_id: candidate.candidate_record_id,
      registry_domain_id: candidate.registry_domain_id
    });
  }

  const sourceRecord = sourceRecordsByCandidateId.get(candidate.candidate_record_id);

  if (!sourceRecord) {
    fail("candidate_source_record_missing", "candidate record must have exactly one matching source-control register entry", {
      candidate_record_id: candidate.candidate_record_id
    });
  }

  if (sourceRecord.source_record_id !== candidate.source_record_id) {
    fail("candidate_source_record_mismatch", "candidate source_record_id must match source-control register entry", {
      candidate_record_id: candidate.candidate_record_id,
      candidate_source_record_id: candidate.source_record_id,
      source_control_source_record_id: sourceRecord.source_record_id
    });
  }

  if (sourceRecord.registry_domain_id !== candidate.registry_domain_id) {
    fail("candidate_registry_domain_mismatch", "candidate registry_domain_id must match source-control register entry", {
      candidate_record_id: candidate.candidate_record_id
    });
  }

  const candidateText = JSON.stringify(candidate).toLowerCase();

  for (const term of forbiddenCandidateTerms) {
    if (candidateText.includes(term)) {
      fail("forbidden_candidate_copy_semantic", "candidate record contains forbidden named-coach copy or protected formula semantic", {
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
    fail("source_control_register_not_array", "source_control_register must be an array");
  }

  if (!Array.isArray(candidateRecords)) {
    fail("candidate_records_not_array", "candidate_records must be an array");
  }

  if (sourceControlRegister.length === 0) {
    fail("source_control_register_empty", "source_control_register must contain explicit entries for production review");
  }

  const sourceIds = new Set();
  const sourceRecordsByCandidateId = new Map();

  for (const sourceRecord of sourceControlRegister) {
    assertSourceControlRecordShape(sourceRecord);

    if (sourceIds.has(sourceRecord.source_record_id)) {
      fail("duplicate_source_record_id", "source_record_id must be unique", {
        source_record_id: sourceRecord.source_record_id
      });
    }

    sourceIds.add(sourceRecord.source_record_id);

    if (sourceRecordsByCandidateId.has(sourceRecord.candidate_record_id)) {
      fail("duplicate_candidate_source_record", "candidate_record_id must have exactly one source-control register entry", {
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

function makeApprovedOriginalFixture() {
  return {
    source_control_register: [
      {
        source_record_id: "source_positive_original_fixture",
        slice_id: "S-V1-25",
        registry_domain_id: "exercise_registry",
        candidate_record_id: "fixture_original_exercise_record",
        candidate_record_type: "exercise",
        content_execution_status: "active_registry_candidate",
        source_status: "founder_original",
        source_type: "founder_domain_knowledge",
        source_reference: "founder_authored_record",
        source_visibility: "private_project",
        licence_status: "not_required_original",
        commercial_use_status: "permitted",
        attribution_status: "not_required",
        exact_copy_risk_status: "none",
        famous_coach_reference_status: "none",
        derivative_risk_status: "none",
        formula_visibility_status: "no_formula_present",
        manual_review_status: "approved",
        legal_review_status: "not_required_original",
        reviewer_role: "founder_domain_reviewer",
        reviewed_at: "2026-06-16T00:00:00Z",
        decision: "approved_for_active_registry_candidate",
        decision_notes: "Original fixture record for contract proof only.",
        evidence_paths: [
          "docs/v1/V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM.md"
        ],
        copy_boundary_flags: [
          "original_or_licensed",
          "manual_review_recorded",
          "no_famous_coach_copy"
        ]
      }
    ],
    candidate_records: [
      {
        candidate_record_id: "fixture_original_exercise_record",
        registry_domain_id: "exercise_registry",
        candidate_record_type: "exercise",
        status: "active_registry_candidate",
        source_record_id: "source_positive_original_fixture",
        declared_originality_status: "original",
        content_summary: "Original fixture record for contract proof only."
      }
    ]
  };
}

test("S-V1-25 locks source-control register fields and closed status sets", () => {
  assert.deepEqual(lockedActivityIds, [
    "powerlifting",
    "general_strength",
    "rugby_union"
  ]);

  assert.ok(registryDomainIds.includes("programme_template_registry"));
  assert.ok(registryDomainIds.includes("exercise_registry"));
  assert.ok(requiredSourceControlFields.includes("source_status"));
  assert.ok(requiredSourceControlFields.includes("licence_status"));
  assert.ok(requiredSourceControlFields.includes("manual_review_status"));
  assert.ok(requiredSourceControlFields.includes("exact_copy_risk_status"));
});

test("S-V1-25 accepts original manually reviewed production candidate metadata", () => {
  const result = validateRegistryContentProductionSystem(makeApprovedOriginalFixture());

  assert.equal(result.ok, true);
  assert.equal(result.source_record_count, 1);
  assert.equal(result.candidate_record_count, 1);
});

test("S-V1-25 negative fixture refuses exact famous-coach programme copying", () => {
  const fixturePath = path.join(
    repoRoot,
    "ci",
    "fixtures",
    "v1_registry_content_production_system_negative",
    "s_v1_25_exact_famous_coach_copy_negative.json"
  );

  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

  assert.equal(fixture.slice_id, "S-V1-25");
  assert.equal(fixture.expected_failure_code, "v1_registry_content_production_system_exact_famous_coach_copy_refused");

  assert.throws(
    () => validateRegistryContentProductionSystem({
      source_control_register: fixture.source_control_register,
      candidate_records: fixture.candidate_records
    }),
    (error) =>
      error?.code === fixture.expected_failure_code &&
      error?.details?.source_record_id === fixture.source_control_register[0].source_record_id
  );
});

test("S-V1-25 refuses active candidates without manual review and licence permission", () => {
  const fixture = makeApprovedOriginalFixture();
  fixture.source_control_register[0] = {
    ...fixture.source_control_register[0],
    manual_review_status: "not_reviewed",
    reviewer_role: null,
    reviewed_at: null
  };

  assert.throws(
    () => validateRegistryContentProductionSystem(fixture),
    (error) => error?.code === "v1_registry_content_production_system_manual_review_required"
  );

  const unlicensed = makeApprovedOriginalFixture();
  unlicensed.source_control_register[0] = {
    ...unlicensed.source_control_register[0],
    source_status: "licensed_source",
    licence_status: "not_licensed",
    commercial_use_status: "not_permitted"
  };

  assert.throws(
    () => validateRegistryContentProductionSystem(unlicensed),
    (error) => error?.code === "v1_registry_content_production_system_licence_status_required"
  );
});

test("S-V1-25 refuses protected formula visibility and candidate copy semantics", () => {
  const formulaVisible = makeApprovedOriginalFixture();
  formulaVisible.source_control_register[0] = {
    ...formulaVisible.source_control_register[0],
    formula_visibility_status: "protected_formula_visible"
  };

  assert.throws(
    () => validateRegistryContentProductionSystem(formulaVisible),
    (error) => error?.code === "v1_registry_content_production_system_protected_formula_visibility_refused"
  );

  const forbiddenCandidate = makeApprovedOriginalFixture();
  forbiddenCandidate.candidate_records[0] = {
    ...forbiddenCandidate.candidate_records[0],
    content_summary: "This is an exact famous coach programme."
  };

  assert.throws(
    () => validateRegistryContentProductionSystem(forbiddenCandidate),
    (error) => error?.code === "v1_registry_content_production_system_forbidden_candidate_copy_semantic"
  );
});

test("S-V1-25 documentation binds production system without adding high-volume registry content", () => {
  const doc = fs.readFileSync(
    path.join(repoRoot, "docs", "v1", "V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM.md"),
    "utf8"
  );

  assert.match(doc, /S-V1-25/);
  assert.match(doc, /source-control register/);
  assert.match(doc, /manual_review_status/);
  assert.match(doc, /licence_status/);
  assert.match(doc, /exact_copy_risk_status/);
  assert.match(doc, /No exact famous-coach programme copying/);
  assert.match(doc, /No high-volume registry content is added by this slice/);
  assert.match(doc, /Content must be original or licensed/);
});
