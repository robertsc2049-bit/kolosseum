import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

const TOKEN_PREFIX = "v1_template_registry_coverage_";

const lockedActivityIds = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

const requiredCoverageRootKeys = Object.freeze([
  "slice_id",
  "fixture_id",
  "coverage_contract_version",
  "required_activity_ids",
  "coverage_status",
  "coverage_entries"
]);

const optionalCoverageRootKeys = Object.freeze([
  "purpose",
  "expected_failure_code"
]);

const requiredCoverageEntryKeys = Object.freeze([
  "template_id",
  "template_status",
  "activity_id",
  "template_contract_version",
  "coverage_contract_version",
  "assignment_scope",
  "source_record_id",
  "source_control_status",
  "coverage_scope",
  "coverage_declaration_status",
  "template_language",
  "registry_bindings",
  "visibility_boundary",
  "copy_boundary_flags"
]);

const requiredRegistryBindingKeys = Object.freeze([
  "activity_id",
  "exercise_ids",
  "equipment_ids",
  "substitution_edge_ids",
  "applicability_ids"
]);

const requiredVisibilityBoundaryKeys = Object.freeze([
  "formula_payload_status",
  "progression_internals_status",
  "protected_logic_reference_status"
]);

const requiredTemplateLanguageKeys = Object.freeze([
  "title",
  "summary",
  "language_status"
]);

const forbiddenCoverageKeys = Object.freeze([
  "marketplace_listing_id",
  "marketplace_publish_status",
  "marketplace_scope",
  "royalty_rate",
  "royalty_recipient",
  "coach_to_coach_share_id",
  "coach_to_coach_sharing_scope",
  "protected_formula_payload",
  "progression_formula_payload",
  "recommendation_score",
  "optimisation_score",
  "readiness_score",
  "risk_score",
  "recommended_rank",
  "effectiveness_claim"
]);

const forbiddenClaimLanguage = Object.freeze([
  /\brecommend(?:ed|s|ation)?\b/i,
  /\boptimi[sz](?:e|es|ed|ation|ing)?\b/i,
  /\bbest\b/i,
  /\bbetter\b/i,
  /\bideal\b/i,
  /\bsafe(?:r|ty)?\b/i,
  /\brisk\b/i,
  /\breadiness\b/i,
  /\bfatigue\b/i,
  /\beffective(?:ness)?\b/i,
  /\bprogramme worked\b/i,
  /\bprogramme failed\b/i,
  /\btailored\b/i,
  /\bpersonalised\b/i,
  /\bguarantee(?:d|s)?\b/i,
  /\bproven\b/i
]);

function fail(code, message, details = {}) {
  const error = new Error(`${TOKEN_PREFIX}${code}: ${message}`);
  error.code = `${TOKEN_PREFIX}${code}`;
  error.details = details;
  throw error;
}

function assertPlainObject(value, code, message, details = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(code, message, details);
  }
}

function assertExactKeys(value, requiredKeys, code, details = {}, optionalKeys = []) {
  const keys = Object.keys(value).sort();
  const expectedSet = new Set([...requiredKeys, ...optionalKeys]);
  const requiredSet = new Set(requiredKeys);

  for (const key of keys) {
    if (!expectedSet.has(key)) {
      fail(code, "object contains unknown field", {
        ...details,
        field: key
      });
    }
  }

  for (const key of requiredSet) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail(code, "object missing required field", {
        ...details,
        field: key
      });
    }
  }
}

function assertNonEmptyString(value, code, details = {}) {
  if (typeof value !== "string" || value.length === 0) {
    fail(code, "expected non-empty string", details);
  }
}

function assertSortedUniqueStringArray(value, code, details = {}) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(code, "expected non-empty string array", details);
  }

  const seen = new Set();

  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) {
      fail(code, "array must contain non-empty strings only", details);
    }

    if (seen.has(item)) {
      fail("duplicate_array_value", "array contains duplicate value", {
        ...details,
        value: item
      });
    }

    seen.add(item);
  }
}

