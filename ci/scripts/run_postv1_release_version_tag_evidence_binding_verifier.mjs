import fs from "node:fs";
import path from "node:path";

const FAILURE = {
  VERSION_TAG_UNPARSEABLE_SOURCE: "version_tag_unparseable_source",
  VERSION_TAG_MISSING_DECLARED_SURFACE: "version_tag_missing_declared_surface",
  VERSION_TAG_MISSING_BINDING_REFERENCE: "version_tag_missing_binding_reference",
  VERSION_TAG_DRIFT_DETECTED: "version_tag_drift_detected",
};

const REQUIRED_ACCEPTANCE_SURFACES = [
  "docs/releases/V1_ACCEPTANCE_ARTEFACT_SET.json",
  "docs/releases/V1_ACCEPTANCE_PACK_INDEX.md",
  "docs/releases/V1_ACCEPTANCE_SIGNOFF.md",
  "docs/releases/V1_RELEASE_CHECKLIST.md",
];

const REQUIRED_EVIDENCE_SURFACES = [
  "docs/releases/V1_MAINLINE_GREEN_RUN_EVIDENCE.md",
  "docs/releases/V1_PACKAGING_EVIDENCE_MANIFEST.json",
  "docs/releases/V1_EVIDENCE_SURFACE_REGISTRY.json",
];

function normalizeRelativePath(value) {
  return String(value).replace(/\\/g, "/");
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readUtf8(filePath));
}

function createFailure(token, filePath, details) {
  return {
    token,
    path: normalizeRelativePath(filePath),
    details,
  };
}

function inferRoleFromPath(filePath) {
  const base = path.basename(String(filePath)).toLowerCase();

  if (base.includes("signoff")) return "signoff";
  if (base.includes("checklist")) return "checklist";
  if (base.includes("rollback")) return "rollback";
  if (base.includes("promotion")) return "promotion";
  if (base.includes("evidence")) return "evidence";
  if (base.includes("index")) return "index";

  return "supporting";
}

function normalizeRole(value, filePath) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim().toLowerCase();
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
      if (typeof item[key] === "string" && item[key].trim().length > 0) {
        return item[key];
      }
    }
  }

  return null;
}

function extractArtefactRole(item, rawPath) {
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
      if (typeof item[key] === "string" && item[key].trim().length > 0) {
        return normalizeRole(item[key], rawPath);
      }
    }
  }

  return normalizeRole(null, rawPath);
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

  return {
    repoRelative: normalizedRaw,
    absolute: path.resolve(repoRoot, normalizedRaw),
  };
}

function loadAcceptanceArtefactSet(repoRoot, acceptanceSetPath) {
  const resolvedSetPath = path.resolve(repoRoot, acceptanceSetPath);
  const packDirAbs = path.dirname(resolvedSetPath);
  const setJson = readJson(resolvedSetPath);

  if (!setJson || typeof setJson !== "object" || Array.isArray(setJson)) {
    throw new Error("Acceptance artefact set must be a JSON object.");
  }
  if (!Array.isArray(setJson.artefacts)) {
    throw new Error("Acceptance artefact set must contain an artefacts array.");
  }

  return setJson.artefacts.map((item) => {
    const rawPath = extractArtefactPath(item);
    if (!rawPath) {
      throw new Error("Acceptance artefact set contains an artefact without a usable path.");
    }

    const resolved = resolveDeclaredPath(repoRoot, packDirAbs, rawPath);
    const role = extractArtefactRole(item, rawPath);

    return {
      role,
      repoRelative: resolved.repoRelative,
      absolute: resolved.absolute,
    };
  });
}

function parseVersionTagDoc(text) {
  const versionMatch = text.match(/^\s*Version:\s*(.+)\s*$/im);
  const tagMatch = text.match(/^\s*Tag:\s*(.+)\s*$/im);

  return {
    version: versionMatch ? versionMatch[1].trim() : null,
    tag: tagMatch ? tagMatch[1].trim() : null,
  };
}

