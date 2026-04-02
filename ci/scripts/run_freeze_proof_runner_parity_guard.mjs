import fs from "node:fs";
import path from "node:path";

import { RUNNER_STAGE_IDS_IN_ORDER } from "./run_freeze_proof_chain.mjs";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(code, message, details = {}) {
  const err = new Error(message);
  err.code = code;
  err.details = details;
  throw err;
}

function ensureArray(value, code, message, details = {}) {
  if (!Array.isArray(value)) {
    fail(code, message, details);
  }
}

function toAbs(repoRoot, repoRelativePath) {
  return path.resolve(repoRoot, repoRelativePath);
}

function normalizeOrderedStringArray(values, code, label) {
  ensureArray(values, code, `${label} must be an array.`);
  const seen = new Set();
  const ordered = [];

  for (const value of values) {
    if (typeof value !== "string" || value.trim().length === 0) {
      fail(code, `${label} entries must be non-empty strings.`, { value });
    }

    const normalized = value.trim();
    if (seen.has(normalized)) {
      fail(code, `${label} contains duplicate entry '${normalized}'.`, { value: normalized });
    }

    seen.add(normalized);
    ordered.push(normalized);
  }

  return ordered;
}

function loadRequiredProofSet(repoRoot, requiredProofSetPath) {
  const abs = toAbs(repoRoot, requiredProofSetPath);
  if (!fs.existsSync(abs)) {
    fail(
      "FREEZE_PROOF_RUNNER_PARITY_REQUIRED_SET_MISSING",
      `Freeze required proof set '${requiredProofSetPath}' does not exist.`,
      { path: requiredProofSetPath }
    );
  }

  const manifest = readJson(abs);
  if (manifest?.schema_version !== "kolosseum.freeze.required_proof_set.v1") {
    fail(
      "FREEZE_PROOF_RUNNER_PARITY_REQUIRED_SET_SCHEMA_INVALID",
      "Freeze required proof set schema_version must be kolosseum.freeze.required_proof_set.v1.",
      { schema_version: manifest?.schema_version ?? null }
    );
  }

  return normalizeOrderedStringArray(
    manifest.required_proof_ids_in_order,
    "FREEZE_PROOF_RUNNER_PARITY_REQUIRED_SET_INVALID",
    "required_proof_ids_in_order"
  );
}

function loadProofChain(repoRoot, proofChainPath) {
  const abs = toAbs(repoRoot, proofChainPath);
  if (!fs.existsSync(abs)) {
    fail(
      "FREEZE_PROOF_RUNNER_PARITY_CHAIN_MISSING",
      `Freeze proof chain manifest '${proofChainPath}' does not exist.`,
      { path: proofChainPath }
    );
  }

  const manifest = readJson(abs);
  if (manifest?.schema_version !== "kolosseum.freeze.proof_chain.v1") {
    fail(
      "FREEZE_PROOF_RUNNER_PARITY_CHAIN_SCHEMA_INVALID",
      "Freeze proof chain manifest schema_version must be kolosseum.freeze.proof_chain.v1.",
      { schema_version: manifest?.schema_version ?? null }
    );
  }

  return normalizeOrderedStringArray(
    manifest.proof_steps?.map((step) => step?.proof_id),
    "FREEZE_PROOF_RUNNER_PARITY_CHAIN_INVALID",
    "proof_steps.proof_id"
  );
}