function assertNoForbiddenKeysDeep(value, pathParts = []) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeysDeep(item, [...pathParts, String(index)]));
    return;
  }

  for (const key of Object.keys(value)) {
    if (forbiddenCoverageKeys.includes(key)) {
      fail("forbidden_coverage_field", "template coverage contains a forbidden field", {
        path: [...pathParts, key].join("."),
        field: key
      });
    }

    assertNoForbiddenKeysDeep(value[key], [...pathParts, key]);
  }
}

function assertClaimSafeText(value, details = {}) {
  assertNonEmptyString(value, "template_language_text_invalid", details);

  for (const pattern of forbiddenClaimLanguage) {
    if (pattern.test(value)) {
      fail("template_language_claim_language_refused", "template language contains claim or advisory wording", {
        ...details,
        pattern: String(pattern)
      });
    }
  }
}

function validateCoverageEntry(entry) {
  assertPlainObject(entry, "coverage_entry_not_object", "coverage entry must be an object");
  assertExactKeys(entry, requiredCoverageEntryKeys, "coverage_entry_keys_invalid", {
    template_id: entry.template_id ?? null
  });

  assertNoForbiddenKeysDeep(entry);

  for (const field of [
    "template_id",
    "template_status",
    "activity_id",
    "template_contract_version",
    "coverage_contract_version",
    "assignment_scope",
    "source_record_id",
    "source_control_status",
    "coverage_scope",
    "coverage_declaration_status"
  ]) {
    assertNonEmptyString(entry[field], "coverage_entry_required_field_invalid", {
      field,
      template_id: entry.template_id ?? null
    });
  }

  if (!lockedActivityIds.includes(entry.activity_id)) {
    fail("unsupported_activity_refused", "template coverage may only target the locked v1 activity set", {
      template_id: entry.template_id,
      activity_id: entry.activity_id
    });
  }

  if (entry.template_status !== "declared_for_v1_coverage") {
    fail("template_status_invalid", "template coverage must be declared rather than marketplace or sharing state", {
      template_id: entry.template_id
    });
  }

  if (entry.template_contract_version !== "S-V1-26") {
    fail("template_contract_version_invalid", "template coverage must bind to S-V1-26", {
      template_id: entry.template_id
    });
  }

  if (entry.coverage_contract_version !== "S-V1-27") {
    fail("coverage_contract_version_invalid", "template coverage must bind to S-V1-27", {
      template_id: entry.template_id
    });
  }

  if (entry.assignment_scope !== "coach_athlete_assigned_execution") {
    fail("assignment_scope_invalid", "template coverage must support assigned coach-athlete execution only", {
      template_id: entry.template_id
    });
  }

  if (entry.source_control_status !== "approved") {
    fail("source_control_status_required", "template coverage requires approved source-control status", {
      template_id: entry.template_id
    });
  }

  if (entry.coverage_scope !== "supported_activity_required_template") {
    fail("coverage_scope_invalid", "template coverage scope must be supported_activity_required_template", {
      template_id: entry.template_id
    });
  }

  if (entry.coverage_declaration_status !== "declared") {
    fail("coverage_declaration_status_invalid", "template coverage must be explicitly declared", {
      template_id: entry.template_id
    });
  }

  assertPlainObject(entry.template_language, "template_language_not_object", "template_language must be an object", {
    template_id: entry.template_id
  });
  assertExactKeys(entry.template_language, requiredTemplateLanguageKeys, "template_language_keys_invalid", {
    template_id: entry.template_id
  });

  if (entry.template_language.language_status !== "claim_safe") {
    fail("template_language_status_invalid", "template language must be marked claim_safe", {
      template_id: entry.template_id
    });
  }

  assertClaimSafeText(entry.template_language.title, {
    template_id: entry.template_id,
    field: "title"
  });

  assertClaimSafeText(entry.template_language.summary, {
    template_id: entry.template_id,
    field: "summary"
  });

  assertPlainObject(entry.registry_bindings, "registry_bindings_not_object", "registry_bindings must be an object", {
    template_id: entry.template_id
  });
  assertExactKeys(entry.registry_bindings, requiredRegistryBindingKeys, "registry_bindings_keys_invalid", {
    template_id: entry.template_id
  });

  if (entry.registry_bindings.activity_id !== entry.activity_id) {
    fail("registry_activity_mismatch", "registry_bindings.activity_id must match coverage activity_id", {
      template_id: entry.template_id
    });
  }

  assertSortedUniqueStringArray(entry.registry_bindings.exercise_ids, "exercise_bindings_invalid", {
    template_id: entry.template_id
  });
  assertSortedUniqueStringArray(entry.registry_bindings.equipment_ids, "equipment_bindings_invalid", {
    template_id: entry.template_id
  });
  assertSortedUniqueStringArray(entry.registry_bindings.substitution_edge_ids, "substitution_bindings_invalid", {
    template_id: entry.template_id
  });
  assertSortedUniqueStringArray(entry.registry_bindings.applicability_ids, "applicability_bindings_invalid", {
    template_id: entry.template_id
  });

  assertPlainObject(entry.visibility_boundary, "visibility_boundary_not_object", "visibility_boundary must be an object", {
    template_id: entry.template_id
  });
  assertExactKeys(entry.visibility_boundary, requiredVisibilityBoundaryKeys, "visibility_boundary_keys_invalid", {
    template_id: entry.template_id
  });

  if (entry.visibility_boundary.formula_payload_status !== "not_present") {
    fail("formula_payload_refused", "formula payloads must not be visible in template coverage", {
      template_id: entry.template_id
    });
  }

  if (entry.visibility_boundary.progression_internals_status !== "not_present") {
    fail("progression_internals_refused", "progression internals must not be visible in template coverage", {
      template_id: entry.template_id
    });
  }

  if (entry.visibility_boundary.protected_logic_reference_status !== "opaque_reference_only") {
    fail("protected_logic_reference_invalid", "protected logic reference must be opaque only", {
      template_id: entry.template_id
    });
  }

  assertSortedUniqueStringArray(entry.copy_boundary_flags, "copy_boundary_flags_invalid", {
    template_id: entry.template_id
  });

  for (const flag of [
    "formula_payload_not_visible",
    "no_coach_to_coach_sharing_scope",
    "no_marketplace_scope",
    "no_royalty_scope",
    "registry_bound"
  ]) {
    if (!entry.copy_boundary_flags.includes(flag)) {
      fail("copy_boundary_flag_missing", "required copy boundary flag missing", {
        template_id: entry.template_id,
        flag
      });
    }
  }

  return entry.activity_id;
}

