import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const classificationPath = path.join(repoRoot, "docs", "dev", "doc-authority-classification.json");
const jsonOutputPath = path.join(repoRoot, "docs", "dev", "doc-review-plan.json");
const markdownOutputPath = path.join(repoRoot, "docs", "dev", "DOC_REVIEW_PLAN.md");

const maxUnclassified = 5;
const maxReviewNeeded = 5;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readTextIfPresent(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return "";
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function extractFirstHeading(text) {
  const heading = text
    .split(/\n/u)
    .find((line) => /^#{1,6}\s+/.test(line));

  return heading ? heading.replace(/^#{1,6}\s+/, "").trim() : "";
}

function extractEvidenceTerms(entry) {
  const signals = Array.isArray(entry.review_signals) ? entry.review_signals : [];
  return signals.slice(0, 8);
}

function selectEntries(manifest) {
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];

  const unclassified = entries
    .filter((entry) => entry.primary_category === "unclassified")
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, maxUnclassified);

  const reviewNeeded = entries
    .filter((entry) => entry.review_status === "review-needed" && entry.primary_category !== "unclassified")
    .sort((a, b) => {
      const signalDelta = (b.review_signals?.length ?? 0) - (a.review_signals?.length ?? 0);
      return signalDelta !== 0 ? signalDelta : a.path.localeCompare(b.path);
    })
    .slice(0, maxReviewNeeded);

  return { unclassified, reviewNeeded };
}

function toReviewItem(entry, reason) {
  const sourceText = readTextIfPresent(entry.path);
  const heading = extractFirstHeading(sourceText);
  const evidenceTerms = extractEvidenceTerms(entry);

  return {
    path: entry.path,
    current_category: entry.primary_category,
    current_review_status: entry.review_status,
    authority_effect: "review-plan-only",
    reason_for_selection: reason,
    evidence_fields: {
      first_heading: heading || "No markdown heading found",
      review_signal_terms: evidenceTerms,
      signal_count: Array.isArray(entry.review_signals) ? entry.review_signals.length : 0,
      existing_notes: Array.isArray(entry.notes) ? entry.notes : []
    },
    manual_review_questions: [
      "What authority level does this file actually have?",
      "Is this file current, historical, or only supporting context?",
      "Does this file duplicate a stronger source?",
      "Does this file need a pointer to a stronger source?",
      "Is any later cleanup safe without changing product, engine, registry, proof, or release behaviour?"
    ],
    allowed_outcomes: [
      "keep unchanged",
      "add pointer in a later slice",
      "classify more precisely in a later slice",
      "propose historical label in a later slice",
      "propose consolidation in a later slice"
    ],
    disallowed_outcomes_in_this_slice: [
      "delete",
      "rewrite",
      "deprecate",
      "move",
      "change canonical wording",
      "change product scope",
      "change engine behaviour",
      "change registry behaviour",
      "change proof behaviour"
    ]
  };
}

function escapeMarkdownCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, "<br>");
}

