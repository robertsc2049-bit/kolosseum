// @law: Registry Law
// @severity: high
// @scope: registry
// @law v1_registry_schema_target
// @severity error
// @scope v1-registry

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();

const expectedActivities = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

const requiredDomains = Object.freeze([
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

const requiredFieldGroups = Object.freeze({
  activity_registry: [
    "activity_id",
    "display_label",
    "allowed_movement_patterns",
    "allowed_exercise_families",
    "allowed_equipment_classes",
    "allowed_programme_template_types",
    "allowed_substitution_scope",
    "excluded_claim_language",
    "copy_legal_boundary_notes"
  ],
  movement_pattern_registry: [
    "movement_pattern_id",
    "display_label",
    "activity_applicability",
    "exercise_family",
    "substitution_scope",
    "copy_legal_boundary_notes"
  ],
  exercise_registry: [
    "exercise_id",
    "display_label",
    "movement_pattern_id",
    "primary_activity_applicability",
    "secondary_activity_applicability",
    "equipment_requirements",
    "equipment_alternatives",
    "difficulty_tier",
    "joint_stress_tags",
    "stimulus_intent",
    "instruction_short_text",
    "instruction_detail_text",
    "contraindication_or_exclusion_tags",
    "substitution_eligibility",
    "template_eligibility",
    "copy_legal_boundary_flags"
  ],
  equipment_registry: [
    "equipment_id",
    "display_label",
    "equipment_class",
    "activity_applicability",
    "movement_pattern_applicability",
    "substitution_relevance",
    "template_relevance",
    "low_equipment_alternative_relevance",
    "copy_legal_boundary_notes"
  ],
  substitution_edge_registry: [
    "substitution_edge_id",
    "source_exercise_id",
    "target_exercise_id",
    "movement_pattern_preservation",
    "stimulus_intent_preservation",
    "equipment_change_type",
    "excluded_equipment_handling",
    "joint_stress_handling",
    "activity_applicability",
    "difficulty_tier_compatibility",
    "deterministic_ordering_key",
    "copy_legal_boundary_notes"
  ],
  programme_template_registry: [
    "template_id",
    "activity_id",
    "template_version",
    "intended_programme_length",
    "session_frequency",
    "movement_pattern_coverage",
    "exercise_eligibility",
    "equipment_requirements",
    "substitution_compatibility",
    "progression_mode_boundary",
    "copy_legal_boundary_notes",
    "status"
  ],
  copy_legal_claim_boundary_registry: [
    "copy_id",
    "copy_category",
    "allowed_phrase",
    "forbidden_phrase_references",
    "supported_surface",
    "activity_applicability",
    "status"
  ]
});

const excludedSchemaDriftExamples = Object.freeze([
  "strongman",
  "bodybuilding",
  "weightlifting",
  "combat_sports",
  "tactical_pack",
  "rehabilitation_pack",
  "youth_pack",
  "organisation",
  "team_dashboard",
  "gym_access",
  "marketplace",
  "messaging",
  "epos",
  "broad_analytics"
]);

function fail(message) {
  console.error(`v1_registry_schema_target_guard: FAIL: ${message}`);
  process.exit(1);
}

function readText(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);

  if (!fs.existsSync(fullPath)) {
    fail(`missing required file: ${relativePath}`);
  }

  return fs.readFileSync(fullPath, "utf8");
}

function assertIncludes(text, required, context) {
  if (!text.includes(required)) {
    fail(`${context} missing required text: ${required}`);
  }
}

const boundaryModuleUrl = pathToFileURL(path.join(repoRoot, "shared/v1-boundary/v1BoundaryGuards.mjs")).href;
const boundary = await import(`${boundaryModuleUrl}?cacheBust=${Date.now()}`);

if (!Array.isArray(boundary.V1_SUPPORTED_ACTIVITIES)) {
  fail("V1_SUPPORTED_ACTIVITIES is not exported as an array");
}

if (boundary.V1_SUPPORTED_ACTIVITIES.length !== expectedActivities.length) {
  fail(`expected exactly ${expectedActivities.length} v1 activities`);
}

for (const activityId of expectedActivities) {
  if (!boundary.V1_SUPPORTED_ACTIVITIES.includes(activityId)) {
    fail(`locked activity missing from boundary scaffold: ${activityId}`);
  }
}

for (const activityId of boundary.V1_SUPPORTED_ACTIVITIES) {
  if (!expectedActivities.includes(activityId)) {
    fail(`unexpected active v1 activity: ${activityId}`);
  }
}

const schemaTargetDoc = readText("docs/roadmap/V1_REGISTRY_SCHEMA_TARGET_HARDENING.md");
const registryTargetDoc = readText("docs/roadmap/V1_REGISTRY_EXPANSION_TARGET.md");
const packageText = readText("package.json");
const guardsIndexText = readText("docs/GUARDS_INDEX.md");

for (const activityId of expectedActivities) {
  assertIncludes(schemaTargetDoc, activityId, "S20 roadmap doc");
  assertIncludes(registryTargetDoc, activityId, "S13 registry target doc");
}

for (const domain of requiredDomains) {
  assertIncludes(schemaTargetDoc, domain, "S20 roadmap doc required domain");
}

for (const [domain, fields] of Object.entries(requiredFieldGroups)) {
  assertIncludes(schemaTargetDoc, domain, "S20 roadmap doc field domain");

  for (const field of fields) {
    assertIncludes(schemaTargetDoc, field, `S20 roadmap doc field group ${domain}`);
  }
}

for (const forbidden of excludedSchemaDriftExamples) {
  assertIncludes(schemaTargetDoc, forbidden, "S20 roadmap doc forbidden drift examples");
}

assertIncludes(
  packageText,
  "node ci/guards/v1_registry_schema_target_guard.mjs",
  "package.json lint:fast"
);

assertIncludes(
  guardsIndexText,
  "v1_registry_schema_target_guard",
  "docs/GUARDS_INDEX.md"
);

console.log("OK: v1_registry_schema_target_guard");
