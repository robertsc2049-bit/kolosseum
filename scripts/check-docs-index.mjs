
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const requiredFiles = [
  "docs/INDEX.md",
  "docs/dev/NEW_DEVELOPER_START_HERE.md",
  "docs/dev/REPO_MAP.md",
  "docs/dev/AUTHORITY_CHAIN.md",
  "docs/dev/DOC_SEARCH_GUIDE.md",
  "docs/dev/DOC_MAINTENANCE_RULES.md"
];

const requiredSectionsByFile = {
  "docs/INDEX.md": [
    "# Kolosseum Documentation Index",
    "## Start Here",
    "## Authority Model",
    "## Developer Navigation",
    "## Search First, Then Decide",
    "## Documentation Principle"
  ],
  "docs/dev/NEW_DEVELOPER_START_HERE.md": [
    "# New Developer Start Here",
    "## First Rule",
    "## Read In This Order",
    "## What Must Stay True",
    "## Safe Developer Behaviour",
    "## Unsafe Developer Behaviour",
    "## If Something Conflicts"
  ],
  "docs/dev/REPO_MAP.md": [
    "# Repository Map",
    "## Core Areas",
    "## Boundary Areas To Protect"
  ],
  "docs/dev/AUTHORITY_CHAIN.md": [
    "# Documentation Authority Chain",
    "## Core Rule",
    "## Authority Order",
    "## Conflict Handling",
    "## Developer Comments",
    "## Rule For Future Docs"
  ],
  "docs/dev/DOC_SEARCH_GUIDE.md": [
    "# Documentation Search Guide",
    "## Basic Search",
    "## Case-Insensitive Search",
    "## Search Headings",
    "## Search For Scope Boundaries",
    "## Search Discipline"
  ],
  "docs/dev/DOC_MAINTENANCE_RULES.md": [
    "# Documentation Maintenance Rules",
    "## Main Rule",
    "## Allowed Documentation Work",
    "## Dangerous Documentation Work",
    "## When Adding A New Doc",
    "## When Editing Existing Docs",
    "## Documentation CI"
  ]
};

const failures = [];

for (const file of requiredFiles) {
  const abs = path.join(repoRoot, file);

  if (!fs.existsSync(abs)) {
    failures.push(`Missing required docs navigation file: ${file}`);
    continue;
  }

  const text = fs.readFileSync(abs, "utf8");

  for (const section of requiredSectionsByFile[file] ?? []) {
    if (!text.includes(section)) {
      failures.push(`Missing required section in ${file}: ${section}`);
    }
  }

  if (!text.includes("does not") && !text.includes("do not") && !text.includes("Do not")) {
    failures.push(`Expected boundary language in ${file}; no do-not/does-not language found.`);
  }
}

const indexPath = path.join(repoRoot, "docs/INDEX.md");
const indexText = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";

for (const file of requiredFiles.filter((file) => file !== "docs/INDEX.md")) {
  if (!indexText.includes(file)) {
    failures.push(`docs/INDEX.md does not reference ${file}`);
  }
}

if (failures.length > 0) {
  console.error("");
  console.error("Docs index check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error("");
  process.exit(1);
}

console.log("Docs index check passed.");
console.log(`Checked ${requiredFiles.length} documentation navigation files.`);
