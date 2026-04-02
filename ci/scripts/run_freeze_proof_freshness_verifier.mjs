import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function stable(value) {
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stable(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(stable(value));
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
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

function toRepoAbsolute(repoRoot, repoRelativePath) {
  return path.resolve(repoRoot, repoRelativePath);
}

function buildGovernedSurface(repoRoot, surfaceManifest) {
  if (surfaceManifest?.schema_version !== "kolosseum.freeze.governed_surface.v1") {
    fail(
      "FREEZE_GOVERNED_SURFACE_SCHEMA_INVALID",
      "Surface manifest schema_version must be kolosseum.freeze.governed_surface.v1.",
      { schema_version: surfaceManifest?.schema_version ?? null }
    );
  }

  ensureArray(
    surfaceManifest.governed_artefacts,
    "FREEZE_GOVERNED_SURFACE_ARTEFACTS_INVALID",
    "Surface manifest governed_artefacts must be an array."
  );

  const seenPaths = new Set();
  const artefacts = surfaceManifest.governed_artefacts.map((item, index) => {
    if (!item || typeof item !== "object") {
      fail(
        "FREEZE_GOVERNED_SURFACE_ENTRY_INVALID",
        `Governed artefact entry at index ${index} must be an object.`,
        { index }
      );
    }

    if (typeof item.path !== "string" || item.path.length === 0) {
      fail(
        "FREEZE_GOVERNED_SURFACE_PATH_INVALID",
        `Governed artefact entry at index ${index} must include a non-empty path.`,
        { index }
      );
    }

    if (seenPaths.has(item.path)) {
      fail(
        "FREEZE_GOVERNED_SURFACE_DUPLICATE_PATH",
        `Duplicate governed artefact path '${item.path}'.`,
        { path: item.path }
      );
    }
    seenPaths.add(item.path);

    const abs = toRepoAbsolute(repoRoot, item.path);
    if (!fs.existsSync(abs)) {
      fail(
        "FREEZE_GOVERNED_ARTEFACT_MISSING",
        `Governed artefact '${item.path}' does not exist.`,
        { path: item.path }
      );
    }
    if (!fs.statSync(abs).isFile()) {
      fail(
        "FREEZE_GOVERNED_ARTEFACT_NOT_FILE",
        `Governed artefact '${item.path}' is not a file.`,
        { path: item.path }
      );
    }

    return {
      path: item.path,
      sha256: sha256File(abs)
    };
  });

  artefacts.sort((a, b) => a.path.localeCompare(b.path, "en"));
  const governed_surface_hash = sha256Text(
    canonicalJson({
      governed_artefacts: artefacts
    })
  );

  return {
    artefacts,
    governed_surface_hash
  };
}

function loadProofSetManifest(repoRoot, proofSetPath) {
  const abs = toRepoAbsolute(repoRoot, proofSetPath);
  if (!fs.existsSync(abs)) {
    fail(
      "FREEZE_PROOF_SET_MISSING",
      `Proof report set manifest '${proofSetPath}' does not exist.`,
      { path: proofSetPath }
    );
  }

  const manifest = readJson(abs);
  if (manifest?.schema_version !== "kolosseum.freeze.proof_report_set.v1") {
    fail(
      "FREEZE_PROOF_SET_SCHEMA_INVALID",
      "Proof report set manifest schema_version must be kolosseum.freeze.proof_report_set.v1.",
      { schema_version: manifest?.schema_version ?? null }
    );
  }

  ensureArray(
    manifest.proof_reports,
    "FREEZE_PROOF_SET_REPORTS_INVALID",
    "Proof report set manifest proof_reports must be an array."
  );

  const seenPaths = new Set();
  const reports = manifest.proof_reports.map((item, index) => {
    if (!item || typeof item !== "object") {
      fail(
        "FREEZE_PROOF_SET_ENTRY_INVALID",
        `Proof report entry at index ${index} must be an object.`,
        { index }
      );
    }

    if (typeof item.path !== "string" || item.path.length === 0) {
      fail(
        "FREEZE_PROOF_SET_PATH_INVALID",
        `Proof report entry at index ${index} must include a non-empty path.`,
        { index }
      );
    }

    if (seenPaths.has(item.path)) {
      fail(
        "FREEZE_PROOF_SET_DUPLICATE_PATH",
        `Duplicate proof report path '${item.path}'.`,
        { path: item.path }
      );
    }
    seenPaths.add(item.path);

    return {
      path: item.path,
      required: item.required !== false
    };
  });

  return reports;
}

function validateSingleProofReport(repoRoot, reportRef, currentSurface) {
  const abs = toRepoAbsolute(repoRoot, reportRef.path);
  if (!fs.existsSync(abs)) {
    return {
      ok: false,
      path: reportRef.path,
      failures: [
        {
          code: "FREEZE_PROOF_REPORT_MISSING",
          message: `Proof report '${reportRef.path}' does not exist.`
        }
      ]
    };
  }

  const report = readJson(abs);
  const failures = [];

  if (report?.schema_version !== "kolosseum.freeze.proof_report.v1") {
    failures.push({
      code: "FREEZE_PROOF_REPORT_SCHEMA_INVALID",
      message: "Proof report schema_version must be kolosseum.freeze.proof_report.v1."
    });
  }

  if (report?.ok !== true) {
    failures.push({
      code: "FREEZE_PROOF_REPORT_NOT_OK",
      message: "Proof report ok must be true."
    });
  }

  if (typeof report?.governed_surface_hash !== "string" || report.governed_surface_hash.length === 0) {
    failures.push({
      code: "FREEZE_PROOF_REPORT_MISSING_GOVERNED_SURFACE_HASH",
      message: "Proof report must include governed_surface_hash."
    });
  } else if (report.governed_surface_hash !== currentSurface.governed_surface_hash) {
    failures.push({
      code: "FREEZE_PROOF_REPORT_STALE_SURFACE_HASH",
      message: "Proof report governed_surface_hash does not match current governed surface hash.",
      expected: currentSurface.governed_surface_hash,
      actual: report.governed_surface_hash
    });
  }

  if (!Array.isArray(report?.covered_artefacts)) {
    failures.push({
      code: "FREEZE_PROOF_REPORT_COVERED_ARTEFACTS_INVALID",
      message: "Proof report covered_artefacts must be an array."
    });
  } else {
    const actualByPath = new Map();
    for (const item of report.covered_artefacts) {
      if (!item || typeof item !== "object" || typeof item.path !== "string" || typeof item.sha256 !== "string") {
        failures.push({
          code: "FREEZE_PROOF_REPORT_COVERED_ARTEFACT_ENTRY_INVALID",
          message: "Each covered_artefacts entry must contain string path and sha256."
        });
        continue;
      }
      actualByPath.set(item.path, item.sha256);
    }

    const expectedByPath = new Map(currentSurface.artefacts.map((item) => [item.path, item.sha256]));

    for (const [expectedPath, expectedHash] of expectedByPath.entries()) {
      if (!actualByPath.has(expectedPath)) {
        failures.push({
          code: "FREEZE_PROOF_REPORT_MISSING_ARTEFACT_BINDING",
          message: `Proof report does not bind governed artefact '${expectedPath}'.`,
          path: expectedPath
        });
        continue;
      }

      const actualHash = actualByPath.get(expectedPath);
      if (actualHash !== expectedHash) {
        failures.push({
          code: "FREEZE_PROOF_REPORT_STALE_ARTEFACT_HASH",
          message: `Proof report hash for '${expectedPath}' does not match current artefact hash.`,
          path: expectedPath,
          expected: expectedHash,
          actual: actualHash
        });
      }
    }

    for (const actualPath of actualByPath.keys()) {
      if (!expectedByPath.has(actualPath)) {
        failures.push({
          code: "FREEZE_PROOF_REPORT_OUT_OF_SCOPE_ARTEFACT",
          message: `Proof report binds artefact '${actualPath}' outside the governed freeze surface.`,
          path: actualPath
        });
      }
    }
  }

  return {
    ok: failures.length === 0,
    path: reportRef.path,
    failures
  };
}

export function verifyFreezeProofFreshness({
  repoRoot = process.cwd(),
  surfaceManifestPath = "docs/releases/V1_FREEZE_GOVERNED_ARTEFACT_SET.json",
  proofSetManifestPath = "docs/releases/V1_FREEZE_PROOF_REPORT_SET.json"
} = {}) {
  const currentSurface = buildGovernedSurface(repoRoot, readJson(toRepoAbsolute(repoRoot, surfaceManifestPath)));
  const reportRefs = loadProofSetManifest(repoRoot, proofSetManifestPath);

  if (reportRefs.length === 0) {
    fail(
      "FREEZE_PROOF_SET_EMPTY",
      "Proof report set manifest must declare at least one proof report."
    );
  }

  const checkedReports = reportRefs.map((reportRef) =>
    validateSingleProofReport(repoRoot, reportRef, currentSurface)
  );

  const staleReports = checkedReports.filter((item) => !item.ok);

  return {
    ok: staleReports.length === 0,
    schema_version: "kolosseum.freeze.proof_freshness_report.v1",
    governed_surface_hash: currentSurface.governed_surface_hash,
    governed_artefact_count: currentSurface.artefacts.length,
    checked_reports: checkedReports.map((item) => item.path),
    stale_reports: staleReports,
    missing_bindings: staleReports.flatMap((item) =>
      item.failures.filter((f) => f.code === "FREEZE_PROOF_REPORT_MISSING_ARTEFACT_BINDING")
    ),
    mismatched_hashes: staleReports.flatMap((item) =>
      item.failures.filter(
        (f) =>
          f.code === "FREEZE_PROOF_REPORT_STALE_SURFACE_HASH" ||
          f.code === "FREEZE_PROOF_REPORT_STALE_ARTEFACT_HASH"
      )
    )
  };
}

function main() {
  const surfaceManifestPath = process.argv[2] ?? "docs/releases/V1_FREEZE_GOVERNED_ARTEFACT_SET.json";
  const proofSetManifestPath = process.argv[3] ?? "docs/releases/V1_FREEZE_PROOF_REPORT_SET.json";
  const outputPath = process.argv[4] ?? null;

  let report;
  try {
    report = verifyFreezeProofFreshness({
      repoRoot: process.cwd(),
      surfaceManifestPath,
      proofSetManifestPath
    });
  } catch (error) {
    report = {
      ok: false,
      schema_version: "kolosseum.freeze.proof_freshness_report.v1",
      fatal_error: {
        code: error?.code ?? "FREEZE_PROOF_FRESHNESS_FATAL",
        message: error?.message ?? String(error),
        details: error?.details ?? {}
      }
    };
  }

  const json = `${JSON.stringify(report, null, 2)}\n`;

  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, json, "utf8");
  }

  process.stdout.write(json);
  process.exit(report.ok ? 0 : 1);
}

const entryHref = process.argv[1] ? new URL(`file://${path.resolve(process.argv[1])}`).href : null;
if (entryHref && import.meta.url === entryHref) {
  main();
}