function markdownTable(rows, headers) {
  const header = `| ${headers.map(escapeMarkdownCell).join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => {
    return `| ${headers.map((headerName) => escapeMarkdownCell(row[headerName])).join(" | ")} |`;
  });

  return [header, divider, ...body].join("\n");
}

if (!fs.existsSync(classificationPath)) {
  console.error("Missing classification manifest: docs/dev/doc-authority-classification.json");
  process.exit(1);
}

const classification = readJson(classificationPath);
const { unclassified, reviewNeeded } = selectEntries(classification);

const selectedItems = [
  ...unclassified.map((entry) => toReviewItem(entry, "Unclassified file needs manual category review.")),
  ...reviewNeeded.map((entry) => toReviewItem(entry, "High-signal review-needed file selected for bounded manual review."))
];

const plan = {
  schema_id: "kolosseum_doc_review_plan",
  schema_version: "1.0.0",
  generated: "deterministic-local-review-plan",
  purpose: "Select a small number of review-needed and unclassified documentation files for manual review without changing source documents.",
  boundary: {
    review_plan_is_metadata_only: true,
    does_not_create_authority: true,
    does_not_deprecate_documents: true,
    does_not_delete_documents: true,
    does_not_rewrite_documents: true,
    does_not_move_documents: true,
    does_not_change_product_scope: true,
    does_not_change_engine_behaviour: true,
    does_not_change_registry_behaviour: true,
    does_not_change_proof_behaviour: true,
    does_not_introduce_ai_or_rag_dependency: true
  },
  selection_policy: {
    max_unclassified: maxUnclassified,
    max_review_needed: maxReviewNeeded,
    unclassified_order: "path ascending",
    review_needed_order: "review signal count descending, then path ascending",
    keyword_hits_are_not_proof: true
  },
  counts: {
    selected_total: selectedItems.length,
    selected_unclassified: unclassified.length,
    selected_review_needed: reviewNeeded.length
  },
  selected_items: selectedItems
};

fs.writeFileSync(jsonOutputPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");

const rows = selectedItems.map((item) => ({
  File: item.path,
  Category: item.current_category,
  Status: item.current_review_status,
  Reason: item.reason_for_selection,
  "First heading": item.evidence_fields.first_heading,
  "Signal count": item.evidence_fields.signal_count,
  "Evidence terms": item.evidence_fields.review_signal_terms.join(", ") || "none"
}));

const markdown = `# Documentation Review Plan

Generated: deterministic-local-review-plan

This document is generated by \`scripts/generate-doc-review-plan.mjs\`.

It is a small manual review plan only. It does not create authority, deprecate documents, delete documents, rewrite documents, move documents, or change product behaviour.

## Purpose

Select a small number of \`review-needed\` and \`unclassified\` documentation files for human review.

This is the step after audit and classification.

It is not a cleanup slice.

## Non-Goals

This review plan does not:

- rewrite source documents
- delete source documents
- deprecate source documents
- move source documents
- change product scope
- change engine behaviour
- change registry behaviour
- change proof behaviour
- decide which document wins
- treat keyword hits as proof of conflict
- introduce AI or RAG dependency

## Selection Policy

- Select up to ${maxUnclassified} unclassified files.
- Select up to ${maxReviewNeeded} review-needed files.
- Prefer unclassified files first because they lack a deterministic category.
- For review-needed files, sort by signal count descending, then path.
- Keyword hits are evidence prompts only. They are not proof of conflict, staleness, or error.

## Selected Files

${markdownTable(rows, ["File", "Category", "Status", "Reason", "First heading", "Signal count", "Evidence terms"])}

## Manual Review Questions

For each selected file, answer:

1. What authority level does this file actually have?
2. Is this file current, historical, or supporting context?
3. Does this file duplicate a stronger source?
4. Does this file need a pointer to a stronger source?
5. Is any later cleanup safe without changing product, engine, registry, proof, or release behaviour?

## Allowed Later Outcomes

A later slice may propose:

- keep unchanged
- add pointer to a stronger source
- classify more precisely
- mark as historical only with explicit evidence
- propose consolidation only with explicit evidence

## Disallowed Outcomes In This Slice

This slice must not:

- delete files
- rewrite source docs
- deprecate files
- move files
- change canonical wording
- change product scope
- change engine behaviour
- change registry behaviour
- change proof behaviour

## Next Safe Move

Manually review only the selected files.

Then produce a proposed cleanup plan with explicit evidence.

Do not perform cleanup until the plan identifies a safe, narrow cleanup slice.

## Limits

This review plan is generated from the classification manifest and light source-file evidence.

It cannot prove that a file is stale, wrong, contradictory, or safe to delete.

Human review is required before any document is rewritten, deprecated, moved, consolidated, or deleted.
`;

fs.writeFileSync(markdownOutputPath, markdown, "utf8");

console.log(JSON.stringify({
  ok: true,
  generated: [
    path.relative(repoRoot, jsonOutputPath).split(path.sep).join("/"),
    path.relative(repoRoot, markdownOutputPath).split(path.sep).join("/")
  ],
  selected_total: selectedItems.length,
  selected_unclassified: unclassified.length,
  selected_review_needed: reviewNeeded.length
}, null, 2));