import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REPO_ROOT = process.cwd();
const SCRIPT = path.join(REPO_ROOT, "ci", "scripts", "run_operator_freeze_artefact_set_composition_verifier.mjs");

const canonicalArtefacts = [
  "docs/releases/V1_FREEZE_ARTEFACT_SET.json",
  "docs/releases/V1_HANDOFF_INDEX.md",
  "docs/releases/V1_OPERATOR_EXECUTION_ORDER.md",
  "docs/releases/V1_OPERATOR_FREEZE_COMMAND_ORDER.json",
  "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md",
  "docs/releases/V1_RELEASE_CHECKLIST.md",
  "ci/scripts/run_operator_freeze_command_order_verifier.mjs",
  "ci/scripts/run_operator_freeze_handoff_index_completeness_verifier.mjs",
  "ci/scripts/run_operator_freeze_release_checklist_binding_verifier.mjs",
  "ci/scripts/run_operator_freeze_runbook_execution_order_binding_verifier.mjs",
  "ci/scripts/run_operator_freeze_runbook_surface_completeness_verifier.mjs"
];

function setupTempRepo({ artefacts }) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "p102-freeze-artefact-set-"));
  fs.mkdirSync(path.join(tempRoot, "docs", "releases"), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, "ci", "scripts"), { recursive: true });

  fs.writeFileSync(
    path.join(tempRoot, "docs", "releases", "V1_FREEZE_ARTEFACT_SET.json"),
    JSON.stringify({ artefacts }, null, 2),
    "utf8"
  );

  for (const relativePath of canonicalArtefacts) {
    if (relativePath === "docs/releases/V1_FREEZE_ARTEFACT_SET.json") {
      continue;
    }
    const fullPath = path.join(tempRoot, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, "fixture\n", "utf8");
  }

  return tempRoot;
}

function runVerifier(cwd) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT], {
      cwd,
      encoding: "utf8"
    });
    return { status: 0, stdout };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? ""
    };
  }
}

test("passes when freeze artefact registry matches canonical artefact set", () => {
  const cwd = setupTempRepo({ artefacts: canonicalArtefacts });
  const result = runVerifier(cwd);
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /"ok": true/);
  assert.match(result.stdout, /"artefact_count": 11/);
});

test("fails when a canonical freeze artefact is undeclared", () => {
  const artefacts = canonicalArtefacts.filter((value) => value !== "docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md");
  const cwd = setupTempRepo({ artefacts });
  const result = runVerifier(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /CI_OPERATOR_FREEZE_ARTEFACT_SET_UNDECLARED/);
  assert.match(result.stdout, /V1_OPERATOR_FREEZE_RUNBOOK\.md/);
});

test("fails when an extra artefact is declared", () => {
  const artefacts = [...canonicalArtefacts, "docs/releases/V1_EXTRA_FREEZE_NOTE.md"];
  const cwd = setupTempRepo({ artefacts });
  const result = runVerifier(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /CI_OPERATOR_FREEZE_ARTEFACT_SET_EXTRA/);
  assert.match(result.stdout, /V1_EXTRA_FREEZE_NOTE\.md/);
});