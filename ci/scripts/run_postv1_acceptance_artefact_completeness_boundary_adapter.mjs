import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const FAILURE = {
  ACCEPTANCE_ARTEFACT_ADAPTER_SOURCE_UNPARSEABLE: "acceptance_artefact_adapter_source_unparseable",
  ACCEPTANCE_ARTEFACT_ADAPTER_INVALID_SOURCE: "acceptance_artefact_adapter_invalid_source",
  ACCEPTANCE_ARTEFACT_ADAPTER_EXECUTION_FAILED: "acceptance_artefact_adapter_execution_failed",
};

function normalizeRelativePath(value) {
  return String(value).replace(/\\/g, "/");
}

function createFailure(token, filePath, details) {
  return {
    token,
    path: normalizeRelativePath(filePath),
    details,
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyFileIntoTemp(tempRoot, repoRoot, repoRelativePath) {
  const sourceAbs = path.resolve(repoRoot, repoRelativePath);
  const destAbs = path.resolve(tempRoot, repoRelativePath);

  ensureParentDir(destAbs);

  if (fs.existsSync(sourceAbs) && fs.statSync(sourceAbs).isFile()) {
    fs.copyFileSync(sourceAbs, destAbs);
    return true;
  }

  return false;
}

function extractArtefactPath(entry) {
  if (typeof entry === "string" && entry.trim().length > 0) {
    return entry.trim();
  }

  if (entry && typeof entry === "object") {
    const candidateKeys = [
      "path",
      "file",
      "relative_path",
      "relativePath",
      "artifact_path",
      "artefact_path",
      "artifactPath",
      "artefactPath",
    ];

    for (const key of candidateKeys) {
      if (typeof entry[key] === "string" && entry[key].trim().length > 0) {
        return entry[key].trim();
      }
    }
  }

  return null;
}

function main() {
  const repoRoot = process.cwd();
  const sourceSetPath = path.resolve(repoRoot, "docs/releases/V1_ACCEPTANCE_ARTEFACT_SET.json");
  const legacyVerifierPath = path.resolve(
    repoRoot,
    "ci/scripts/run_postv1_acceptance_artefact_completeness_verifier.mjs"
  );

  let sourceSet;
  try {
    sourceSet = readJson(sourceSetPath);
  } catch (error) {
    const report = {
      ok: false,
      failures: [
        createFailure(
          FAILURE.ACCEPTANCE_ARTEFACT_ADAPTER_SOURCE_UNPARSEABLE,
          "docs/releases/V1_ACCEPTANCE_ARTEFACT_SET.json",
          error instanceof Error ? error.message : String(error)
        ),
      ],
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  if (
    !sourceSet ||
    typeof sourceSet !== "object" ||
    Array.isArray(sourceSet) ||
    !Array.isArray(sourceSet.artefacts)
  ) {
    const report = {
      ok: false,
      failures: [
        createFailure(
          FAILURE.ACCEPTANCE_ARTEFACT_ADAPTER_INVALID_SOURCE,
          "docs/releases/V1_ACCEPTANCE_ARTEFACT_SET.json",
          "Acceptance artefact set must be an object containing an artefacts array."
        ),
      ],
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  const normalisedArtefacts = [];
  for (const entry of sourceSet.artefacts) {
    const artefactPath = extractArtefactPath(entry);
    if (!artefactPath) {
      const report = {
        ok: false,
        failures: [
          createFailure(
            FAILURE.ACCEPTANCE_ARTEFACT_ADAPTER_INVALID_SOURCE,
            "docs/releases/V1_ACCEPTANCE_ARTEFACT_SET.json",
            "Every artefact entry must contain a usable path."
          ),
        ],
      };
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      process.exitCode = 1;
      return;
    }
    normalisedArtefacts.push(normalizeRelativePath(artefactPath));
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "p54-acceptance-artefact-adapter-"));
  const tempSetPath = path.resolve(tempRoot, "docs/releases/V1_ACCEPTANCE_ARTEFACT_SET.json");

  for (const artefactPath of normalisedArtefacts) {
    copyFileIntoTemp(tempRoot, repoRoot, artefactPath);
  }

  ensureParentDir(tempSetPath);
  fs.writeFileSync(
    tempSetPath,
    `${JSON.stringify(
      {
        name: "v1_acceptance_artefact_set",
        artefacts: normalisedArtefacts,
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const result = spawnSync(process.execPath, [legacyVerifierPath], {
    cwd: tempRoot,
    encoding: "utf8",
  });

  const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";

  if ((result.status ?? 1) !== 0) {
    const report = {
      ok: false,
      failures: [
        createFailure(
          FAILURE.ACCEPTANCE_ARTEFACT_ADAPTER_EXECUTION_FAILED,
          "ci/scripts/run_postv1_acceptance_artefact_completeness_verifier.mjs",
          stderr || stdout || "Acceptance artefact completeness verifier exited non-zero."
        ),
      ],
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${JSON.stringify({ ok: true, failures: [] }, null, 2)}\n`);
  process.exitCode = 0;
}

main();