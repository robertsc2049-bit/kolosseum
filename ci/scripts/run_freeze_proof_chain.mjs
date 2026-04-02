import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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

function normalizeProofSteps(value) {
  ensureArray(
    value,
    "FREEZE_PROOF_CHAIN_STEPS_INVALID",
    "proof_steps must be an array."
  );

  const seenIds = new Set();
  const seenScripts = new Set();

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      fail(
        "FREEZE_PROOF_CHAIN_STEP_INVALID",
        `proof_steps entry at index ${index} must be an object.`,
        { index }
      );
    }

    if (typeof item.proof_id !== "string" || item.proof_id.trim().length === 0) {
      fail(
        "FREEZE_PROOF_CHAIN_PROOF_ID_INVALID",
        `proof_steps entry at index ${index} must include non-empty proof_id.`,
        { index }
      );
    }

    if (typeof item.script_path !== "string" || item.script_path.trim().length === 0) {
      fail(
        "FREEZE_PROOF_CHAIN_SCRIPT_PATH_INVALID",
        `proof_steps entry at index ${index} must include non-empty script_path.`,
        { index }
      );
    }

    const proofId = item.proof_id.trim();
    const scriptPath = item.script_path.trim().replace(/\\/g, "/");

    if (path.isAbsolute(scriptPath)) {
      fail(
        "FREEZE_PROOF_CHAIN_SCRIPT_PATH_ABSOLUTE_FORBIDDEN",
        `proof_steps entry '${proofId}' must not use an absolute script_path.`,
        { proof_id: proofId, script_path: scriptPath }
      );
    }

    if (
      scriptPath === "." ||
      scriptPath === ".." ||
      scriptPath.startsWith("../") ||
      scriptPath.includes("/../")
    ) {
      fail(
        "FREEZE_PROOF_CHAIN_SCRIPT_PATH_TRAVERSAL_FORBIDDEN",
        `proof_steps entry '${proofId}' must not escape repo root.`,
        { proof_id: proofId, script_path: scriptPath }
      );
    }

    if (seenIds.has(proofId)) {
      fail(
        "FREEZE_PROOF_CHAIN_DUPLICATE_PROOF_ID",
        `Duplicate proof_id '${proofId}' in freeze proof chain.`,
        { proof_id: proofId }
      );
    }

    if (seenScripts.has(scriptPath)) {
      fail(
        "FREEZE_PROOF_CHAIN_DUPLICATE_SCRIPT_PATH",
        `Duplicate script_path '${scriptPath}' in freeze proof chain.`,
        { script_path: scriptPath }
      );
    }

    seenIds.add(proofId);
    seenScripts.add(scriptPath);

    return {
      proof_id: proofId,
      script_path: scriptPath,
      order: index
    };
  });
}

function loadProofChain(repoRoot, proofChainPath) {
  const abs = toAbs(repoRoot, proofChainPath);
  if (!fs.existsSync(abs)) {
    fail(
      "FREEZE_PROOF_CHAIN_MANIFEST_MISSING",
      `Freeze proof chain manifest '${proofChainPath}' does not exist.`,
      { path: proofChainPath }
    );
  }

  const manifest = readJson(abs);
  if (manifest?.schema_version !== "kolosseum.freeze.proof_chain.v1") {
    fail(
      "FREEZE_PROOF_CHAIN_SCHEMA_INVALID",
      "Freeze proof chain manifest schema_version must be kolosseum.freeze.proof_chain.v1.",
      { schema_version: manifest?.schema_version ?? null }
    );
  }

  const proofSteps = normalizeProofSteps(manifest.proof_steps);
  if (proofSteps.length === 0) {
    fail(
      "FREEZE_PROOF_CHAIN_EMPTY",
      "Freeze proof chain must declare at least one proof step."
    );
  }

  return {
    manifest,
    proof_steps: proofSteps
  };
}

