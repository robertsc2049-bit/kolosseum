import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const RUNBOOK_PATH = path.join(REPO_ROOT, "docs", "releases", "V1_OPERATOR_FREEZE_RUNBOOK.md");

function fail(token, details, extra = {}) {
  process.stdout.write(
    JSON.stringify(
      {
        ok: false,
        token,
        details,
        ...extra,
      },
      null,
      2
    ) + "\n"
  );
  process.exit(1);
}

function ok(payload = {}) {
  process.stdout.write(JSON.stringify({ ok: true, ...payload }, null, 2) + "\n");
  process.exit(0);
}

function normaliseRelative(ref) {
  return ref.replace(/[\\/]+/g, "/");
}

function fileExists(relativePath) {
  const fullPath = path.join(REPO_ROOT, ...relativePath.split("/"));
  return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
}

function extractReferencedPaths(markdown) {
  const refs = new Set();

  const mdLinkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(mdLinkRegex)) {
    const raw = String(match[1] ?? "").trim();
    if (
      raw.startsWith("docs/releases/") ||
      raw.startsWith("./docs/releases/") ||
      raw.startsWith("ci/scripts/") ||
      raw.startsWith("./ci/scripts/")
    ) {
      refs.add(normaliseRelative(raw.replace(/^\.\//, "")));
    }
  }

  const pathLineRegex = /(?<![A-Za-z0-9_./-])((?:docs\/releases|ci\/scripts)\/[A-Za-z0-9._/-]+\.(?:md|json|mjs))(?![A-Za-z0-9_./-])/g;
  for (const match of markdown.matchAll(pathLineRegex)) {
    refs.add(normaliseRelative(String(match[1])));
  }

  const commandRegex = /node\s+\.\\(ci\\scripts\\[A-Za-z0-9._-]+\.mjs)/g;
  for (const match of markdown.matchAll(commandRegex)) {
    refs.add(normaliseRelative(String(match[1]).replace(/\\/g, "/")));
  }

  return [...refs].sort();
}

function main() {
  if (!fs.existsSync(RUNBOOK_PATH)) {
    fail(
      "CI_OPERATOR_FREEZE_RUNBOOK_SURFACE_MISSING",
      "Operator freeze runbook is missing.",
      { runbook_path: "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md" }
    );
  }

  const markdown = fs.readFileSync(RUNBOOK_PATH, "utf8");
  const referencedPaths = extractReferencedPaths(markdown);

  if (referencedPaths.length === 0) {
    fail(
      "CI_OPERATOR_FREEZE_RUNBOOK_SURFACE_EMPTY",
      "Operator freeze runbook does not reference any operator-freeze artefact surfaces.",
      { runbook_path: "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md" }
    );
  }

  const missing = referencedPaths.filter((ref) => !fileExists(ref));

  if (missing.length > 0) {
    fail(
      "CI_OPERATOR_FREEZE_RUNBOOK_SURFACE_MISSING",
      `Operator freeze runbook references missing surface(s): ${missing.join(", ")}`,
      {
        runbook_path: "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
        referenced_paths: referencedPaths,
        missing_paths: missing,
      }
    );
  }

  ok({
    runbook_path: "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
    referenced_paths: referencedPaths,
    checked_count: referencedPaths.length,
  });
}

main();