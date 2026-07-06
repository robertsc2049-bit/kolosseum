
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const reviewPlanPath = path.join(repoRoot, "docs", "dev", "doc-review-plan.json");
const jsonOutputPath = path.join(repoRoot, "docs", "dev", "doc-manual-review-record.json");
const markdownOutputPath = path.join(repoRoot, "docs", "dev", "DOC_MANUAL_REVIEW_RECORD.md");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readSource(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return "";
  }

  return fs.readFileSync(absolutePath, "utf8");
}

function extractHeadings(text) {
  return text
    .split(/\n/u)
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter((entry) => /^#{1,6}\s+/.test(entry.line))
    .slice(0, 12)
    .map((entry) => ({
      line: entry.number,
      heading: entry.line
    }));
}

function extractEvidenceLines(text, terms) {
  const lowerTerms = terms.map((term) => String(term).toLowerCase()).filter(Boolean);
  const lines = text.split(/\n/u);

  const matches = [];

  for (const [index, line] of lines.entries()) {
    const lowerLine = line.toLowerCase();

    if (lowerTerms.some((term) => lowerLine.includes(term))) {
      matches.push({
        line: index + 1,
        text: line.trim().slice(0, 220)
      });
    }

    if (matches.length >= 10) {
      break;
    }
  }

  return matches;
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

if (!fs.existsSync(reviewPlanPath)) {
  console.error("Missing review plan: docs/dev/doc-review-plan.json");
  process.exit(1);
}

const reviewPlan = readJson(reviewPlanPath);
const selectedItems = Array.isArray(reviewPlan.selected_items) ? reviewPlan.selected_items : [];

const records = selectedItems.map((item) => {
  const source = readSource(item.path);
  const evidenceTerms = item.evidence_fields?.review_signal_terms ?? [];
  const headings = extractHeadings(source);
  const evidenceLines = extractEvidenceLines(source, evidenceTerms);

  return {
    path: item.path,
    current_category: item.current_category,
    current_review_status: item.current_review_status,
    authority_effect: "manual-review-record-only",
    source_file_changed: false,
    manual_review_status: "pending",
    evidence: {
      first_heading: item.evidence_fields?.first_heading ?? "",
      heading_outline: headings,
      review_signal_terms: evidenceTerms,
      review_signal_count: item.evidence_fields?.signal_count ?? 0,
      evidence_lines: evidenceLines,
      selected_reason: item.reason_for_selection
    },
    required_manual_answers: {
      actual_authority_level: "pending_manual_review",
      current_or_historical: "pending_manual_review",
      duplicate_of_stronger_source: "pending_manual_review",
      stronger_source_pointer_needed: "pending_manual_review",
      safe_later_cleanup_action: "pending_manual_review",
      evidence_notes: "pending_manual_review"
    },
    allowed_later_actions: [
      "keep unchanged",
      "add pointer to stronger source in a later slice",
      "classify more precisely in a later slice",
      "mark historical only with explicit evidence in a later slice",
      "propose consolidation only with explicit evidence in a later slice"
    ],
    disallowed_actions_in_this_slice: [
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
});

const record = {
  schema_id: "kolosseum_doc_manual_review_record",
  schema_version: "1.0.0",
  generated: "deterministic-local-manual-review-record",
  purpose: "Create a bounded manual-review record for selected documentation files without changing source documents.",
  boundary: {
    manual_review_record_only: true,
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
  counts: {
    selected_total: records.length,
    pending_manual_review: records.filter((item) => item.manual_review_status === "pending").length
  },
  records
};

fs.writeFileSync(jsonOutputPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");

const rows = records.map((item) => ({
  File: item.path,
  Category: item.current_category,
  Status: item.current_review_status,
  "Manual status": item.manual_review_status,
  "First heading": item.evidence.first_heading,
  "Evidence lines": item.evidence.evidence_lines.map((line) => `${line.line}: ${line.text}`).join("<br>") || "none"
}));

const markdown = `<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# Documentation Manual Review Record

Generated: deterministic-local-manual-review-record

This document is generated by \`scripts/generate-doc-manual-review-record.mjs\`.

It is a manual-review record only. It does not create authority, deprecate documents, delete documents, rewrite documents, move documents, or change product behaviour.

## Purpose

Create a bounded manual-review record for the selected 10 documentation files from \`docs/dev/DOC_REVIEW_PLAN.md\`.

This is not a cleanup slice.

This is not a source-document edit slice.

## Non-Goals

This record does not:

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

## Selected Files

${markdownTable(rows, ["File", "Category", "Status", "Manual status", "First heading", "Evidence lines"])}

## Manual Review Questions To Answer Later

For each selected file, answer:

1. What authority level does this file actually have?
2. Is this file current, historical, or supporting context?
3. Does this file duplicate a stronger source?
4. Does this file need a pointer to a stronger source?
5. Is any later cleanup safe without changing product, engine, registry, proof, or release behaviour?
6. What exact evidence supports that answer?

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

Manually fill the pending review answers in a later evidence-record slice.

Do not perform cleanup until each file has explicit evidence and a narrow proposed action.

## Limits

This record extracts headings and evidence lines from source files for review support.

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
  selected_total: records.length,
  pending_manual_review: record.counts.pending_manual_review
}, null, 2));
