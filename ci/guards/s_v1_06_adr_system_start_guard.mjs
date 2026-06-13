// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-06 ADR system start guard.
 * Purpose: proves the ADR system has a README, template, index, naming rule,
 * and authority boundary so future developers can record decisions safely.
 * Boundary: checks docs/adr and developer pointer docs only. It does not
 * inspect, execute, or alter engine, registry, app, auth, payment, UI, workflow,
 * runtime, proof, legal, or commercial behaviour.
 * Determinism: reads fixed repository files and exact marker strings without
 * network, clock, database, or runtime state.
 * Failure: emits CI_V1_ADR_SYSTEM_START when the ADR system or its authority
 * boundary drifts.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-06";
const TOKEN = "CI_V1_ADR_SYSTEM_START";

const ADR_DIR = "docs/adr";
const ADR_README = "docs/adr/README.md";
const ADR_TEMPLATE = "docs/adr/ADR_TEMPLATE.md";
const ADR_INDEX = "docs/adr/INDEX.md";
const DEVELOPER_CONVENTIONS = "docs/dev/DEVELOPER_OPERATING_CONVENTIONS.md";
const NAMING_CONVENTIONS = "docs/dev/NAMING_CONVENTIONS.md";
const REPO_MAP = "docs/dev/REPO_MAP.md";
const AUTHORITY_MAP = "docs/v1/V1_DOC_AUTHORITY_MAP.md";

const REQUIRED_README_MARKERS = [
  "# Architecture Decision Records",
  "Slice: S-V1-06.",
  "ADRs document decisions; they do not create engine law.",
  "Boundary docs and tests remain authoritative where applicable.",
  "Canonical docs define law.",
  "Tests prove behaviour.",
  "Comments explain boundaries.",
  "CI blocks drift.",
  "ADR filenames must match `ADR-[0-9]{4}-[a-z0-9]+(-[a-z0-9]+)*.md`.",
  "Only Accepted ADRs describe an active decision.",
  "`docs/adr/INDEX.md` must list every numbered ADR and its status.",
  "New ADRs must start from `docs/adr/ADR_TEMPLATE.md`."
];

const REQUIRED_TEMPLATE_MARKERS = [
  "# ADR-0000-short-decision-name",
  "Status: Proposed",
  "Date: YYYY-MM-DD",
  "Decision owner:",
  "## Context",
  "## Decision",
  "## Boundary impact",
  "## Consequences",
  "## Alternatives considered",
  "## Proof",
  "## Non-scope",
  "## Authority note",
  "ADRs document decisions; they do not create engine law.",
  "Boundary docs, contracts, tests, and guards remain authoritative where applicable.",
  "## Supersedes",
  "## Superseded by"
];

const REQUIRED_INDEX_MARKERS = [
  "# ADR Index",
  "Slice: S-V1-06.",
  "ADRs document decisions; they do not create engine law.",
  "Boundary docs and tests remain authoritative where applicable.",
  "`ADR-0001-short-decision-name.md`",
  "| ADR | Status | Title | Slice | Notes |",
  "| None yet. | N/A | ADR system started. | S-V1-06 | First numbered ADR will be added when a future decision needs a durable record. |"
];

const REQUIRED_DEVELOPER_MARKERS = [
  "11. docs/adr/README.md",
  "## ADR rule",
  "Architecture Decision Records live in `docs/adr`.",
  "ADRs document decisions; they do not create engine law.",
  "Boundary docs and tests remain authoritative where applicable."
];

const REQUIRED_NAMING_MARKERS = [
  "## ADR names",
  "Use `docs/adr` for Architecture Decision Records.",
  "ADR filenames must match `ADR-[0-9]{4}-[a-z0-9]+(-[a-z0-9]+)*.md`.",
  "Allowed non-numbered files directly under `docs/adr/` are:",
  "ADRs document decisions; they do not create engine law."
];

