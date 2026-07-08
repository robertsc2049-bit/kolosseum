
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const generatorPath = path.join(repoRoot, "scripts", "generate-doc-manual-review-record.mjs");
const jsonPath = path.join(repoRoot, "docs", "dev", "doc-manual-review-record.json");
const markdownPath = path.join(repoRoot, "docs", "dev", "DOC_MANUAL_REVIEW_RECORD.md");

const failures = [];

if (!fs.existsSync(generatorPath)) {
  failures.push("Missing manual review record generator: scripts/generate-doc-manual-review-record.mjs");
}

if (failures.length === 0) {
  execFileSync(process.execPath, [generatorPath], {
    cwd: repoRoot,
    stdio: "inherit"
  });
}

if (!fs.existsSync(jsonPath)) {
  failures.push("Missing manual review record JSON: docs/dev/doc-manual-review-record.json");
}

if (!fs.existsSync(markdownPath)) {
  failures.push("Missing manual review record markdown: docs/dev/DOC_MANUAL_REVIEW_RECORD.md");
}

let record = null;

if (fs.existsSync(jsonPath)) {
  try {
    record = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch (error) {
    failures.push(`Manual review record JSON is invalid: ${error.message}`);
  }
}

if (record) {
  if (record.schema_id !== "kolosseum_doc_manual_review_record") {
    failures.push("Unexpected manual review record schema_id.");
  }

  if (record.schema_version !== "1.0.0") {
    failures.push("Unexpected manual review record schema_version.");
  }

  const boundary = record.boundary ?? {};
  const requiredBoundaryFlags = [
    "manual_review_record_only",
    "does_not_create_authority",
    "does_not_deprecate_documents",
    "does_not_delete_documents",
    "does_not_rewrite_documents",
    "does_not_move_documents",
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

  if (!Array.isArray(record.records)) {
    failures.push("records must be an array.");
  } else {
    if (record.records.length !== 10) {
      failures.push(`Manual review record should contain exactly 10 records, found ${record.records.length}.`);
    }

    for (const item of record.records) {
      if (!item.path) {
        failures.push("Record missing path.");
      }

      if (item.authority_effect !== "manual-review-record-only") {
        failures.push(`Invalid authority_effect for ${item.path}`);
      }

      if (item.source_file_changed !== false) {
        failures.push(`source_file_changed must be false for ${item.path}`);
      }

      if (item.manual_review_status !== "pending") {
        failures.push(`manual_review_status must remain pending for ${item.path}`);
      }

      if (!item.required_manual_answers) {
        failures.push(`Missing required_manual_answers for ${item.path}`);
      }

      if (!Array.isArray(item.disallowed_actions_in_this_slice) || !item.disallowed_actions_in_this_slice.includes("delete")) {
        failures.push(`Missing delete prohibition for ${item.path}`);
      }
    }
  }
}

if (fs.existsSync(markdownPath)) {
  const markdown = fs.readFileSync(markdownPath, "utf8");

  const requiredSections = [
    "# Documentation Manual Review Record",
    "## Purpose",
    "## Non-Goals",
    "## Selected Files",
    "## Manual Review Questions To Answer Later",
    "## Allowed Later Outcomes",
    "## Disallowed Outcomes In This Slice",
    "## Next Safe Move",
    "## Limits"
  ];

  for (const section of requiredSections) {
    if (!markdown.includes(section)) {
      failures.push(`Manual review record markdown missing section: ${section}`);
    }
  }

  const requiredPhrases = [
    "manual-review record only",
    "does not create authority",
    "This is not a cleanup slice",
    "This is not a source-document edit slice",
    "This slice must not",
    "Human review is required"
  ];

  for (const phrase of requiredPhrases) {
    if (!markdown.includes(phrase)) {
      failures.push(`Manual review record markdown missing phrase: ${phrase}`);
    }
  }

  if (markdown.includes("## Documents To Delete")) {
    failures.push("Manual review record must not create a deletion section.");
  }

  if (markdown.includes("## Deprecated Documents")) {
    failures.push("Manual review record must not create a deprecated-documents section.");
  }
}

if (failures.length > 0) {
  console.error("");
  console.error("Documentation manual review record check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error("");
  process.exit(1);
}

console.log("Documentation manual review record check passed.");
