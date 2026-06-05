// @law: Registry Law
// @severity: high
// @scope: registry
// @law v1_registry_domain_scaffold
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

function fail(message) {
  console.error(`v1_registry_domain_scaffold_guard: FAIL: ${message}`);
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

const scaffoldModuleUrl = pathToFileURL(path.join(repoRoot, "shared/v1-registry/v1RegistryDomainScaffold.mjs")).href;
const scaffold = await import(`${scaffoldModuleUrl}?cacheBust=${Date.now()}`);

if (!Array.isArray(scaffold.LOCKED_V1_ACTIVITY_IDS)) {
  fail("LOCKED_V1_ACTIVITY_IDS is not an array");
}

if (scaffold.LOCKED_V1_ACTIVITY_IDS.length !== expectedActivities.length) {
  fail(`expected ${expectedActivities.length} locked activities`);
}

for (const activityId of expectedActivities) {
  if (!scaffold.LOCKED_V1_ACTIVITY_IDS.includes(activityId)) {
    fail(`missing locked activity id: ${activityId}`);
  }
}

for (const activityId of scaffold.LOCKED_V1_ACTIVITY_IDS) {
  if (!expectedActivities.includes(activityId)) {
    fail(`unexpected locked activity id: ${activityId}`);
  }
}

if (!Array.isArray(scaffold.V1_REGISTRY_DOMAIN_IDS)) {
  fail("V1_REGISTRY_DOMAIN_IDS is not an array");
}

if (scaffold.V1_REGISTRY_DOMAIN_IDS.length !== expectedDomains.length) {
  fail(`expected ${expectedDomains.length} registry domains`);
}

for (const domainId of expectedDomains) {
  if (!scaffold.V1_REGISTRY_DOMAIN_IDS.includes(domainId)) {
    fail(`missing registry domain id: ${domainId}`);
  }
}

for (const domainId of scaffold.V1_REGISTRY_DOMAIN_IDS) {
  if (!expectedDomains.includes(domainId)) {
    fail(`unexpected registry domain id: ${domainId}`);
  }
}

if (!scaffold.V1_REGISTRY_DOMAIN_REQUIRED_FIELDS || typeof scaffold.V1_REGISTRY_DOMAIN_REQUIRED_FIELDS !== "object") {
  fail("V1_REGISTRY_DOMAIN_REQUIRED_FIELDS is not an object");
}

for (const domainId of expectedDomains) {
  const fields = scaffold.V1_REGISTRY_DOMAIN_REQUIRED_FIELDS[domainId];

  if (!Array.isArray(fields)) {
    fail(`required fields missing for domain: ${domainId}`);
  }

  if (fields.length === 0) {
    fail(`required fields empty for domain: ${domainId}`);
  }

  for (const field of fields) {
    if (typeof field !== "string" || field.length === 0) {
      fail(`invalid required field in domain: ${domainId}`);
    }
  }
}

if (!Array.isArray(scaffold.V1_REGISTRY_DOMAIN_SCAFFOLD)) {
  fail("V1_REGISTRY_DOMAIN_SCAFFOLD is not an array");
}

if (scaffold.V1_REGISTRY_DOMAIN_SCAFFOLD.length !== expectedDomains.length) {
  fail("domain scaffold length mismatch");
}

for (const entry of scaffold.V1_REGISTRY_DOMAIN_SCAFFOLD) {
  if (!entry || typeof entry !== "object") {
    fail("domain scaffold entry is not an object");
  }

  if (!expectedDomains.includes(entry.domain_id)) {
    fail(`unknown scaffold domain id: ${entry.domain_id}`);
  }

  if (!Array.isArray(entry.required_fields) || entry.required_fields.length === 0) {
    fail(`scaffold entry missing required fields: ${entry.domain_id}`);
  }
}

const scaffoldText = readText("shared/v1-registry/v1RegistryDomainScaffold.mjs");

for (const forbidden of [
  "registry_records",
  "exercise_records",
  "equipment_records",
  "substitution_edges",
  "template_records",
  "migration",
  "ui_state"
]) {
  if (scaffoldText.includes(`export const ${forbidden}`) || scaffoldText.includes(`${forbidden} = [`)) {
    fail(`forbidden content surface found in scaffold: ${forbidden}`);
  }
}

const roadmapText = readText("docs/roadmap/V1_REGISTRY_DOMAIN_SCAFFOLD.md");
const packageText = readText("package.json");
const guardsIndexText = readText("docs/GUARDS_INDEX.md");

for (const domainId of expectedDomains) {
  assertIncludes(roadmapText, domainId, "S21 roadmap doc");
}

for (const activityId of expectedActivities) {
  assertIncludes(roadmapText, activityId, "S21 roadmap doc");
}

assertIncludes(
  packageText,
  "node ci/guards/v1_registry_domain_scaffold_guard.mjs",
  "package.json lint:fast"
);

assertIncludes(
  guardsIndexText,
  "v1_registry_domain_scaffold_guard",
  "docs/GUARDS_INDEX.md"
);

console.log("OK: v1_registry_domain_scaffold_guard");
