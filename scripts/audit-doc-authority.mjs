import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const docsRoot = path.join(repoRoot, "docs");
const outputPath = path.join(repoRoot, "docs", "dev", "DOC_AUTHORITY_AUDIT.md");

const excludedDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage"
]);

const authorityKeywords = [
  "authoritative",
  "authority",
  "canonical",
  "source of truth",
  "release boundary",
  "active boundary",
  "contract",
  "invariant",
  "must",
  "must not",
  "do not",
  "shall",
  "proof",
  "replay",
  "deterministic",
  "registry",
  "engine",
  "scope",
  "non-goal",
  "non-goals",
  "excluded",
  "post-v1",
  "not-v1"
];

const staleOrHistoricalKeywords = [
  "historical",
  "deprecated",
  "superseded",
  "old",
  "legacy",
  "archive",
  "archived",
  "previous",
  "draft",
  "proposal",
  "future",
  "later",
  "v1.1",
  "post-v1"
];

const conflictRiskKeywords = [
  "recommend",
  "recommended",
  "recommendation",
  "optimal",
  "safe",
  "safer",
  "safety",
  "risk",
  "injury",
  "injury risk",
  "fatigue",
  "readiness",
  "effective",
  "programme worked",
  "programme failed",
  "fallback",
  "temporary",
  "automatic",
  "auto-progress",
  "infer",
  "inference",
  "ai",
  "rag"
];

const authorityLevelHints = [
  { level: "release-boundary", patterns: ["release boundary", "active release", "ship boundary", "completion gate"] },
  { level: "engine-contract", patterns: ["engine contract", "deterministic", "canonical", "replay", "proof"] },
  { level: "registry-contract", patterns: ["registry", "supported activities", "exercise registry", "equipment registry"] },
  { level: "slice-contract", patterns: ["slice", "invariant", "proof", "non-goals"] },
  { level: "developer-navigation", patterns: ["new developer", "repo map", "search guide", "maintenance rules", "authority chain"] },
  { level: "historical-or-roadmap", patterns: ["historical", "roadmap", "future", "later", "post-v1", "v1.1"] }
];

function walk(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

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

  return files.sort((a, b) => a.localeCompare(b));
}

