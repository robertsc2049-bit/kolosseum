import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const HANDOFF_INDEX_RELATIVE_PATH = "docs/releases/V1_HANDOFF_INDEX.md";
const RUNBOOK_RELATIVE_PATH = "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md";
const HANDOFF_INDEX_PATH = path.join(REPO_ROOT, ...HANDOFF_INDEX_RELATIVE_PATH.split("/"));
const RUNBOOK_PATH = path.join(REPO_ROOT, ...RUNBOOK_RELATIVE_PATH.split("/"));

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
  if (!fs.existsSync(HANDOFF_INDEX_PATH)) {
    fail(
      "CI_OPERATOR_FREEZE_HANDOFF_INDEX_MISSING",
      "Handoff index is missing.",
      { handoff_index_path: HANDOFF_INDEX_RELATIVE_PATH }
    );
  }

  if (!fs.existsSync(RUNBOOK_PATH)) {
    fail(
      "CI_OPERATOR_FREEZE_RUNBOOK_MISSING",
      "Operator freeze runbook is missing.",
      { runbook_path: RUNBOOK_RELATIVE_PATH }
    );
  }

  const handoffIndex = normalize(fs.readFileSync(HANDOFF_INDEX_PATH, "utf8"));

  const requiredSnippets = [
    "V1_OPERATOR_FREEZE_RUNBOOK.md",
    "Operator Freeze Runbook"
  ];

  const missingSnippets = requiredSnippets.filter((snippet) => !handoffIndex.includes(snippet));
  if (missingSnippets.length > 0) {
    fail(
      "CI_OPERATOR_FREEZE_HANDOFF_INDEX_BINDING_MISSING",
      "Handoff index does not include the operator freeze runbook entry.",
      {
        handoff_index_path: HANDOFF_INDEX_RELATIVE_PATH,
        runbook_path: RUNBOOK_RELATIVE_PATH,
        missing_snippets: missingSnippets
      }
    );
  }

  ok({
    handoff_index_path: HANDOFF_INDEX_RELATIVE_PATH,
    runbook_path: RUNBOOK_RELATIVE_PATH,
    required_snippets_checked: requiredSnippets
  });
}

main();