function compareOrderedArrays(actual, expected, subjectLabel, codePrefix) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const failures = [];

  const missing = expected.filter((item) => !actualSet.has(item));
  const extra = actual.filter((item) => !expectedSet.has(item));

  if (missing.length > 0) {
    failures.push({
      code: `${codePrefix}_MISSING`,
      message: `${subjectLabel} is missing required stages.`,
      missing
    });
  }

  if (extra.length > 0) {
    failures.push({
      code: `${codePrefix}_EXTRA`,
      message: `${subjectLabel} contains undeclared stages.`,
      extra
    });
  }

  if (actual.length !== expected.length) {
    failures.push({
      code: `${codePrefix}_LENGTH_MISMATCH`,
      message: `${subjectLabel} length differs.`,
      actual,
      expected
    });
    return failures;
  }

  for (let i = 0; i < actual.length; i += 1) {
    if (actual[i] !== expected[i]) {
      failures.push({
        code: `${codePrefix}_ORDER_MISMATCH`,
        message: `${subjectLabel} order differs.`,
        index: i,
        actual: actual[i],
        expected: expected[i]
      });
    }
  }

  return failures;
}

export function verifyFreezeProofRunnerParity({
  repoRoot = process.cwd(),
  requiredProofSetPath = "docs/releases/V1_FREEZE_REQUIRED_PROOF_SET.json",
  proofChainPath = "docs/releases/V1_FREEZE_PROOF_CHAIN.json",
  runnerStageIds = RUNNER_STAGE_IDS_IN_ORDER
} = {}) {
  const normalizedRunnerStageIds = normalizeOrderedStringArray(
    runnerStageIds,
    "FREEZE_PROOF_RUNNER_PARITY_RUNNER_STAGE_IDS_INVALID",
    "runnerStageIds"
  );

  const requiredProofIds = loadRequiredProofSet(repoRoot, requiredProofSetPath);
  const chainProofIds = loadProofChain(repoRoot, proofChainPath);

  const failures = [];
  failures.push(
    ...compareOrderedArrays(
      normalizedRunnerStageIds,
      chainProofIds,
      "Runner stages vs freeze proof chain",
      "FREEZE_PROOF_RUNNER_PARITY_CHAIN"
    )
  );

  failures.push(
    ...compareOrderedArrays(
      normalizedRunnerStageIds,
      requiredProofIds,
      "Runner stages vs required proof set",
      "FREEZE_PROOF_RUNNER_PARITY_REQUIRED_SET"
    )
  );

  return {
    ok: failures.length === 0,
    schema_version: "kolosseum.freeze.proof_runner_parity_report.v1",
    required_proof_set_path: requiredProofSetPath,
    proof_chain_path: proofChainPath,
    runner_stage_count: normalizedRunnerStageIds.length,
    chain_stage_count: chainProofIds.length,
    required_stage_count: requiredProofIds.length,
    runner_stage_ids_in_order: normalizedRunnerStageIds,
    chain_proof_ids_in_order: chainProofIds,
    required_proof_ids_in_order: requiredProofIds,
    failures
  };
}

function main() {
  const requiredProofSetPath = process.argv[2] ?? "docs/releases/V1_FREEZE_REQUIRED_PROOF_SET.json";
  const proofChainPath = process.argv[3] ?? "docs/releases/V1_FREEZE_PROOF_CHAIN.json";
  const outputReportPath = process.argv[4] ?? null;

  let report;
  try {
    report = verifyFreezeProofRunnerParity({
      repoRoot: process.cwd(),
      requiredProofSetPath,
      proofChainPath
    });
  } catch (error) {
    report = {
      ok: false,
      schema_version: "kolosseum.freeze.proof_runner_parity_report.v1",
      fatal_error: {
        code: error?.code ?? "FREEZE_PROOF_RUNNER_PARITY_FATAL",
        message: error?.message ?? String(error),
        details: error?.details ?? {}
      }
    };
  }

  const json = `${JSON.stringify(report, null, 2)}\n`;

  if (outputReportPath) {
    const outputAbs = path.resolve(process.cwd(), outputReportPath);
    fs.mkdirSync(path.dirname(outputAbs), { recursive: true });
    fs.writeFileSync(outputAbs, json, "utf8");
  }

  process.stdout.write(json);
  process.exit(report.ok ? 0 : 1);
}

const entryHref = process.argv[1] ? new URL(`file://${path.resolve(process.argv[1])}`).href : null;
if (entryHref && import.meta.url === entryHref) {
  main();
}