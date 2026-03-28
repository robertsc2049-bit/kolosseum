import fs from "node:fs";
import path from "node:path";

const FAILURE = {
  INVALID_INDEX_STRUCTURE: "invalid_index_structure",
  MISSING_REFERENCE: "missing_reference",
  UNDECLARED_SURFACE_DETECTED: "undeclared_surface_detected",
  DUPLICATE_REFERENCE: "duplicate_reference",
  EVIDENCE_INCOMPLETE: "evidence_incomplete",
  INCOMPLETE_RELEASE_CONTROLS: "incomplete_release_controls",
};

const REQUIRED_SINGLETON_ROLES = [
  "index",
  "signoff",
  "checklist",
  "rollback",
  "promotion",
];

function normalizeRelativePath(value) {
  return String(value).replace(/\\/g, "/");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function walkFiles(rootDir) {
  const out = [];

  function visit(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (entry.isFile()) {
        out.push(absolute);
      }
    }
  }

  visit(rootDir);
  return out;
}

function createFailure(token, filePath, details) {
  return {
    token,
    path: normalizeRelativePath(filePath),
    details,
  };
}

function inferRoleFromPath(filePath) {
  const normalized = normalizeRelativePath(filePath).toLowerCase();
  const base = path.basename(normalized);

  if (base.includes("signoff")) return "signoff";
  if (base.includes("checklist")) return "checklist";
  if (base.includes("rollback")) return "rollback";
  if (base.includes("promotion")) return "promotion";
  if (base.includes("evidence")) return "evidence";
  if (base.includes("index")) return "index";

  return "supporting";
}

function normalizeRole(value, filePath) {
  if (isNonEmptyString(value)) {
    return String(value).trim().toLowerCase();
  }
  return inferRoleFromPath(filePath);
}

function extractArtefactPath(item) {
  if (typeof item === "string") {
    return item;
  }

  if (item && typeof item === "object") {
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
      if (isNonEmptyString(item[key])) {
        return item[key];
      }
    }
  }

  return null;
}

function extractArtefactRole(item, resolvedPath) {
  if (item && typeof item === "object") {
    const candidateKeys = [
      "role",
      "kind",
      "type",
      "surface",
      "surface_type",
      "surfaceType",
      "artefact_type",
      "artifact_type",
      "artefactType",
      "artifactType",
    ];

    for (const key of candidateKeys) {
      if (isNonEmptyString(item[key])) {
        return normalizeRole(item[key], resolvedPath);
      }
    }
  }

  return normalizeRole(null, resolvedPath);
}

function validateIndexShape(indexData, indexPathFromRoot) {
  const failures = [];

  if (indexData === null || typeof indexData !== "object" || Array.isArray(indexData)) {
    failures.push(
      createFailure(
        FAILURE.INVALID_INDEX_STRUCTURE,
        indexPathFromRoot,
        "Acceptance pack index must be a JSON object."
      )
    );
    return failures;
  }

  const expectedKeys = ["name", "artefacts"];
  const actualKeys = Object.keys(indexData).sort();

  const missingKeys = expectedKeys.filter((key) => !(key in indexData));
  const extraKeys = actualKeys.filter((key) => !expectedKeys.includes(key));

  for (const key of missingKeys) {
    failures.push(
      createFailure(
        FAILURE.INVALID_INDEX_STRUCTURE,
        indexPathFromRoot,
        `Missing required top-level key '${key}'.`
      )
    );
  }

  for (const key of extraKeys) {
    failures.push(
      createFailure(
        FAILURE.INVALID_INDEX_STRUCTURE,
        indexPathFromRoot,
        `Unknown top-level key '${key}'.`
      )
    );
  }

  if ("name" in indexData && !isNonEmptyString(indexData.name)) {
    failures.push(
      createFailure(
        FAILURE.INVALID_INDEX_STRUCTURE,
        indexPathFromRoot,
        "Key 'name' must be a non-empty string."
      )
    );
  }

  if (!("artefacts" in indexData) || !Array.isArray(indexData.artefacts)) {
    failures.push(
      createFailure(
        FAILURE.INVALID_INDEX_STRUCTURE,
        indexPathFromRoot,
        "Key 'artefacts' must be an array."
      )
    );
    return failures;
  }

  if (indexData.artefacts.length === 0) {
    failures.push(
      createFailure(
        FAILURE.INVALID_INDEX_STRUCTURE,
        indexPathFromRoot,
        "Key 'artefacts' must contain at least one declared surface."
      )
    );
  }

  indexData.artefacts.forEach((item, idx) => {
    const extractedPath = extractArtefactPath(item);
    if (!isNonEmptyString(extractedPath)) {
      failures.push(
        createFailure(
          FAILURE.INVALID_INDEX_STRUCTURE,
          indexPathFromRoot,
          `artefacts[${idx}] must declare a non-empty path.`
        )
      );
    }
  });

  return failures;
}

