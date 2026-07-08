
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const classifierPath = path.join(repoRoot, "scripts", "classify-doc-authority.mjs");
const jsonPath = path.join(repoRoot, "docs", "dev", "doc-authority-classification.json");
const markdownPath = path.join(repoRoot, "docs", "dev", "DOC_AUTHORITY_CLASSIFICATION.md");

const requiredCategories = [
  "release-boundary",
  "engine-contract",
  "registry-contract",
  "proof-and-replay",
  "slice-contract",
  "developer-navigation",
  "commercial-or-copy-boundary",
  "historical-or-roadmap",
  "review-needed",
  "unclassified"
];

const failures = [];

if (!fs.existsSync(classifierPath)) {
  failures.push("Missing classifier script: scripts/classify-doc-authority.mjs");
}

if (failures.length === 0) {
  execFileSync(process.execPath, [classifierPath], {
    cwd: repoRoot,
    stdio: "inherit"
  });
}

if (!fs.existsSync(jsonPath)) {
  failures.push("Missing classification manifest: docs/dev/doc-authority-classification.json");
}

if (!fs.existsSync(markdownPath)) {
  failures.push("Missing classification document: docs/dev/DOC_AUTHORITY_CLASSIFICATION.md");
}

let manifest = null;

if (fs.existsSync(jsonPath)) {
  try {
    manifest = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch (error) {
    failures.push(`Classification JSON is not valid JSON: ${error.message}`);
  }
}

if (manifest) {
  if (manifest.schema_id !== "kolosseum_doc_authority_classification") {
    failures.push("Unexpected schema_id.");
  }

  if (manifest.schema_version !== "1.0.0") {
    failures.push("Unexpected schema_version.");
  }

  for (const category of requiredCategories) {
    if (!manifest.categories.includes(category)) {
      failures.push(`Missing category: ${category}`);
    }
  }

  const boundary = manifest.boundary ?? {};

  const requiredBoundaryFlags = [
    "classification_is_metadata_only",
    "does_not_create_authority",
    "does_not_deprecate_documents",
    "does_not_delete_documents",
    "does_not_rewrite_documents",
    "does_not_change_product_scope",
    "does_not_change_engine_behaviour",
    "does_not_change_registry_behaviour",
    "does_not_change_proof_behaviour",
    "does_not_introduce_ai_or_rag_dependency"
  ];

  for (const flag of requiredBoundaryFlags) {
    if (boundary[flag] !== true) {
      failures.push(`Missing or false boundary flag: ${flag}`);
    }
  }

  if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    failures.push("Manifest entries are missing or empty.");
  }

  for (const entry of manifest.entries ?? []) {
    if (!entry.path || typeof entry.path !== "string") {
      failures.push("Manifest entry missing path.");
      continue;
    }

    if (!requiredCategories.includes(entry.primary_category)) {
      failures.push(`Invalid category for ${entry.path}: ${entry.primary_category}`);
    }

    if (!["classified", "review-needed"].includes(entry.review_status)) {
      failures.push(`Invalid review status for ${entry.path}: ${entry.review_status}`);
    }

    if (entry.authority_effect !== "metadata-only") {
      failures.push(`Invalid authority effect for ${entry.path}: ${entry.authority_effect}`);
    }
  }
}

if (fs.existsSync(markdownPath)) {
  const markdown = fs.readFileSync(markdownPath, "utf8");

  const requiredSections = [
    "# Documentation Authority Classification",
    "## Purpose",
    "## Non-Goals",
    "## Classification Rule",
    "## Summary",
    "## Category Counts",
    "## Review Status Counts",
    "## Classification Entries",
    "## Next Safe Move",
    "## Limits"
  ];

  for (const section of requiredSections) {
    if (!markdown.includes(section)) {
      failures.push(`Classification markdown missing section: ${section}`);
    }
  }

  const requiredPhrases = [
    "It is metadata only",
    "does not create authority",
    "does not make a document canonical",
    "does not make a document deprecated",
    "does not override",
    "Human review is required"
  ];

  for (const phrase of requiredPhrases) {
    if (!markdown.includes(phrase)) {
      failures.push(`Classification markdown missing phrase: ${phrase}`);
    }
  }

  if (markdown.includes("## Deprecated Documents")) {
    failures.push("Classification markdown must not create a Deprecated Documents section.");
  }
}

if (failures.length > 0) {
  console.error("");
  console.error("Documentation authority classification check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error("");
  process.exit(1);
}

console.log("Documentation authority classification check passed.");