function validateTemplateRegistryCoverage(coverage) {
  assertPlainObject(coverage, "coverage_not_object", "coverage must be an object");
  assertExactKeys(
    coverage,
    requiredCoverageRootKeys,
    "coverage_root_keys_invalid",
    {},
    optionalCoverageRootKeys
  );

  if (coverage.slice_id !== "S-V1-27") {
    fail("slice_id_invalid", "coverage slice_id must be S-V1-27");
  }

  if (coverage.coverage_contract_version !== "S-V1-27") {
    fail("coverage_contract_version_invalid", "coverage_contract_version must be S-V1-27");
  }

  assert.deepEqual(coverage.required_activity_ids, lockedActivityIds, `${TOKEN_PREFIX}required_activity_ids_invalid`);

  if (!Array.isArray(coverage.coverage_entries) || coverage.coverage_entries.length === 0) {
    fail("coverage_entries_missing", "coverage_entries must be non-empty");
  }

  const seenTemplateIds = new Set();
  const coveredActivities = new Set();

  for (const entry of coverage.coverage_entries) {
    const activityId = validateCoverageEntry(entry);

    if (seenTemplateIds.has(entry.template_id)) {
      fail("duplicate_template_id", "template_id must be unique", {
        template_id: entry.template_id
      });
    }

    seenTemplateIds.add(entry.template_id);
    coveredActivities.add(activityId);
  }

  for (const activityId of lockedActivityIds) {
    if (!coveredActivities.has(activityId)) {
      fail("missing_required_activity_coverage", "missing required template coverage for locked activity", {
        activity_id: activityId
      });
    }
  }

  if (coverage.coverage_status !== "declared_complete") {
    fail("coverage_status_invalid", "coverage_status must be declared_complete when all locked activities are covered");
  }

  return {
    ok: true,
    activity_count: coveredActivities.size,
    template_count: seenTemplateIds.size
  };
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

test("S-V1-27 locks template coverage to the v1 supported activity set", () => {
  assert.deepEqual(lockedActivityIds, [
    "powerlifting",
    "general_strength",
    "rugby_union"
  ]);
});

test("S-V1-27 accepts explicit declared template coverage for each supported activity", () => {
  const fixture = readJson("ci/fixtures/v1_template_registry_coverage/s_v1_27_template_registry_coverage_valid.json");
  const result = validateTemplateRegistryCoverage(fixture);

  assert.equal(result.ok, true);
  assert.equal(result.activity_count, 3);
  assert.equal(result.template_count, 3);
});

test("S-V1-27 missing required template coverage fails closed", () => {
  const fixture = readJson("ci/fixtures/v1_template_registry_coverage_negative/s_v1_27_missing_template_coverage_negative.json");

  assert.equal(fixture.expected_failure_code, "v1_template_registry_coverage_missing_required_activity_coverage");

  assert.throws(
    () => validateTemplateRegistryCoverage(fixture),
    (error) =>
      error?.code === fixture.expected_failure_code &&
      error?.details?.activity_id === "rugby_union"
  );
});

test("S-V1-27 rejects marketplace publishing and coach-to-coach sharing fields", () => {
  const fixture = readJson("ci/fixtures/v1_template_registry_coverage/s_v1_27_template_registry_coverage_valid.json");

  fixture.coverage_entries[0].marketplace_publish_status = "published";

  assert.throws(
    () => validateTemplateRegistryCoverage(fixture),
    (error) => error?.code === "v1_template_registry_coverage_coverage_entry_keys_invalid"
  );

  const sharing = readJson("ci/fixtures/v1_template_registry_coverage/s_v1_27_template_registry_coverage_valid.json");
  sharing.coverage_entries[0].coach_to_coach_share_id = "share_001";

  assert.throws(
    () => validateTemplateRegistryCoverage(sharing),
    (error) => error?.code === "v1_template_registry_coverage_coverage_entry_keys_invalid"
  );
});

test("S-V1-27 rejects claim language in template coverage strings", () => {
  const fixture = readJson("ci/fixtures/v1_template_registry_coverage/s_v1_27_template_registry_coverage_valid.json");

  fixture.coverage_entries[0].template_language.summary = "Recommended template coverage for powerlifting.";

  assert.throws(
    () => validateTemplateRegistryCoverage(fixture),
    (error) => error?.code === "v1_template_registry_coverage_template_language_claim_language_refused"
  );
});

test("S-V1-27 rejects visible formula and progression internals", () => {
  const fixture = readJson("ci/fixtures/v1_template_registry_coverage/s_v1_27_template_registry_coverage_valid.json");

  fixture.coverage_entries[0].visibility_boundary.formula_payload_status = "visible_formula_payload";

  assert.throws(
    () => validateTemplateRegistryCoverage(fixture),
    (error) => error?.code === "v1_template_registry_coverage_formula_payload_refused"
  );

  const progression = readJson("ci/fixtures/v1_template_registry_coverage/s_v1_27_template_registry_coverage_valid.json");
  progression.coverage_entries[0].visibility_boundary.progression_internals_status = "visible_progression_internals";

  assert.throws(
    () => validateTemplateRegistryCoverage(progression),
    (error) => error?.code === "v1_template_registry_coverage_progression_internals_refused"
  );
});

test("S-V1-27 documentation binds template coverage without active publishing or sharing scope", () => {
  const doc = fs.readFileSync(
    path.join(repoRoot, "docs", "v1", "V1_TEMPLATE_REGISTRY_COVERAGE.md"),
    "utf8"
  );

  assert.match(doc, /S-V1-27/);
  assert.match(doc, /template registry coverage/);
  assert.match(doc, /Template coverage is explicit/);
  assert.match(doc, /missing required template coverage fails closed/);
  assert.match(doc, /Template language remains claim-safe/);
  assert.match(doc, /No active marketplace publishing is added by this slice/);
  assert.match(doc, /No coach-to-coach sharing is added by this slice/);
});
