
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docsRoot = path.join(repoRoot, "docs");

const jsonOutputPath = path.join(repoRoot, "docs", "dev", "doc-authority-classification.json");
const markdownOutputPath = path.join(repoRoot, "docs", "dev", "DOC_AUTHORITY_CLASSIFICATION.md");

const excludedDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage"
]);

const generatedOutputs = new Set([
  normalisePath(jsonOutputPath),
  normalisePath(markdownOutputPath),
  normalisePath(path.join(repoRoot, "docs", "dev", "DOC_AUTHORITY_AUDIT.md")),
  normalisePath(path.join(repoRoot, "docs", "dev", "DOC_REVIEW_PLAN.md"))
]);

const categories = [
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

const reviewSignals = [
  "review-needed",
  "review needed",
  "stale",
  "deprecated",
  "superseded",
  "historical",
  "legacy",
  "old",
  "draft",
  "proposal",
  "future",
  "later",
  "post-v1",
  "v1.1",
  "recommend",
  "recommendation",
  "optimal",
  "safe",
  "safer",
  "risk",
  "injury",
  "fatigue",
  "readiness",
  "fallback",
  "temporary",
  "automatic",
  "inference",
  "infer",
  "ai",
  "rag"
];

function normalisePath(filePath) {
  return path.resolve(filePath).split(path.sep).join("/");
}

function relativePath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function walk(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (excludedDirectories.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files.sort((a, b) => relativePath(a).localeCompare(relativePath(b)));
}

function includesAny(haystack, needles) {
  return needles.some((needle) => haystack.includes(needle));
}

function signalHits(text, signals) {
  const lower = text.toLowerCase();
  return signals.filter((signal) => lower.includes(signal));
}

function classify(filePath, text) {
  const rel = relativePath(filePath);
  const probe = `${rel}\n${text}`.toLowerCase();

  if (
    rel === "docs/INDEX.md" ||
    rel.startsWith("docs/dev/") ||
    includesAny(probe, [
      "new developer",
      "repo map",
      "documentation search guide",
      "documentation maintenance rules",
      "documentation authority chain",
      "documentation authority audit",
      "documentation authority classification"
    ])
  ) {
    return "developer-navigation";
  }

  if (
    includesAny(probe, [
      "release boundary",
      "active release boundary",
      "ship boundary",
      "completion gate",
      "v0 completion gate",
      "v1 entry criteria",
      "authoritative ship boundary"
    ])
  ) {
    return "release-boundary";
  }

  if (
    includesAny(probe, [
      "engine contract",
      "deterministic engine",
      "canonical json",
      "canonical",
      "engine output",
      "engine input",
      "no-coupling",
      "compile",
      "runtime reducer"
    ])
  ) {
    return "engine-contract";
  }

  if (
    includesAny(probe, [
      "registry",
      "exercise registry",
      "equipment registry",
      "registry law",
      "registry bundle",
      "supported activities",
      "foreign key",
      "fk",
      "closure"
    ])
  ) {
    return "registry-contract";
  }

  if (
    includesAny(probe, [
      "proof",
      "replay",
      "evidence",
      "evidence seal",
      "hash",
      "sha256",
      "golden manifest",
      "golden output",
      "audit log"
    ])
  ) {
    return "proof-and-replay";
  }

  if (
    includesAny(probe, [
      "slice",
      "slice contract",
      "invariant",
      "proof command",
      "non-goal",
      "non-goals",
      "target:",
      "purpose:"
    ])
  ) {
    return "slice-contract";
  }

  if (
    includesAny(probe, [
      "copy",
      "claim",
      "claims",
      "sales",
      "commercial",
      "marketing",
      "language boundary",
      "forbidden language",
      "banned language"
    ])
  ) {
    return "commercial-or-copy-boundary";
  }

  if (
    includesAny(probe, [
      "historical",
      "roadmap",
      "future",
      "later",
      "post-v1",
      "v1.1",
      "proposal",
      "archive",
      "archived"
    ])
  ) {
    return "historical-or-roadmap";
  }

  return "unclassified";
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

const docs = walk(docsRoot)
  .filter((filePath) => !generatedOutputs.has(normalisePath(filePath)));

const entries = docs.map((filePath) => {
  const text = fs.readFileSync(filePath, "utf8");
  const rel = relativePath(filePath);
  const primaryCategory = classify(filePath, text);
  const hits = signalHits(`${rel}\n${text}`, reviewSignals);

  const reviewStatus = hits.length > 0 ? "review-needed" : "classified";
  const notes = [];

  if (reviewStatus === "review-needed") {
    notes.push("Keyword review signal only. This does not prove conflict, staleness, deprecation, or error.");
  }

  if (primaryCategory === "unclassified") {
    notes.push("No deterministic category matched. Human review may classify later.");
  }

  return {
    path: rel,
    primary_category: primaryCategory,
    review_status: reviewStatus,
    review_signals: hits,
    authority_effect: "metadata-only",
    notes
  };
}).sort((a, b) => a.path.localeCompare(b.path));

const categoryCounts = Object.fromEntries(categories.map((category) => [category, 0]));
const reviewStatusCounts = {
  classified: 0,
  "review-needed": 0
};

for (const entry of entries) {
  categoryCounts[entry.primary_category] = (categoryCounts[entry.primary_category] ?? 0) + 1;
  reviewStatusCounts[entry.review_status] = (reviewStatusCounts[entry.review_status] ?? 0) + 1;
}

const manifest = {
  schema_id: "kolosseum_doc_authority_classification",
  schema_version: "1.0.0",
  generated: "deterministic-local-classification",
  purpose: "Classify Kolosseum documentation files for navigation and later human review without rewriting, deleting, deprecating, or changing authority.",
  boundary: {
    classification_is_metadata_only: true,
    does_not_create_authority: true,
    does_not_deprecate_documents: true,
    does_not_delete_documents: true,
    does_not_rewrite_documents: true,
    does_not_change_product_scope: true,
    does_not_change_engine_behaviour: true,
    does_not_change_registry_behaviour: true,
    does_not_change_proof_behaviour: true,
    does_not_introduce_ai_or_rag_dependency: true
  },
  categories,
  review_statuses: [
    "classified",
    "review-needed"
  ],
  counts: {
    total_docs_classified: entries.length,
    by_category: categoryCounts,
    by_review_status: reviewStatusCounts
  },
  entries
};

fs.writeFileSync(jsonOutputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const summaryRows = categories.map((category) => ({
  Category: category,
  Count: categoryCounts[category] ?? 0
}));

const reviewRows = Object.entries(reviewStatusCounts).map(([status, count]) => ({
  Status: status,
  Count: count
}));

const entryRows = entries.map((entry) => ({
  File: entry.path,
  Category: entry.primary_category,
  "Review status": entry.review_status,
  "Signal count": entry.review_signals.length,
  Notes: entry.notes.join(" ")
}));

const markdown = `# Documentation Authority Classification

Generated: deterministic-local-classification

This document is generated by \`scripts/classify-doc-authority.mjs\`.

It is metadata only. It does not create authority, deprecate documents, delete documents, rewrite documents, or change product behaviour.

## Purpose

Classify Kolosseum documentation files so future cleanup work can be planned safely.

The classification helps identify which files appear to be release-boundary, engine-contract, registry-contract, proof-and-replay, slice-contract, developer-navigation, commercial-or-copy-boundary, historical-or-roadmap, review-needed, or unclassified material.

## Non-Goals

This classification does not:

- rewrite documents
- delete documents
- deprecate documents
- change product scope
- change engine behaviour
- change registry behaviour
- change proof behaviour
- decide which document wins
- treat audit keyword hits as proof of conflict
- introduce AI or RAG dependency

## Classification Rule

Classification is metadata.

It does not make a document canonical.

It does not make a document deprecated.

It does not override \`docs/dev/AUTHORITY_CHAIN.md\`.

It does not override active release boundaries, contracts, tests, registry rules, proof rules, or slice contracts.

## Summary

- Total docs classified: ${entries.length}
- Review-needed docs: ${reviewStatusCounts["review-needed"]}
- Classified docs: ${reviewStatusCounts.classified}

## Category Counts

${markdownTable(summaryRows, ["Category", "Count"])}

## Review Status Counts

${markdownTable(reviewRows, ["Status", "Count"])}

## Classification Entries

${markdownTable(entryRows, ["File", "Category", "Review status", "Signal count", "Notes"])}

## Next Safe Move

The next safe move after this slice is not deletion or rewriting.

The next safe move is to review a small subset of \`review-needed\` files and produce a proposed cleanup plan with explicit authority evidence.

## Limits

This classification uses deterministic path and keyword rules. It can support navigation and review planning, but it cannot prove that a document is stale, wrong, contradictory, or safe to delete.

Human review is required before any document is rewritten, deprecated, moved, or deleted.
`;

fs.writeFileSync(markdownOutputPath, markdown, "utf8");

console.log(JSON.stringify({
  ok: true,
  generated: [
    relativePath(jsonOutputPath),
    relativePath(markdownOutputPath)
  ],
  total_docs_classified: entries.length,
  by_category: categoryCounts,
  by_review_status: reviewStatusCounts
}, null, 2));