function resolveDeclaredPath(repoRoot, packDirAbs, rawPath) {
  const normalizedRaw = normalizeRelativePath(rawPath).replace(/^\.\/+/, "");

  const repoCandidateAbs = path.resolve(repoRoot, normalizedRaw);
  if (fs.existsSync(repoCandidateAbs)) {
    return {
      repoRelative: normalizeRelativePath(path.relative(repoRoot, repoCandidateAbs)),
      absolute: repoCandidateAbs,
    };
  }

  const packCandidateAbs = path.resolve(packDirAbs, normalizedRaw);
  if (fs.existsSync(packCandidateAbs)) {
    return {
      repoRelative: normalizeRelativePath(path.relative(repoRoot, packCandidateAbs)),
      absolute: packCandidateAbs,
    };
  }

  const repoRelative = normalizedRaw;
  return {
    repoRelative,
    absolute: path.resolve(repoRoot, repoRelative),
  };
}

function collectDeclaredReferences(repoRoot, packDirAbs, indexData) {
  return indexData.artefacts.map((item) => {
    const rawPath = extractArtefactPath(item);
    const role = extractArtefactRole(item, rawPath);
    const resolved = resolveDeclaredPath(repoRoot, packDirAbs, rawPath);

    return {
      role,
      raw: rawPath,
      repoRelative: resolved.repoRelative,
      absolute: resolved.absolute,
    };
  });
}

function verifyRequiredComposition(indexPathFromRoot, declaredReferences) {
  const failures = [];
  const grouped = new Map();

  for (const ref of declaredReferences) {
    const bucket = grouped.get(ref.role) ?? [];
    bucket.push(ref);
    grouped.set(ref.role, bucket);
  }

  for (const role of REQUIRED_SINGLETON_ROLES) {
    const count = (grouped.get(role) ?? []).length;
    if (count !== 1) {
      failures.push(
        createFailure(
          FAILURE.INVALID_INDEX_STRUCTURE,
          indexPathFromRoot,
          `Acceptance pack must declare exactly one '${role}' surface; found ${count}.`
        )
      );
    }
  }

  const evidenceCount = (grouped.get("evidence") ?? []).length;
  if (evidenceCount < 1) {
    failures.push(
      createFailure(
        FAILURE.EVIDENCE_INCOMPLETE,
        indexPathFromRoot,
        "Acceptance pack must declare at least one evidence surface."
      )
    );
  }

  const hasRollback = (grouped.get("rollback") ?? []).length > 0;
  const hasPromotion = (grouped.get("promotion") ?? []).length > 0;
  if (hasRollback !== hasPromotion) {
    failures.push(
      createFailure(
        FAILURE.INCOMPLETE_RELEASE_CONTROLS,
        indexPathFromRoot,
        "Rollback and promotion surfaces must both be declared together."
      )
    );
  }

  return failures;
}

function verifyAcceptancePackComposition(indexPathArg) {
  const repoRoot = process.cwd();
  const resolvedIndexPath = path.resolve(indexPathArg);
  const packDirAbs = path.dirname(resolvedIndexPath);
  const indexPathFromRoot = normalizeRelativePath(path.relative(repoRoot, resolvedIndexPath));

  const failures = [];
  const indexData = readJson(resolvedIndexPath);

  failures.push(...validateIndexShape(indexData, indexPathFromRoot));
  if (failures.length > 0) {
    return { ok: false, failures };
  }

  const declaredReferences = collectDeclaredReferences(repoRoot, packDirAbs, indexData);
  failures.push(...verifyRequiredComposition(indexPathFromRoot, declaredReferences));

  const seen = new Map();

  for (const ref of declaredReferences) {
    if (seen.has(ref.repoRelative)) {
      failures.push(
        createFailure(
          FAILURE.DUPLICATE_REFERENCE,
          ref.repoRelative,
          `Reference '${ref.repoRelative}' is declared more than once (${seen.get(ref.repoRelative)} and ${ref.role}).`
        )
      );
    } else {
      seen.set(ref.repoRelative, ref.role);
    }

    if (!fs.existsSync(ref.absolute) || !fs.statSync(ref.absolute).isFile()) {
      failures.push(
        createFailure(
          FAILURE.MISSING_REFERENCE,
          ref.repoRelative,
          `Declared ${ref.role} reference does not exist.`
        )
      );
    }
  }

  const declaredFileSet = new Set([
    indexPathFromRoot,
    ...declaredReferences.map((ref) => ref.repoRelative),
  ]);

  const actualFiles = walkFiles(packDirAbs)
    .map((absolute) => normalizeRelativePath(path.relative(repoRoot, absolute)))
    .sort();

  for (const actualFile of actualFiles) {
    if (!declaredFileSet.has(actualFile)) {
      failures.push(
        createFailure(
          FAILURE.UNDECLARED_SURFACE_DETECTED,
          actualFile,
          "Acceptance pack file exists on disk but is not declared by the acceptance pack index."
        )
      );
    }
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

function main() {
  const indexPathArg = process.argv[2] ?? "docs/releases/V1_ACCEPTANCE_ARTEFACT_SET.json";
  const report = verifyAcceptancePackComposition(indexPathArg);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.ok ? 0 : 1;
}

try {
  main();
} catch (error) {
  const report = {
    ok: false,
    failures: [
      {
        token: FAILURE.INVALID_INDEX_STRUCTURE,
        path: normalizeRelativePath(process.argv[2] ?? "docs/releases/V1_ACCEPTANCE_ARTEFACT_SET.json"),
        details: error instanceof Error ? error.message : String(error),
      },
    ],
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}