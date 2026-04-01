import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const RUNBOOK_RELATIVE_PATH = "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md";
const CHECKLIST_RELATIVE_PATH = "docs/releases/V1_RELEASE_CHECKLIST.md";
const RUNBOOK_PATH = path.join(REPO_ROOT, ...RUNBOOK_RELATIVE_PATH.split("/"));
const CHECKLIST_PATH = path.join(REPO_ROOT, ...CHECKLIST_RELATIVE_PATH.split("/"));

function fail(token, details, extra = {}) {
  process.stdout.write(
    JSON.stringify(
      {
        ok: false,
        token,
        details,
        ...extra
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

function normalize(text) {
  return String(text ?? "").replace(/\r\n/g, "\n");
}

function main() {
  if (!fs.existsSync(RUNBOOK_PATH)) {
    fail(
      "CI_OPERATOR_FREEZE_RUNBOOK_MISSING",
      "Operator freeze runbook is missing.",
      { runbook_path: RUNBOOK_RELATIVE_PATH }
    );
  }

  if (!fs.existsSync(CHECKLIST_PATH)) {
    fail(
      "CI_OPERATOR_FREEZE_RELEASE_CHECKLIST_MISSING",
      "Release checklist is missing.",
      { checklist_path: CHECKLIST_RELATIVE_PATH }
    );
  }

  const runbook = normalize(fs.readFileSync(RUNBOOK_PATH, "utf8"));
  const checklist = normalize(fs.readFileSync(CHECKLIST_PATH, "utf8"));

  const requiredChecklistSnippets = [
    "V1_OPERATOR_FREEZE_RUNBOOK.md",
    "node .\\ci\\scripts\\run_registry_seal_freeze.mjs",
    "node .\\ci\\scripts\\run_registry_seal_manifest_verifier.mjs",
    "node .\\ci\\scripts\\run_registry_seal_scope_completeness_verifier.mjs",
    "node .\\ci\\scripts\\run_registry_seal_gate.mjs",
    "node .\\ci\\scripts\\run_registry_seal_drift_diff_reporter.mjs"
  ];

  const missingSnippets = requiredChecklistSnippets.filter((snippet) => !checklist.includes(snippet));
  if (missingSnippets.length > 0) {
    fail(
      "CI_OPERATOR_FREEZE_RELEASE_CHECKLIST_BINDING_MISSING",
      "Release checklist does not fully acknowledge the freeze runbook and its execution steps.",
      {
        checklist_path: CHECKLIST_RELATIVE_PATH,
        runbook_path: RUNBOOK_RELATIVE_PATH,
        missing_snippets: missingSnippets
      }
    );
  }

  if (!runbook.includes("## Canonical Operator Freeze Command Order")) {
    fail(
      "CI_OPERATOR_FREEZE_RUNBOOK_CANONICAL_SECTION_MISSING",
      "Operator freeze runbook does not contain the canonical command-order section.",
      { runbook_path: RUNBOOK_RELATIVE_PATH }
    );
  }

  ok({
    runbook_path: RUNBOOK_RELATIVE_PATH,
    checklist_path: CHECKLIST_RELATIVE_PATH,
    required_snippets_checked: requiredChecklistSnippets
  });
}

main();