function runChildProof(repoRoot, step) {
  const scriptAbs = toAbs(repoRoot, step.script_path);
  if (!fs.existsSync(scriptAbs)) {
    fail(
      "FREEZE_PROOF_CHAIN_CHILD_SCRIPT_MISSING",
      `Freeze proof child script '${step.script_path}' does not exist.`,
      {
        proof_id: step.proof_id,
        script_path: step.script_path
      }
    );
  }

  const stat = fs.statSync(scriptAbs);
  if (!stat.isFile()) {
    fail(
      "FREEZE_PROOF_CHAIN_CHILD_SCRIPT_NOT_FILE",
      `Freeze proof child script '${step.script_path}' is not a file.`,
      {
        proof_id: step.proof_id,
        script_path: step.script_path
      }
    );
  }

  const child = spawnSync(
    process.execPath,
    [scriptAbs],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env },
      maxBuffer: 20 * 1024 * 1024
    }
  );

  if (child.error) {
    fail(
      "FREEZE_PROOF_CHAIN_CHILD_EXECUTION_FAILED",
      `Freeze proof child '${step.proof_id}' failed to execute.`,
      {
        proof_id: step.proof_id,
        script_path: step.script_path,
        cause: child.error.message
      }
    );
  }

  const stdout = child.stdout ?? "";
  const stderr = child.stderr ?? "";

  let parsed = null;
  const trimmedStdout = stdout.trim();
  if (trimmedStdout.length > 0) {
    try {
      parsed = JSON.parse(trimmedStdout);
    } catch {
      fail(
        "FREEZE_PROOF_CHAIN_CHILD_OUTPUT_INVALID_JSON",
        `Freeze proof child '${step.proof_id}' did not emit valid JSON.`,
        {
          proof_id: step.proof_id,
          script_path: step.script_path,
          stdout,
          stderr,
          exit_code: child.status
        }
      );
    }
  } else {
    fail(
      "FREEZE_PROOF_CHAIN_CHILD_OUTPUT_EMPTY",
      `Freeze proof child '${step.proof_id}' emitted no JSON output.`,
      {
        proof_id: step.proof_id,
        script_path: step.script_path,
        stderr,
        exit_code: child.status
      }
    );
  }

  if (child.status !== 0) {
    fail(
      "FREEZE_PROOF_CHAIN_CHILD_NONZERO_EXIT",
      `Freeze proof child '${step.proof_id}' exited non-zero.`,
      {
        proof_id: step.proof_id,
        script_path: step.script_path,
        exit_code: child.status,
        stdout,
        stderr,
        child_report: parsed
      }
    );
  }

  if (!parsed || parsed.ok !== true) {
    fail(
      "FREEZE_PROOF_CHAIN_CHILD_NOT_OK",
      `Freeze proof child '${step.proof_id}' did not report ok=true.`,
      {
        proof_id: step.proof_id,
        script_path: step.script_path,
        child_report: parsed
      }
    );
  }

  return {
    proof_id: step.proof_id,
    script_path: step.script_path,
    order: step.order,
    ok: true,
    schema_version: parsed.schema_version ?? null
  };
}

export function runFreezeProofChain({
  repoRoot = process.cwd(),
  proofChainPath = "docs/releases/V1_FREEZE_PROOF_CHAIN.json"
} = {}) {
  const chain = loadProofChain(repoRoot, proofChainPath);
  const results = [];

  for (const step of chain.proof_steps) {
    results.push(runChildProof(repoRoot, step));
  }

  return {
    ok: true,
    schema_version: "kolosseum.freeze.proof_chain_report.v1",
    proof_chain_path: proofChainPath,
    proof_count: results.length,
    results
  };
}

function main() {
  const proofChainPath = process.argv[2] ?? "docs/releases/V1_FREEZE_PROOF_CHAIN.json";
  const outputReportPath = process.argv[3] ?? null;

  let report;
  try {
    report = runFreezeProofChain({
      repoRoot: process.cwd(),
      proofChainPath
    });
  } catch (error) {
    report = {
      ok: false,
      schema_version: "kolosseum.freeze.proof_chain_report.v1",
      fatal_error: {
        code: error?.code ?? "FREEZE_PROOF_CHAIN_FATAL",
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