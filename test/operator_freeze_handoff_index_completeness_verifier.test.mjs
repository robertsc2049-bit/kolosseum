import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REPO_ROOT = process.cwd();
const SCRIPT = path.join(REPO_ROOT, "ci", "scripts", "run_operator_freeze_handoff_index_completeness_verifier.mjs");

function setupTempRepo({ handoffIndexContent, runbookContent }) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "p101-freeze-handoff-index-"));
  fs.mkdirSync(path.join(tempRoot, "docs", "releases"), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, "ci", "scripts"), { recursive: true });

  fs.writeFileSync(
    path.join(tempRoot, "docs", "releases", "V1_HANDOFF_INDEX.md"),
    handoffIndexContent,
    "utf8"
  );

  fs.writeFileSync(
    path.join(tempRoot, "docs", "releases", "V1_OPERATOR_FREEZE_RUNBOOK.md"),
    runbookContent,
    "utf8"
  );

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

const canonicalRunbook = [
  "# V1 Operator Freeze Runbook",
  "",
  "Freeze procedures.",
  ""
].join("\n");

test("passes when handoff index includes freeze runbook entry", () => {
  const cwd = setupTempRepo({
    runbookContent: canonicalRunbook,
    handoffIndexContent: [
      "# V1 Handoff Index",
      "",
      "- [Operator Freeze Runbook](docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md)",
      ""
    ].join("\n")
  });

  const result = runVerifier(cwd);
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /"ok": true/);
});

test("fails when handoff index omits freeze runbook path", () => {
  const cwd = setupTempRepo({
    runbookContent: canonicalRunbook,
    handoffIndexContent: [
      "# V1 Handoff Index",
      "",
      "- Operator Freeze Runbook",
      ""
    ].join("\n")
  });

  const result = runVerifier(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /CI_OPERATOR_FREEZE_HANDOFF_INDEX_BINDING_MISSING/);
  assert.match(result.stdout, /V1_OPERATOR_FREEZE_RUNBOOK\.md/);
});

test("fails when handoff index omits freeze runbook label", () => {
  const cwd = setupTempRepo({
    runbookContent: canonicalRunbook,
    handoffIndexContent: [
      "# V1 Handoff Index",
      "",
      "- [Freeze Doc](docs/releases/V1_OPERATOR_FREEZE_RUNBOOK.md)",
      ""
    ].join("\n")
  });

  const result = runVerifier(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /CI_OPERATOR_FREEZE_HANDOFF_INDEX_BINDING_MISSING/);
  assert.match(result.stdout, /Operator Freeze Runbook/);
});