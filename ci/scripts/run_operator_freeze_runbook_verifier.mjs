import fs from "node:fs";
import path from "node:path";

const RUNBOOK_PATH = path.resolve("docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md");

const REQUIRED_SNIPPETS = [
  "node .\\ci\\scripts\\run_registry_seal_manifest_verifier.mjs",
  "node .\\ci\\scripts\\run_registry_seal_scope_completeness_verifier.mjs",
  "node .\\ci\\scripts\\run_registry_seal_drift_diff_reporter.mjs",
  "node .\\ci\\scripts\\run_registry_seal_gate.mjs",
  "node .\\ci\\scripts\\run_registry_seal_freeze.mjs",
  "Unfreeze is not allowed.",
  "Only lawful transition: pre_seal -> sealed."
];

function fail(token, details) {
  process.stderr.write(JSON.stringify({ ok: false, token, details }, null, 2) + "\\n");
  process.exit(1);
}

if (!fs.existsSync(RUNBOOK_PATH)) {
  fail(
    "CI_OPERATOR_FREEZE_RUNBOOK_MISSING",
    "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md is missing."
  );
}

const text = fs.readFileSync(RUNBOOK_PATH, "utf8");

for (const snippet of REQUIRED_SNIPPETS) {
  if (!text.includes(snippet)) {
    fail(
      "CI_OPERATOR_FREEZE_RUNBOOK_MISMATCH",
      `Missing required runbook snippet: ${snippet}`
    );
  }
}

if (/sealed\s*->\s*pre_seal/i.test(text) || /pre_seal\s*<-\s*sealed/i.test(text)) {
  fail(
    "CI_OPERATOR_FREEZE_RUNBOOK_CONTRADICTION",
    "Reverse lifecycle transition is forbidden."
  );
}

if (/unfreeze/i.test(text) && !text.includes("Unfreeze is not allowed.")) {
  fail(
    "CI_OPERATOR_FREEZE_RUNBOOK_CONTRADICTION",
    "Runbook mentions unfreeze without the required prohibition."
  );
}

process.stdout.write(JSON.stringify({
  ok: true,
  runbook_path: "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md"
}, null, 2) + "\\n");
