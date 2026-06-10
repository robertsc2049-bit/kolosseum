import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function makeRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "p147-freeze-signoff-"));
}

function writeJson(repo, relPath, value) {
  const abs = path.join(repo, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function runGenerator(repo) {
  const scriptSource = path.resolve("ci/scripts/build_freeze_signoff_summary.mjs");
  const scriptDest = path.join(repo, "ci/scripts/build_freeze_signoff_summary.mjs");
  fs.mkdirSync(path.dirname(scriptDest), { recursive: true });
  fs.copyFileSync(scriptSource, scriptDest);

  return spawnSync(process.execPath, [scriptDest], {
    cwd: repo,
    encoding: "utf8"
  });
}

function readSummary(repo) {
  return fs.readFileSync(path.join(repo, "docs/releases/V1_FREEZE_SIGNOFF_SUMMARY.md"), "utf8");
}

test("P147 generates signoff summary from required freeze json artefacts", () => {
  const repo = makeRepo();

  writeJson(repo, "docs/releases/V1_FREEZE_CLOSURE.json", {
    document_id: "freeze_closure",
    verdict: "PASS"
  });
  writeJson(repo, "docs/releases/V1_PROMOTION_READINESS.json", {
    document_id: "promotion_readiness",
    ok: true
  });
  writeJson(repo, "docs/releases/V1_FREEZE_EXIT_CRITERIA.json", {
    document_id: "freeze_exit",
    status: "PASS"
  });
  writeJson(repo, "docs/releases/V1_FREEZE_PROOF_FRESHNESS.json", {
    document_id: "freeze_proof_freshness",
    passed: true
  });

  const result = runGenerator(repo);
  assert.equal(result.status, 0, result.stderr);
  const summary = readSummary(repo);

  assert.match(summary, /overall_signoff: PASS/);
  assert.match(summary, /closure: PASS/);
  assert.match(summary, /readiness: PASS/);
  assert.match(summary, /exit: PASS/);
  assert.match(summary, /drift: PASS/);
});

test("P147 missing source artefact fails hard", () => {
  const repo = makeRepo();

  writeJson(repo, "docs/releases/V1_FREEZE_CLOSURE.json", {
    document_id: "freeze_closure",
    verdict: "PASS"
  });
  writeJson(repo, "docs/releases/V1_PROMOTION_READINESS.json", {
    document_id: "promotion_readiness",
    ok: true
  });
  writeJson(repo, "docs/releases/V1_FREEZE_EXIT_CRITERIA.json", {
    document_id: "freeze_exit",
    status: "PASS"
  });

  const result = runGenerator(repo);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /P147_SIGNOFF_SOURCE_UNRESOLVED: drift/);
});

test("P147 unknown verdict fails hard", () => {
  const repo = makeRepo();

  writeJson(repo, "docs/releases/V1_FREEZE_CLOSURE.json", {
    document_id: "freeze_closure",
    verdict: "PASS"
  });
  writeJson(repo, "docs/releases/V1_PROMOTION_READINESS.json", {
    document_id: "promotion_readiness",
    ok: true
  });
  writeJson(repo, "docs/releases/V1_FREEZE_EXIT_CRITERIA.json", {
    document_id: "freeze_exit",
    status: "PASS"
  });
  writeJson(repo, "docs/releases/V1_FREEZE_PROOF_FRESHNESS.json", {
    document_id: "freeze_proof_freshness",
    verdict: "MAYBE"
  });

  const result = runGenerator(repo);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /P147_SIGNOFF_VERDICT_MISSING_OR_UNKNOWN: drift/);
});

test("P147 output is deterministic for identical inputs", () => {
  const repo = makeRepo();

  writeJson(repo, "docs/releases/V1_FREEZE_CLOSURE.json", {
    document_id: "freeze_closure",
    verdict: "PASS"
  });
  writeJson(repo, "docs/releases/V1_PROMOTION_READINESS.json", {
    document_id: "promotion_readiness",
    ok: true
  });
  writeJson(repo, "docs/releases/V1_FREEZE_EXIT_CRITERIA.json", {
    document_id: "freeze_exit",
    status: "PASS"
  });
  writeJson(repo, "docs/releases/V1_FREEZE_PROOF_FRESHNESS.json", {
    document_id: "freeze_proof_freshness",
    passed: true
  });

  const first = runGenerator(repo);
  assert.equal(first.status, 0, first.stderr);
  const summaryA = readSummary(repo);

  const second = runGenerator(repo);
  assert.equal(second.status, 0, second.stderr);
  const summaryB = readSummary(repo);

  assert.equal(summaryA, summaryB);
});

test("P147 surfaces blocking failures when any source fails", () => {
  const repo = makeRepo();

  writeJson(repo, "docs/releases/V1_FREEZE_CLOSURE.json", {
    document_id: "freeze_closure",
    verdict: "PASS"
  });
  writeJson(repo, "docs/releases/V1_PROMOTION_READINESS.json", {
    document_id: "promotion_readiness",
    ok: false,
    failures: ["readiness gate incomplete"]
  });
  writeJson(repo, "docs/releases/V1_FREEZE_EXIT_CRITERIA.json", {
    document_id: "freeze_exit",
    status: "PASS"
  });
  writeJson(repo, "docs/releases/V1_FREEZE_PROOF_FRESHNESS.json", {
    document_id: "freeze_proof_freshness",
    passed: true
  });

  const result = runGenerator(repo);
  assert.equal(result.status, 0, result.stderr);
  const summary = readSummary(repo);

  assert.match(summary, /overall_signoff: FAIL/);
  assert.match(summary, /\[readiness\] readiness gate incomplete/);
});