// @law: v1 Template Registry Coverage
// @severity: high
// @scope: v1-registry

// DEV NOTE: S-V1-27 coverage guard. This guard proves explicit declared
// template coverage for the locked v1 activity set. It must remain a registry
// coverage contract surface only: no marketplace publishing, coach-to-coach
// sharing, visible formula/progression internals, UI, database, or engine change.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const TOKEN = "CI_V1_TEMPLATE_REGISTRY_COVERAGE";
const TOKEN_PREFIX = "v1_template_registry_coverage_";

const lockedActivityIds = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

const requiredFiles = Object.freeze([
  "docs/v1/V1_TEMPLATE_REGISTRY_COVERAGE.md",
  "ci/fixtures/v1_template_registry_coverage/s_v1_27_template_registry_coverage_valid.json",
  "ci/fixtures/v1_template_registry_coverage_negative/s_v1_27_missing_template_coverage_negative.json",
  "test/s_v1_27_template_registry_coverage.test.mjs",
  "ci/guards/s_v1_27_template_registry_coverage_guard.mjs",
  "docs/v1/V1_PROGRAMME_TEMPLATE_CONTRACT.md",
  "docs/v1/V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM.md",
  "docs/v1/V1_SUPPORTED_ACTIVITY_SET_LOCK.md"
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

function failGuard(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: "S-V1-27",
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

function assertPlainObject(value, code, message, details = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    contractFail(code, message, details);
  }
}

function assertExactKeys(value, requiredKeys, code, details = {}, optionalKeys = []) {
  const keys = Object.keys(value);
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  const required = new Set(requiredKeys);

  for (const key of keys) {
    if (!allowed.has(key)) {
      contractFail(code, "object contains unknown field", {
        ...details,
        field: key
      });
    }
  }

  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      contractFail(code, "object missing required field", {
        ...details,
        field: key
      });
    }
  }
}

function assertNonEmptyString(value, code, details = {}) {
  if (typeof value !== "string" || value.length === 0) {
    contractFail(code, "expected non-empty string", details);
  }
}