const REQUIRED_REPO_MAP_MARKERS = [
  "## ADR System",
  "`docs/adr/` owns Architecture Decision Records.",
  "ADRs do not create product law, engine law, registry law, release law, CI token meaning, payment authority, auth authority, UI authority, legal authority, commercial authority, runtime authority, or proof authority.",
  "Boundary docs and tests remain authoritative where applicable."
];

const REQUIRED_AUTHORITY_MARKERS = [
  "## ADR authority position",
  "Architecture Decision Records live in `docs/adr`.",
  "Read the ADR system entry point at `docs/adr/README.md`.",
  "ADRs document decisions; they do not create engine law.",
  "Boundary docs, contracts, tests, and guards remain authoritative where applicable."
];

const NUMBERED_ADR_RE = /^ADR-[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const ALLOWED_SYSTEM_FILES = new Set(["README.md", "INDEX.md", "ADR_TEMPLATE.md"]);
const FORBIDDEN_VAGUE_NAME_PARTS = ["final", "new", "fix", "misc", "stuff", "wip", "temp", "temporary"];

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    message,
    ...details
  }, null, 2));

  process.exitCode = 1;
}

function readRequiredText(relPath) {
  const absPath = path.join(ROOT, relPath);

  if (!fs.existsSync(absPath)) {
    fail("Required file is missing.", { path: relPath });
    return "";
  }

  return fs.readFileSync(absPath, "utf8");
}

function assertMarkers(relPath, markers, markerType) {
  const text = readRequiredText(relPath);

  for (const marker of markers) {
    if (!text.includes(marker)) {
      fail("Required ADR system marker is missing.", {
        path: relPath,
        marker_type: markerType,
        marker
      });
    }
  }
}

function assertAdrNaming() {
  const absDir = path.join(ROOT, ADR_DIR);

  if (!fs.existsSync(absDir)) {
    fail("ADR directory is missing.", { path: ADR_DIR });
    return;
  }

  for (const dirent of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (!dirent.isFile()) {
      continue;
    }

    const name = dirent.name;

    if (!name.endsWith(".md")) {
      fail("ADR directory contains non-markdown file.", { file: name });
      continue;
    }

    if (ALLOWED_SYSTEM_FILES.has(name)) {
      continue;
    }

    if (!NUMBERED_ADR_RE.test(name)) {
      fail("ADR filename does not match required naming pattern.", {
        file: name,
        required_pattern: "ADR-[0-9]{4}-[a-z0-9]+(-[a-z0-9]+)*.md"
      });
      continue;
    }

    const lower = name.toLowerCase();

    for (const part of FORBIDDEN_VAGUE_NAME_PARTS) {
      if (lower.includes(`-${part}.md`) || lower.includes(`-${part}-`)) {
        fail("ADR filename uses vague wording.", {
          file: name,
          vague_part: part
        });
      }
    }
  }
}

assertMarkers(ADR_README, REQUIRED_README_MARKERS, "adr_readme");
assertMarkers(ADR_TEMPLATE, REQUIRED_TEMPLATE_MARKERS, "adr_template");
assertMarkers(ADR_INDEX, REQUIRED_INDEX_MARKERS, "adr_index");
assertMarkers(DEVELOPER_CONVENTIONS, REQUIRED_DEVELOPER_MARKERS, "developer_conventions");
assertMarkers(NAMING_CONVENTIONS, REQUIRED_NAMING_MARKERS, "naming_conventions");
assertMarkers(REPO_MAP, REQUIRED_REPO_MAP_MARKERS, "repo_map");
assertMarkers(AUTHORITY_MAP, REQUIRED_AUTHORITY_MARKERS, "authority_map");
assertAdrNaming();

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-06 ADR system start guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  adr_readme: ADR_README,
  adr_template: ADR_TEMPLATE,
  adr_index: ADR_INDEX,
  message: "ADR system start passed."
}, null, 2));
