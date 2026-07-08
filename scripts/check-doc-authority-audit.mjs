
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const auditScript = path.join(repoRoot, "scripts", "audit-doc-authority.mjs");
const reportPath = path.join(repoRoot, "docs", "dev", "DOC_AUTHORITY_AUDIT.md");

if (!fs.existsSync(auditScript)) {
  console.error("Missing audit script: scripts/audit-doc-authority.mjs");
  process.exit(1);
}

execFileSync(process.execPath, [auditScript], {
  cwd: repoRoot,
  stdio: "inherit"
});

if (!fs.existsSync(reportPath)) {
  console.error("Missing generated report: docs/dev/DOC_AUTHORITY_AUDIT.md");
  process.exit(1);
}

const report = fs.readFileSync(reportPath, "utf8");

const requiredSections = [
  "# Documentation Authority Audit",
  "## Purpose",
  "## Non-Goals",
  "## Summary",
  "## Files With Authority Language",
  "## Files With Historical, Stale, Claim, Or Behaviour-Risk Terms",
  "## Files With Review Flags",
  "## Duplicate Heading Labels",
  "## Unclassified Authority-Language Files",
  "## Recommended Next Slice",
  "## Audit Limits"
];

const failures = [];

for (const section of requiredSections) {
  if (!report.includes(section)) {
    failures.push(`Missing report section: ${section}`);
  }
}

const requiredBoundaryPhrases = [
  "audit report only",
  "does not rewrite",
  "does not change product scope",
  "does not change engine behaviour",
  "does not change registry behaviour",
  "does not change proof behaviour",
  "Human review is required"
];

for (const phrase of requiredBoundaryPhrases) {
  if (!report.includes(phrase)) {
    failures.push(`Missing report boundary phrase: ${phrase}`);
  }
}

if (report.includes("## Deprecated Documents")) {
  failures.push("Report must not create a deprecated-documents section.");
}

if (report.includes("This document is authoritative")) {
  failures.push("Audit report must not claim authority for itself.");
}

if (failures.length > 0) {
  console.error("");
  console.error("Documentation authority audit check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error("");
  process.exit(1);
}

console.log("Documentation authority audit check passed.");