function normaliseRelative(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function countMatches(text, terms) {
  const lower = text.toLowerCase();
  const hits = [];

  for (const term of terms) {
    const needle = term.toLowerCase();
    let index = lower.indexOf(needle);
    let count = 0;

    while (index !== -1) {
      count += 1;
      index = lower.indexOf(needle, index + needle.length);
    }

    if (count > 0) {
      hits.push({ term, count });
    }
  }

  return hits;
}

function extractHeadings(text) {
  return text
    .split(/\n/u)
    .map((line, index) => ({ line, index: index + 1 }))
    .filter(({ line }) => /^#{1,6}\s+/.test(line))
    .map(({ line, index }) => ({
      line: index,
      heading: line.trim(),
      title: line.replace(/^#{1,6}\s+/, "").trim().toLowerCase()
    }));
}

function inferAuthorityLevel(text, relativePath) {
  const lower = `${relativePath}\n${text}`.toLowerCase();

  const matched = [];

  for (const hint of authorityLevelHints) {
    const count = hint.patterns.reduce((sum, pattern) => {
      return lower.includes(pattern.toLowerCase()) ? sum + 1 : sum;
    }, 0);

    if (count > 0) {
      matched.push({ level: hint.level, count });
    }
  }

  matched.sort((a, b) => b.count - a.count || a.level.localeCompare(b.level));

  return matched.length > 0 ? matched[0].level : "unclassified";
}

function hasExplicitAuthorityStatement(text) {
  return /does not create product law|does not replace|authoritative|source of truth|authority order|authority chain|canonical/i.test(text);
}

function hasDoNotBoundary(text) {
  return /do not|must not|does not|non-goal|non-goals|excluded|not-v1|post-v1/i.test(text);
}

function markdownTable(rows, headers) {
  const escapeCell = (value) => String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, "<br>");

  const header = `| ${headers.map(escapeCell).join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${headers.map((headerName) => escapeCell(row[headerName])).join(" | ")} |`);

  return [header, divider, ...body].join("\n");
}

const generatedDocOutputs = new Set([
  path.resolve(outputPath),
  path.resolve(path.join(repoRoot, "docs", "dev", "DOC_AUTHORITY_CLASSIFICATION.md"))
]);

const markdownFiles = walk(docsRoot).filter((filePath) => {
  return !generatedDocOutputs.has(path.resolve(filePath));
});

const fileAnalyses = markdownFiles.map((filePath) => {
  const relativePath = normaliseRelative(filePath);
  const text = fs.readFileSync(filePath, "utf8");
  const headings = extractHeadings(text);
  const authorityHits = countMatches(text, authorityKeywords);
  const staleHits = countMatches(text, staleOrHistoricalKeywords);
  const riskHits = countMatches(text, conflictRiskKeywords);
  const authorityLevel = inferAuthorityLevel(text, relativePath);

  const flags = [];

  if (authorityHits.length > 0 && !hasExplicitAuthorityStatement(text)) {
    flags.push("authority language without explicit authority statement");
  }

  if (authorityHits.length > 0 && !hasDoNotBoundary(text)) {
    flags.push("authority language without clear boundary wording");
  }

  if (staleHits.length > 0 && authorityHits.length > 0) {
    flags.push("possible historical/current authority overlap");
  }

  if (riskHits.length > 0) {
    flags.push("claim or behaviour-risk terms present");
  }

  if (headings.length === 0) {
    flags.push("no markdown headings found");
  }

  return {
    relativePath,
    text,
    headings,
    authorityHits,
    staleHits,
    riskHits,
    authorityLevel,
    flags
  };
});

const headingMap = new Map();

for (const analysis of fileAnalyses) {
  for (const heading of analysis.headings) {
    if (!headingMap.has(heading.title)) {
      headingMap.set(heading.title, []);
    }

    headingMap.get(heading.title).push({
      file: analysis.relativePath,
      line: heading.line,
      heading: heading.heading
    });
  }
}

const duplicateHeadings = [...headingMap.entries()]
  .filter(([, locations]) => locations.length > 1)
  .map(([title, locations]) => ({ title, locations }))
  .sort((a, b) => b.locations.length - a.locations.length || a.title.localeCompare(b.title));

const authorityLanguageFiles = fileAnalyses
  .filter((analysis) => analysis.authorityHits.length > 0)
  .map((analysis) => ({
    File: analysis.relativePath,
    "Inferred level": analysis.authorityLevel,
    "Authority hits": analysis.authorityHits.map((hit) => `${hit.term} (${hit.count})`).join(", "),
    "Flags": analysis.flags.join("; ") || "none"
  }));

const staleRiskFiles = fileAnalyses
  .filter((analysis) => analysis.staleHits.length > 0 || analysis.riskHits.length > 0)
  .map((analysis) => ({
    File: analysis.relativePath,
    "Historical/stale hits": analysis.staleHits.map((hit) => `${hit.term} (${hit.count})`).join(", ") || "none",
    "Risk hits": analysis.riskHits.map((hit) => `${hit.term} (${hit.count})`).join(", ") || "none",
    "Flags": analysis.flags.join("; ") || "none"
  }));

const unclassifiedAuthorityFiles = fileAnalyses
  .filter((analysis) => analysis.authorityHits.length > 0 && analysis.authorityLevel === "unclassified")
  .map((analysis) => ({
    File: analysis.relativePath,
    "Authority hits": analysis.authorityHits.map((hit) => `${hit.term} (${hit.count})`).join(", "),
    "Flags": analysis.flags.join("; ") || "none"
  }));

const duplicateHeadingRows = duplicateHeadings.slice(0, 50).map((entry) => ({
  Heading: entry.title,
  Count: entry.locations.length,
  Locations: entry.locations.map((location) => `${location.file}:${location.line}`).join("<br>")
}));

const flagRows = fileAnalyses
  .filter((analysis) => analysis.flags.length > 0)
  .map((analysis) => ({
    File: analysis.relativePath,
    "Inferred level": analysis.authorityLevel,
    Flags: analysis.flags.join("; ")
  }));

const generatedAt = "deterministic-local-audit";

const report = `# Documentation Authority Audit

Generated: ${generatedAt}

This report is generated by \`scripts/audit-doc-authority.mjs\`.

It is an audit report only. It does not rewrite, delete, deprecate, reclassify, or override any existing Kolosseum document.

## Purpose

Identify documentation areas that may need later human review for:

- duplicate authority language
- stale or historical wording
- possible current/historical conflict
- claim-language or behaviour-risk terms
- repeated headings that may make search/navigation harder
- files with authority language but no explicit authority statement

## Non-Goals

This report does not:

- does not change product scope
- does not change engine behaviour
- does not change registry behaviour
- does not change proof behaviour
- mark documents as deprecated
- delete historical material
- rewrite canonical rules
- decide which document wins
- introduce AI or RAG dependency

## Summary

- Markdown docs scanned: ${fileAnalyses.length}
- Files containing authority language: ${authorityLanguageFiles.length}
- Files containing stale/historical or risk terms: ${staleRiskFiles.length}
- Files with review flags: ${flagRows.length}
- Duplicate heading labels found: ${duplicateHeadings.length}
- Unclassified files with authority language: ${unclassifiedAuthorityFiles.length}

## Files With Authority Language

${authorityLanguageFiles.length > 0 ? markdownTable(authorityLanguageFiles, ["File", "Inferred level", "Authority hits", "Flags"]) : "No files with authority language found."}

## Files With Historical, Stale, Claim, Or Behaviour-Risk Terms

These are review candidates only. Some files intentionally document banned language or future exclusions.

${staleRiskFiles.length > 0 ? markdownTable(staleRiskFiles, ["File", "Historical/stale hits", "Risk hits", "Flags"]) : "No stale, historical, claim, or behaviour-risk terms found."}

## Files With Review Flags

${flagRows.length > 0 ? markdownTable(flagRows, ["File", "Inferred level", "Flags"]) : "No review flags found."}

## Duplicate Heading Labels

Repeated headings are not automatically wrong. They can make search less precise when many docs use the same heading text.

Top 50 duplicate heading labels:

${duplicateHeadingRows.length > 0 ? markdownTable(duplicateHeadingRows, ["Heading", "Count", "Locations"]) : "No duplicate heading labels found."}

## Unclassified Authority-Language Files

These files contain authority-like language but did not match the current inferred authority buckets.

${unclassifiedAuthorityFiles.length > 0 ? markdownTable(unclassifiedAuthorityFiles, ["File", "Authority hits", "Flags"]) : "No unclassified authority-language files found."}

## Recommended Next Slice

Recommended next slice:

\`S-DEV-DOC-AUTHORITY-CLASSIFICATION\`

Purpose:

Create a small, explicit documentation classification manifest that lists current known authority classes and review status. It should still avoid rewriting or deleting existing docs.

Suggested non-goals:

- no canonical rule rewrites
- no document deletion
- no scope changes
- no behaviour changes
- no hidden deprecation
- no AI/RAG dependency

## Audit Limits

This script uses deterministic keyword and heading scanning. It can find review candidates, but it cannot prove that a document is stale, wrong, or contradictory.

Human review is required before any document is reclassified, rewritten, or deprecated.
`;

fs.writeFileSync(outputPath, report, "utf8");

const summary = {
  ok: true,
  generated: normaliseRelative(outputPath),
  markdown_docs_scanned: fileAnalyses.length,
  files_with_authority_language: authorityLanguageFiles.length,
  files_with_stale_or_risk_terms: staleRiskFiles.length,
  files_with_review_flags: flagRows.length,
  duplicate_heading_labels: duplicateHeadings.length,
  unclassified_authority_language_files: unclassifiedAuthorityFiles.length
};

console.log(JSON.stringify(summary, null, 2));