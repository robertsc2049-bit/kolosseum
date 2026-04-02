import fs from "node:fs";
import path from "node:path";

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
      "FREEZE_PROOF_CHAIN_COMPLETENESS_REQUIRED_SET_MISSING",
      `Freeze required proof set '${requiredProofSetPath}' does not exist.`,
      { path: requiredProofSetPath }
    );
  }

  const manifest = readJson(abs);
  if (manifest?.schema_version !== "kolosseum.freeze.required_proof_set.v1") {
    fail(
      "FREEZE_PROOF_CHAIN_COMPLETENESS_REQUIRED_SET_SCHEMA_INVALID",
      "Freeze required proof set schema_version must be kolosseum.freeze.required_proof_set.v1.",
      { schema_version: manifest?.schema_version ?? null }
    );
  }

  const requiredProofIdsInOrder = normalizeOrderedStringArray(
    manifest.required_proof_ids_in_order,
    "FREEZE_PROOF_CHAIN_COMPLETENESS_REQUIRED_SET_INVALID",
    "required_proof_ids_in_order"
  );

  if (requiredProofIdsInOrder.length === 0) {
    fail(
      "FREEZE_PROOF_CHAIN_COMPLETENESS_REQUIRED_SET_EMPTY",
      "Freeze required proof set must declare at least one proof id."
    );
  }

  return {
    manifest,
    required_proof_ids_in_order: requiredProofIdsInOrder
  };
}

function loadProofChain(repoRoot, proofChainPath) {
  const abs = toAbs(repoRoot, proofChainPath);
  if (!fs.existsSync(abs)) {
    fail(
      "FREEZE_PROOF_CHAIN_COMPLETENESS_CHAIN_MISSING",
      `Freeze proof chain manifest '${proofChainPath}' does not exist.`,
      { path: proofChainPath }
    );
  }

  const manifest = readJson(abs);
  if (manifest?.schema_version !== "kolosseum.freeze.proof_chain.v1") {
    fail(
      "FREEZE_PROOF_CHAIN_COMPLETENESS_CHAIN_SCHEMA_INVALID",
      "Freeze proof chain manifest schema_version must be kolosseum.freeze.proof_chain.v1.",
      { schema_version: manifest?.schema_version ?? null }
    );
  }

  ensureArray(
    manifest.proof_steps,
    "FREEZE_PROOF_CHAIN_COMPLETENESS_CHAIN_STEPS_INVALID",
    "proof_steps must be an array."
  );

  const proofIdsInOrder = normalizeOrderedStringArray(
    manifest.proof_steps.map((step) => step?.proof_id),
    "FREEZE_PROOF_CHAIN_COMPLETENESS_CHAIN_PROOF_IDS_INVALID",
    "proof_steps.proof_id"
  );

  return {
    manifest,
    proof_ids_in_order: proofIdsInOrder
  };
}

function compareSets(actual, expected, codePrefix, subjectLabel) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  const missing = expected.filter((item) => !actualSet.has(item));
  const extra = actual.filter((item) => !expectedSet.has(item));

  const failures = [];

  if (missing.length > 0) {
    failures.push({
      code: `${codePrefix}_MISSING`,
      message: `${subjectLabel} is missing required proof ids.`,
      missing
    });
  }

  if (extra.length > 0) {
    failures.push({
      code: `${codePrefix}_EXTRA`,
      message: `${subjectLabel} contains undeclared proof ids.`,
      extra
    });
  }

  return failures;
}

export function verifyFreezeProofChainCompleteness({
  repoRoot = process.cwd(),
  requiredProofSetPath = "docs/releases/V1_FREEZE_REQUIRED_PROOF_SET.json",
  proofChainPath = "docs/releases/V1_FREEZE_PROOF_CHAIN.json"
} = {}) {
  const requiredSet = loadRequiredProofSet(repoRoot, requiredProofSetPath);
  const proofChain = loadProofChain(repoRoot, proofChainPath);

  const failures = [];

  failures.push(
    ...compareSets(
      proofChain.proof_ids_in_order,
      requiredSet.required_proof_ids_in_order,
      "FREEZE_PROOF_CHAIN_COMPLETENESS_PROOF_SET",
      "Freeze proof chain"
    )
  );

  if (proofChain.proof_ids_in_order.length !== requiredSet.required_proof_ids_in_order.length) {
    failures.push({
      code: "FREEZE_PROOF_CHAIN_COMPLETENESS_ORDER_LENGTH_MISMATCH",
      message: "Freeze proof chain length differs from required proof set.",
      chain_proof_ids_in_order: proofChain.proof_ids_in_order,
      required_proof_ids_in_order: requiredSet.required_proof_ids_in_order
    });
  } else {
    for (let i = 0; i < proofChain.proof_ids_in_order.length; i += 1) {
      if (proofChain.proof_ids_in_order[i] !== requiredSet.required_proof_ids_in_order[i]) {
        failures.push({
          code: "FREEZE_PROOF_CHAIN_COMPLETENESS_ORDER_MISMATCH",
          message: "Freeze proof chain order differs from required proof set.",
          index: i,
          chain_proof_id: proofChain.proof_ids_in_order[i],
          required_proof_id: requiredSet.required_proof_ids_in_order[i]
        });
      }
    }
  }

  return {
    ok: failures.length === 0,
    schema_version: "kolosseum.freeze.proof_chain_completeness_report.v1",
    required_proof_set_path: requiredProofSetPath,
    proof_chain_path: proofChainPath,
    required_proof_count: requiredSet.required_proof_ids_in_order.length,
    chain_proof_count: proofChain.proof_ids_in_order.length,
    failures
  };
}

function main() {
  const requiredProofSetPath = process.argv[2] ?? "docs/releases/V1_FREEZE_REQUIRED_PROOF_SET.json";
  const proofChainPath = process.argv[3] ?? "docs/releases/V1_FREEZE_PROOF_CHAIN.json";
  const outputReportPath = process.argv[4] ?? null;

  let report;
  try {
    report = verifyFreezeProofChainCompleteness({
      repoRoot: process.cwd(),
      requiredProofSetPath,
      proofChainPath
    });
  } catch (error) {
    report = {
      ok: false,
      schema_version: "kolosseum.freeze.proof_chain_completeness_report.v1",
      fatal_error: {
        code: error?.code ?? "FREEZE_PROOF_CHAIN_COMPLETENESS_FATAL",
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