// @law: Registry Law
// @severity: high
// @scope: registry
// @law v1_registry_content_production_contract
// @severity error
// @scope v1-registry


// DEV NOTE: CI guard surface. This file enforces a repo boundary and should fail closed with
// readable output. Do not weaken the guard to make a failing build pass; fix the underlying
// boundary drift or update the canonical contract deliberately.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();

const expectedActivities = Object.freeze([
  "powerlifting",
  "general_strength",
  "rugby_union"
]);

const expectedDomains = Object.freeze([
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

const requiredManifestFields = Object.freeze([
  "manifest_id",
  "manifest_version",
  "slice_id",
  "domain_id",
  "locked_activity_ids",
  "source_classification",
  "domain_owner",
  "reviewer_role",
  "review_status",
  "required_field_completion_status",
  "deterministic_id_policy",
  "stable_ordering_policy",
  "copy_legal_review_status",
  "claim_language_review_status",
  "unsupported_activity_leakage_check",
  "schema_target_match_status",
  "scaffold_domain_match_status",
  "content_execution_status",
  "acceptance_status"
]);

const sourceClasses = Object.freeze([
  "founder_domain_knowledge",
  "canonical_project_document",
  "public_rule_or_standard",
  "implementation_fixture",
  "copy_boundary_entry"
]);

const reviewStatuses = Object.freeze([
  "draft",
  "domain_reviewed",
  "copy_reviewed",
  "legally_bounded",
  "accepted"
]);

const contentExecutionStatuses = Object.freeze([
  "inert_contract_only",
  "inert_content_draft",
  "active_registry_candidate",
  "active_registry_accepted"
]);

const forbiddenDriftExamples = Object.freeze([
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
  console.error(`v1_registry_content_production_contract_guard: FAIL: ${message}`);
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

const scaffoldUrl = pathToFileURL(path.join(repoRoot, "shared/v1-registry/v1RegistryDomainScaffold.mjs")).href;
const scaffold = await import(`${scaffoldUrl}?cacheBust=${Date.now()}`);

if (!Array.isArray(scaffold.LOCKED_V1_ACTIVITY_IDS)) {
  fail("LOCKED_V1_ACTIVITY_IDS is not exported as an array");
}

if (scaffold.LOCKED_V1_ACTIVITY_IDS.length !== expectedActivities.length) {
  fail(`expected ${expectedActivities.length} locked activity ids`);
}

for (const activityId of expectedActivities) {
  if (!scaffold.LOCKED_V1_ACTIVITY_IDS.includes(activityId)) {
    fail(`missing locked activity id from scaffold: ${activityId}`);
  }
}

for (const activityId of scaffold.LOCKED_V1_ACTIVITY_IDS) {
  if (!expectedActivities.includes(activityId)) {
    fail(`unexpected locked activity id from scaffold: ${activityId}`);
  }
}

if (!Array.isArray(scaffold.V1_REGISTRY_DOMAIN_IDS)) {
  fail("V1_REGISTRY_DOMAIN_IDS is not exported as an array");
}

if (scaffold.V1_REGISTRY_DOMAIN_IDS.length !== expectedDomains.length) {
  fail(`expected ${expectedDomains.length} registry domain ids`);
}

for (const domainId of expectedDomains) {
  if (!scaffold.V1_REGISTRY_DOMAIN_IDS.includes(domainId)) {
    fail(`missing registry domain id from scaffold: ${domainId}`);
  }
}

for (const domainId of scaffold.V1_REGISTRY_DOMAIN_IDS) {
  if (!expectedDomains.includes(domainId)) {
    fail(`unexpected registry domain id from scaffold: ${domainId}`);
  }
}

const contractText = readText("docs/roadmap/V1_REGISTRY_CONTENT_PRODUCTION_CONTRACT.md");
const packageText = readText("package.json");
const guardsIndexText = readText("docs/GUARDS_INDEX.md");

for (const activityId of expectedActivities) {
  assertIncludes(contractText, activityId, "S22 contract locked activities");
}

for (const domainId of expectedDomains) {
  assertIncludes(contractText, domainId, "S22 contract registry domains");
}

for (const field of requiredManifestFields) {
  assertIncludes(contractText, field, "S22 production manifest fields");
}

for (const sourceClass of sourceClasses) {
  assertIncludes(contractText, sourceClass, "S22 source classification");
}

for (const status of reviewStatuses) {
  assertIncludes(contractText, status, "S22 review status values");
}

for (const status of contentExecutionStatuses) {
  assertIncludes(contractText, status, "S22 content execution status values");
}

for (const forbidden of forbiddenDriftExamples) {
  assertIncludes(contractText, forbidden, "S22 forbidden drift examples");
}

for (const requiredPhrase of [
  "deterministic id policy",
  "stable ordering policy",
  "required content-slice proof",
  "no registry content records are added",
  "no template records are added",
  "no UI screen is added",
  "no database migration is added",
  "no package version is changed",
  "no tag is created or moved",
  "S23 - v1 activity registry content draft contract"
]) {
  assertIncludes(contractText, requiredPhrase, "S22 required phrase");
}

assertIncludes(
  packageText,
  "node ci/guards/v1_registry_content_production_contract_guard.mjs",
  "package.json lint:fast"
);

assertIncludes(
  guardsIndexText,
  "v1_registry_content_production_contract_guard",
  "docs/GUARDS_INDEX.md"
);

console.log("OK: v1_registry_content_production_contract_guard");
