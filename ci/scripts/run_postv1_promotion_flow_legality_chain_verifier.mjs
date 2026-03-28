import fs from "node:fs";
import path from "node:path";

const FAILURE = {
  PROMOTION_FLOW_MISSING_DECLARED_PRECONDITION: "promotion_flow_missing_declared_precondition",
  PROMOTION_FLOW_MISSING_CHAIN_STEP: "promotion_flow_missing_chain_step",
  PROMOTION_FLOW_ILLEGAL_BYPASS: "promotion_flow_illegal_bypass",
  PROMOTION_FLOW_UNPARSEABLE_SOURCE: "promotion_flow_unparseable_source",
};

const REQUIRED_CHAIN_STEPS = [
  {
    key: "packaging",
    pattern: /\bpackaging\b/i,
    declared: [
      "docs/releases/V1_PACKAGING_EVIDENCE_MANIFEST.json",
      "ci/scripts/run_postv1_packaging_evidence_manifest_verifier.mjs",
      "docs/releases/V1_PACKAGING_SURFACE_REGISTRY.json",
    ],
  },
  {
    key: "evidence",
    pattern: /\bevidence\b/i,
    declared: [
      "docs/releases/V1_EVIDENCE_SURFACE_REGISTRY.json",
      "docs/releases/V1_MAINLINE_GREEN_RUN_EVIDENCE.md",
      "ci/scripts/run_postv1_evidence_surface_verifier.mjs",
      "ci/scripts/run_postv1_packaging_evidence_manifest_verifier.mjs",
    ],
  },
  {
    key: "acceptance",
    pattern: /\bacceptance\b/i,
    declared: [
      "docs/releases/V1_ACCEPTANCE_ARTEFACT_SET.json",
      "docs/releases/V1_ACCEPTANCE_PACK_INDEX.md",
      "docs/releases/V1_ACCEPTANCE_SIGNOFF.md",
      "docs/releases/V1_RELEASE_CHECKLIST.md",
      "ci/scripts/run_postv1_acceptance_pack_composition_verifier.mjs",
    ],
  },
  {
    key: "merge_readiness",
    pattern: /\bmerge readiness\b/i,
    declared: [
      "ci/scripts/run_postv1_merge_readiness_verifier.mjs",
    ],
  },
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

function verifyPromotionFlowLegality({
  repoRoot,
  promotionFlowPath,
  acceptanceSetPath,
}) {
  const failures = [];
  const promotionFlowAbs = path.resolve(repoRoot, promotionFlowPath);
  const promotionFlowRepoRelative = normalizeRelativePath(path.relative(repoRoot, promotionFlowAbs));

  let promotionFlowText = "";
  let acceptanceRefs = [];

  try {
    promotionFlowText = readUtf8(promotionFlowAbs);
  } catch (error) {
    return {
      ok: false,
      failures: [
        createFailure(
          FAILURE.PROMOTION_FLOW_UNPARSEABLE_SOURCE,
          promotionFlowRepoRelative,
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
          FAILURE.PROMOTION_FLOW_UNPARSEABLE_SOURCE,
          normalizeRelativePath(acceptanceSetPath),
          error instanceof Error ? error.message : String(error)
        ),
      ],
    };
  }

  const declaredSet = new Set(acceptanceRefs.map((ref) => ref.repoRelative));
  const stepPositions = [];

  for (const step of REQUIRED_CHAIN_STEPS) {
    const match = promotionFlowText.match(step.pattern);

    if (!match || match.index === undefined) {
      failures.push(
        createFailure(
          FAILURE.PROMOTION_FLOW_MISSING_CHAIN_STEP,
          promotionFlowRepoRelative,
          `Promotion flow must reference '${step.key}'.`
        )
      );
      continue;
    }

    stepPositions.push({ key: step.key, index: match.index });

    const declaredOk = step.declared.some((requiredPath) => declaredSet.has(normalizeRelativePath(requiredPath)));
    if (!declaredOk) {
      failures.push(
        createFailure(
          FAILURE.PROMOTION_FLOW_MISSING_DECLARED_PRECONDITION,
          normalizeRelativePath(acceptanceSetPath),
          `Promotion flow references '${step.key}' but no legal declared precondition surface for that step is present.`
        )
      );
    }
  }

  if (stepPositions.length === REQUIRED_CHAIN_STEPS.length) {
    for (let i = 1; i < stepPositions.length; i++) {
      if (stepPositions[i - 1].index > stepPositions[i].index) {
        failures.push(
          createFailure(
            FAILURE.PROMOTION_FLOW_ILLEGAL_BYPASS,
            promotionFlowRepoRelative,
            `Promotion flow references '${stepPositions[i].key}' before '${stepPositions[i - 1].key}', which implies an illegal bypass.`
          )
        );
        break;
      }
    }
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

function main() {
  const repoRoot = process.cwd();
  const promotionFlowPath = process.argv[2] ?? "docs/releases/V1_PROMOTION_FLOW.md";
  const acceptanceSetPath = process.argv[3] ?? "docs/releases/V1_ACCEPTANCE_ARTEFACT_SET.json";

  const report = verifyPromotionFlowLegality({
    repoRoot,
    promotionFlowPath,
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
        token: FAILURE.PROMOTION_FLOW_UNPARSEABLE_SOURCE,
        path: normalizeRelativePath(process.argv[2] ?? "docs/releases/V1_PROMOTION_FLOW.md"),
        details: error instanceof Error ? error.message : String(error),
      },
    ],
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}