function verifyReleaseVersionTagBinding({
  repoRoot,
  versionTagPath,
  acceptanceSetPath,
}) {
  const failures = [];
  const versionTagAbs = path.resolve(repoRoot, versionTagPath);
  const versionTagRepoRelative = normalizeRelativePath(path.relative(repoRoot, versionTagAbs));

  let versionTagText = "";
  let acceptanceRefs = [];

  try {
    versionTagText = readUtf8(versionTagAbs);
  } catch (error) {
    return {
      ok: false,
      failures: [
        createFailure(
          FAILURE.VERSION_TAG_UNPARSEABLE_SOURCE,
          versionTagRepoRelative,
          error instanceof Error ? error.message : String(error)
        ),
      ],
    };
  }

  try {
    acceptanceRefs = loadAcceptanceArtefactSet(repoRoot, acceptanceSetPath);
  } catch (error) {
    return {
      ok: false,
      failures: [
        createFailure(
          FAILURE.VERSION_TAG_UNPARSEABLE_SOURCE,
          normalizeRelativePath(acceptanceSetPath),
          error instanceof Error ? error.message : String(error)
        ),
      ],
    };
  }

  const declaredSet = new Set(acceptanceRefs.map((ref) => ref.repoRelative));
  const parsed = parseVersionTagDoc(versionTagText);

  if (!parsed.version) {
    failures.push(
      createFailure(
        FAILURE.VERSION_TAG_UNPARSEABLE_SOURCE,
        versionTagRepoRelative,
        "Version/tag artefact must declare a 'Version:' line."
      )
    );
  }

  if (!parsed.tag) {
    failures.push(
      createFailure(
        FAILURE.VERSION_TAG_UNPARSEABLE_SOURCE,
        versionTagRepoRelative,
        "Version/tag artefact must declare a 'Tag:' line."
      )
    );
  }

  if (!declaredSet.has(versionTagRepoRelative)) {
    failures.push(
      createFailure(
        FAILURE.VERSION_TAG_MISSING_DECLARED_SURFACE,
        normalizeRelativePath(acceptanceSetPath),
        `Acceptance artefact set must declare '${versionTagRepoRelative}'.`
      )
    );
  }

  const acceptanceReferences = [
    /V1_ACCEPTANCE_ARTEFACT_SET\.json/i,
    /V1_ACCEPTANCE_PACK_INDEX\.md/i,
    /\bacceptance pack\b/i,
    /\bsignoff\b/i,
    /\bchecklist\b/i,
  ];

  const evidenceReferences = [
    /V1_MAINLINE_GREEN_RUN_EVIDENCE\.md/i,
    /V1_PACKAGING_EVIDENCE_MANIFEST\.json/i,
    /V1_EVIDENCE_SURFACE_REGISTRY\.json/i,
    /\bevidence\b/i,
  ];

  const hasAcceptanceBinding = acceptanceReferences.some((pattern) => pattern.test(versionTagText));
  const hasEvidenceBinding = evidenceReferences.some((pattern) => pattern.test(versionTagText));

  if (!hasAcceptanceBinding) {
    failures.push(
      createFailure(
        FAILURE.VERSION_TAG_MISSING_BINDING_REFERENCE,
        versionTagRepoRelative,
        "Version/tag artefact must reference accepted release surfaces."
      )
    );
  }

  if (!hasEvidenceBinding) {
    failures.push(
      createFailure(
        FAILURE.VERSION_TAG_MISSING_BINDING_REFERENCE,
        versionTagRepoRelative,
        "Version/tag artefact must reference release evidence surfaces."
      )
    );
  }

  const missingAcceptanceSurface = REQUIRED_ACCEPTANCE_SURFACES.find((surface) => !declaredSet.has(surface));
  if (missingAcceptanceSurface) {
    failures.push(
      createFailure(
        FAILURE.VERSION_TAG_DRIFT_DETECTED,
        normalizeRelativePath(acceptanceSetPath),
        `Version/tag binding requires declared acceptance surface '${missingAcceptanceSurface}'.`
      )
    );
  }

  const missingEvidenceSurface = REQUIRED_EVIDENCE_SURFACES.find((surface) => !declaredSet.has(surface));
  if (missingEvidenceSurface) {
    failures.push(
      createFailure(
        FAILURE.VERSION_TAG_DRIFT_DETECTED,
        normalizeRelativePath(acceptanceSetPath),
        `Version/tag binding requires declared evidence surface '${missingEvidenceSurface}'.`
      )
    );
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

function main() {
  const repoRoot = process.cwd();
  const versionTagPath = process.argv[2] ?? "docs/releases/V1_VERSION_AND_TAG.md";
  const acceptanceSetPath = process.argv[3] ?? "docs/releases/V1_ACCEPTANCE_ARTEFACT_SET.json";

  const report = verifyReleaseVersionTagBinding({
    repoRoot,
    versionTagPath,
    acceptanceSetPath,
  });

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
        token: FAILURE.VERSION_TAG_UNPARSEABLE_SOURCE,
        path: normalizeRelativePath(process.argv[2] ?? "docs/releases/V1_VERSION_AND_TAG.md"),
        details: error instanceof Error ? error.message : String(error),
      },
    ],
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}