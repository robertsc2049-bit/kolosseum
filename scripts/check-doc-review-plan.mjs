import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const generatorPath = path.join(repoRoot, "scripts", "generate-doc-review-plan.mjs");
const jsonPath = path.join(repoRoot, "docs", "dev", "doc-review-plan.json");
const markdownPath = path.join(repoRoot, "docs", "dev", "DOC_REVIEW_PLAN.md");

const failures = [];

if (!fs.existsSync(generatorPath)) {
  failures.push("Missing review plan generator: scripts/generate-doc-review-plan.mjs");
}

if (failures.length === 0) {
  execFileSync(process.execPath, [generatorPath], {
    cwd: repoRoot,
    stdio: "inherit"
  });
}

if (!fs.existsSync(jsonPath)) {
  failures.push("Missing review plan JSON: docs/dev/doc-review-plan.json");
}

if (!fs.existsSync(markdownPath)) {
  failures.push("Missing review plan markdown: docs/dev/DOC_REVIEW_PLAN.md");
}

let plan = null;

if (fs.existsSync(jsonPath)) {
  try {
    plan = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch (error) {
    failures.push(`Review plan JSON is invalid: ${error.message}`);
  }
}

if (plan) {
  if (plan.schema_id !== "kolosseum_doc_review_plan") {
    failures.push("Unexpected review plan schema_id.");
  }

  if (plan.schema_version !== "1.0.0") {
    failures.push("Unexpected review plan schema_version.");
  }

  const boundary = plan.boundary ?? {};
  const requiredBoundaryFlags = [
    "review_plan_is_metadata_only",
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

  if (!Array.isArray(plan.selected_items)) {
    failures.push("selected_items must be an array.");
  } else {
    if (plan.selected_items.length === 0) {
      failures.push("Review plan selected no files.");
    }

    if (plan.selected_items.length > 10) {
      failures.push("Review plan selected too many files. Keep it tiny.");
    }

    for (const item of plan.selected_items) {
      if (!item.path) {
        failures.push("Selected item missing path.");
      }

      if (item.authority_effect !== "review-plan-only") {
        failures.push(`Selected item has invalid authority_effect: ${item.path}`);
      }

      if (!item.evidence_fields) {
        failures.push(`Selected item missing evidence fields: ${item.path}`);
      }

      if (!Array.isArray(item.manual_review_questions) || item.manual_review_questions.length === 0) {
        failures.push(`Selected item missing manual review questions: ${item.path}`);
      }

      if (!Array.isArray(item.disallowed_outcomes_in_this_slice) || !item.disallowed_outcomes_in_this_slice.includes("delete")) {
        failures.push(`Selected item missing delete prohibition: ${item.path}`);
      }
    }
  }
}

if (fs.existsSync(markdownPath)) {
  const markdown = fs.readFileSync(markdownPath, "utf8");

  const requiredSections = [
    "# Documentation Review Plan",
    "## Purpose",
    "## Non-Goals",
    "## Selection Policy",
    "## Selected Files",
    "## Manual Review Questions",
    "## Allowed Later Outcomes",
    "## Disallowed Outcomes In This Slice",
    "## Next Safe Move",
    "## Limits"
  ];

  for (const section of requiredSections) {
    if (!markdown.includes(section)) {
      failures.push(`Review plan markdown missing section: ${section}`);
    }
  }

  const requiredPhrases = [
    "small manual review plan only",
    "does not create authority",
    "It is not a cleanup slice",
    "Keyword hits are evidence prompts only",
    "This slice must not",
    "Human review is required"
  ];

  for (const phrase of requiredPhrases) {
    if (!markdown.includes(phrase)) {
      failures.push(`Review plan markdown missing phrase: ${phrase}`);
    }
  }

  if (markdown.includes("## Documents To Delete")) {
    failures.push("Review plan must not create a deletion section.");
  }

  if (markdown.includes("## Deprecated Documents")) {
    failures.push("Review plan must not create a deprecated-documents section.");
  }
}

if (failures.length > 0) {
  console.error("");
  console.error("Documentation review plan check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error("");
  process.exit(1);
}

console.log("Documentation review plan check passed.");