function assertStringArray(value, code, details = {}) {
  if (!Array.isArray(value) || value.length === 0) {
    contractFail(code, "expected non-empty string array", details);
  }

  const seen = new Set();

  for (const item of value) {
    if (typeof item !== "string" || item.length === 0) {
      contractFail(code, "array must contain non-empty strings only", details);
    }

    if (seen.has(item)) {
      contractFail("duplicate_array_value", "array contains duplicate value", {
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
      contractFail("forbidden_coverage_field", "template coverage contains a forbidden field", {
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
      contractFail("template_language_claim_language_refused", "template language contains claim or advisory wording", {
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
    contractFail("unsupported_activity_refused", "template coverage may only target the locked v1 activity set", {
      template_id: entry.template_id,
      activity_id: entry.activity_id
    });
  }

  if (entry.template_status !== "declared_for_v1_coverage") {
    contractFail("template_status_invalid", "template coverage must be declared coverage state only", {
      template_id: entry.template_id
    });
  }

  if (entry.template_contract_version !== "S-V1-26") {
    contractFail("template_contract_version_invalid", "template coverage must bind to S-V1-26", {
      template_id: entry.template_id
    });
  }

  if (entry.coverage_contract_version !== "S-V1-27") {
    contractFail("coverage_contract_version_invalid", "template coverage must bind to S-V1-27", {
      template_id: entry.template_id
    });
  }

  if (entry.assignment_scope !== "coach_athlete_assigned_execution") {
    contractFail("assignment_scope_invalid", "template coverage must support assigned coach-athlete execution only", {
      template_id: entry.template_id
    });
  }

  if (entry.source_control_status !== "approved") {
    contractFail("source_control_status_required", "template coverage requires approved source-control status", {
      template_id: entry.template_id
    });
  }

  if (entry.coverage_scope !== "supported_activity_required_template") {
    contractFail("coverage_scope_invalid", "template coverage scope must be supported_activity_required_template", {
      template_id: entry.template_id
    });
  }

  if (entry.coverage_declaration_status !== "declared") {
    contractFail("coverage_declaration_status_invalid", "template coverage must be explicitly declared", {
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
    contractFail("template_language_status_invalid", "template language must be marked claim_safe", {
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
    contractFail("registry_activity_mismatch", "registry_bindings.activity_id must match coverage activity_id", {
      template_id: entry.template_id
    });
  }

  for (const field of [
    "exercise_ids",
    "equipment_ids",
    "substitution_edge_ids",
    "applicability_ids"
  ]) {
    assertStringArray(entry.registry_bindings[field], "registry_binding_array_invalid", {
      template_id: entry.template_id,
      field
    });
  }

  assertPlainObject(entry.visibility_boundary, "visibility_boundary_not_object", "visibility_boundary must be an object", {
    template_id: entry.template_id
  });
  assertExactKeys(entry.visibility_boundary, requiredVisibilityBoundaryKeys, "visibility_boundary_keys_invalid", {
    template_id: entry.template_id
  });

  if (entry.visibility_boundary.formula_payload_status !== "not_present") {
    contractFail("formula_payload_refused", "formula payloads must not be visible in template coverage", {
      template_id: entry.template_id
    });
  }

  if (entry.visibility_boundary.progression_internals_status !== "not_present") {
    contractFail("progression_internals_refused", "progression internals must not be visible in template coverage", {
      template_id: entry.template_id
    });
  }

  if (entry.visibility_boundary.protected_logic_reference_status !== "opaque_reference_only") {
    contractFail("protected_logic_reference_invalid", "protected logic reference must be opaque only", {
      template_id: entry.template_id
    });
  }

  assertStringArray(entry.copy_boundary_flags, "copy_boundary_flags_invalid", {
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
      contractFail("copy_boundary_flag_missing", "required copy boundary flag missing", {
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
    contractFail("slice_id_invalid", "coverage slice_id must be S-V1-27");
  }

  if (coverage.coverage_contract_version !== "S-V1-27") {
    contractFail("coverage_contract_version_invalid", "coverage_contract_version must be S-V1-27");
  }

  if (JSON.stringify(coverage.required_activity_ids) !== JSON.stringify(lockedActivityIds)) {
    contractFail("required_activity_ids_invalid", "required_activity_ids must match locked v1 activity order", {
      required_activity_ids: coverage.required_activity_ids
    });
  }

  if (!Array.isArray(coverage.coverage_entries) || coverage.coverage_entries.length === 0) {
    contractFail("coverage_entries_missing", "coverage_entries must be non-empty");
  }

  const seenTemplateIds = new Set();
  const coveredActivities = new Set();

  for (const entry of coverage.coverage_entries) {
    const activityId = validateCoverageEntry(entry);

    if (seenTemplateIds.has(entry.template_id)) {
      contractFail("duplicate_template_id", "template_id must be unique", {
        template_id: entry.template_id
      });
    }

    seenTemplateIds.add(entry.template_id);
    coveredActivities.add(activityId);
  }

  for (const activityId of lockedActivityIds) {
    if (!coveredActivities.has(activityId)) {
      contractFail("missing_required_activity_coverage", "missing required template coverage for locked activity", {
        activity_id: activityId
      });
    }
  }

  if (coverage.coverage_status !== "declared_complete") {
    contractFail("coverage_status_invalid", "coverage_status must be declared_complete when all locked activities are covered");
  }

  return {
    ok: true,
    activity_count: coveredActivities.size,
    template_count: seenTemplateIds.size
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
  "registries/programme_template/programme_template.registry.json",
  "registries/programme_template.registry.json",
  "registries/template_coverage/template_coverage.registry.json",
  "shared/v1-registry/v1TemplateRegistryCoverage.mjs",
  "src/templateRegistryCoverage.mjs"
]) {
  if (fs.existsSync(path.join(repoRoot, forbiddenPath))) {
    failGuard(`forbidden active or shared implementation surface present: ${forbiddenPath}`);
  }
}

const positiveFixture = readJson("ci/fixtures/v1_template_registry_coverage/s_v1_27_template_registry_coverage_valid.json");
const negativeFixture = readJson("ci/fixtures/v1_template_registry_coverage_negative/s_v1_27_missing_template_coverage_negative.json");

const positive = validateTemplateRegistryCoverage(positiveFixture);

if (positive.activity_count !== lockedActivityIds.length) {
  failGuard("positive coverage fixture did not cover every locked activity");
}

if (negativeFixture.expected_failure_code !== "v1_template_registry_coverage_missing_required_activity_coverage") {
  failGuard("negative fixture expected_failure_code mismatch");
}

const error = assertThrowsWithCode(
  () => validateTemplateRegistryCoverage(negativeFixture),
  negativeFixture.expected_failure_code,
  "missing required template coverage negative fixture"
);

if (error.details?.activity_id !== "rugby_union") {
  failGuard("negative fixture failed for wrong missing activity");
}

const docText = readText("docs/v1/V1_TEMPLATE_REGISTRY_COVERAGE.md");
const s26Text = readText("docs/v1/V1_PROGRAMME_TEMPLATE_CONTRACT.md");
const s25Text = readText("docs/v1/V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM.md");
const packageText = readText("package.json");
const guardsIndexText = readText("docs/GUARDS_INDEX.md");
const failureTokenText = readText("docs/dev/FAILURE_TOKEN_INDEX.md");

for (const requiredText of [
  "S-V1-27",
  "template registry coverage",
  "Template coverage is explicit",
  "missing required template coverage fails closed",
  "Template language remains claim-safe",
  "No active marketplace publishing is added by this slice",
  "No coach-to-coach sharing is added by this slice",
  "powerlifting",
  "general_strength",
  "rugby_union",
  "declared_for_v1_coverage",
  "coach_athlete_assigned_execution",
  "formula_payload_not_visible",
  "no_marketplace_scope",
  "no_royalty_scope",
  "no_coach_to_coach_sharing_scope"
]) {
  assertIncludes(docText, requiredText, "docs/v1/V1_TEMPLATE_REGISTRY_COVERAGE.md");
}

for (const requiredText of [
  "programme template contract",
  "coach_athlete_assigned_execution",
  "formula and progression internals remain protected",
  "marketplace and royalties remain out of scope"
]) {
  assertIncludes(s26Text, requiredText, "docs/v1/V1_PROGRAMME_TEMPLATE_CONTRACT.md");
}

for (const requiredText of [
  "source-control register",
  "Content must be original or licensed",
  "manual_review_status",
  "licence_status"
]) {
  assertIncludes(s25Text, requiredText, "docs/v1/V1_REGISTRY_CONTENT_PRODUCTION_SYSTEM.md");
}

assertIncludes(
  packageText,
  "node --test test/s_v1_27_template_registry_coverage.test.mjs",
  "package.json lint:fast"
);

assertIncludes(
  packageText,
  "node ci/guards/s_v1_27_template_registry_coverage_guard.mjs",
  "package.json lint:fast"
);

assertIncludes(
  guardsIndexText,
  "s_v1_27_template_registry_coverage_guard",
  "docs/GUARDS_INDEX.md"
);

assertIncludes(
  failureTokenText,
  TOKEN,
  "docs/dev/FAILURE_TOKEN_INDEX.md"
);

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-27",
  token: TOKEN,
  message: "Template registry coverage passed."
}));
