import fs from "node:fs";
import path from "node:path";

const FAILURE = {
  RELEASE_NOTE_CLAIM_OVERREACH: "release_note_claim_overreach",
  RELEASE_NOTE_UNSUPPORTED_CLAIM: "release_note_unsupported_claim",
  RELEASE_NOTE_FORBIDDEN_PHRASE: "release_note_forbidden_phrase",
  RELEASE_NOTE_MISSING_DECLARED_SURFACE: "release_note_missing_declared_surface",
  RELEASE_NOTE_UNPARSEABLE_SOURCE: "release_note_unparseable_source",
};

const FORBIDDEN_PATTERNS = [
  /\bfully proven\b/i,
  /\bproof complete\b/i,
  /\bcomplete proof\b/i,
  /\bcomprehensive proof\b/i,
  /\bfully verified\b/i,
  /\bvalidated end[\s-]?to[\s-]?end\b/i,
  /\bproduction ready\b/i,
  /\brelease certified\b/i,
  /\bguarantees correctness\b/i,
  /\bguarantees safety\b/i,
  /\bno remaining risk\b/i,
  /\ball scenarios covered\b/i,
  /\bfully production[-\s]?ready\b/i,
];

const SURFACE_REQUIREMENTS = [
  {
    role: "acceptance_pack",
    patterns: [/\bacceptance pack\b/i],
    failureToken: FAILURE.RELEASE_NOTE_MISSING_DECLARED_SURFACE,
    details: "Release note mentions acceptance pack but the acceptance-pack index surface is not declared.",
  },
  {
    role: "signoff",
    patterns: [/\bsignoff\b/i, /\bsigned off\b/i],
    failureToken: FAILURE.RELEASE_NOTE_MISSING_DECLARED_SURFACE,
    details: "Release note mentions signoff but no signoff surface is declared.",
  },
  {
    role: "checklist",
    patterns: [/\bchecklist\b/i],
    failureToken: FAILURE.RELEASE_NOTE_MISSING_DECLARED_SURFACE,
    details: "Release note mentions checklist but no checklist surface is declared.",
  },
  {
    role: "evidence",
    patterns: [/\bevidence\b/i, /\bevidenced\b/i],
    failureToken: FAILURE.RELEASE_NOTE_MISSING_DECLARED_SURFACE,
    details: "Release note mentions evidence but no evidence surface is declared.",
  },
  {
    role: "rollback",
    patterns: [/\brollback\b/i, /\broll back\b/i],
    failureToken: FAILURE.RELEASE_NOTE_MISSING_DECLARED_SURFACE,
    details: "Release note mentions rollback but no rollback surface is declared.",
  },
  {
    role: "promotion",
    patterns: [/\bpromotion\b/i, /\bpromote\b/i],
    failureToken: FAILURE.RELEASE_NOTE_MISSING_DECLARED_SURFACE,
    details: "Release note mentions promotion but no promotion surface is declared.",
  },
];

const OVERREACH_RULES = [
  {
    pattern: /\bproven\b/i,
    supportedRoles: ["evidence"],
    details: "Release notes may use proof language only when declared evidence surfaces exist.",
  },
  {
    pattern: /\bverified\b/i,
    supportedRoles: ["evidence"],
    details: "Release notes may use verification language only when declared evidence surfaces exist.",
  },
  {
    pattern: /\bvalidated\b/i,
    supportedRoles: ["evidence"],
    details: "Release notes may use validation language only when declared evidence surfaces exist.",
  },
  {
    pattern: /\baccepted\b/i,
    supportedRoles: ["acceptance_pack", "signoff", "checklist"],
    details: "Release notes may use acceptance language only when declared acceptance surfaces exist.",
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

  const refs = setJson.artefacts.map((item) => {
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

  const roleCounts = new Map();
  for (const ref of refs) {
    const current = roleCounts.get(ref.role) ?? 0;
    roleCounts.set(ref.role, current + 1);
  }

  return {
    refs,
    roleCounts,
    acceptanceSetRepoRelative: normalizeRelativePath(path.relative(repoRoot, resolvedSetPath)),
  };
}

function hasSupport(roleCounts, supportRole) {
  if (supportRole === "acceptance_pack") {
    return (roleCounts.get("index") ?? 0) > 0;
  }
  return (roleCounts.get(supportRole) ?? 0) > 0;
}

function verifyReleaseNoteClaimBoundary({
  repoRoot,
  releaseNotesPath,
  acceptanceSetPath,
}) {
  const failures = [];
  const releaseNotesAbs = path.resolve(repoRoot, releaseNotesPath);
  const releaseNotesRepoRelative = normalizeRelativePath(path.relative(repoRoot, releaseNotesAbs));

  let releaseNotesText = "";
  let artefactState;

  try {
    releaseNotesText = readUtf8(releaseNotesAbs);
  } catch (error) {
    return {
      ok: false,
      failures: [
        createFailure(
          FAILURE.RELEASE_NOTE_UNPARSEABLE_SOURCE,
          releaseNotesRepoRelative,
          error instanceof Error ? error.message : String(error)
        ),
      ],
    };
  }

  try {
    artefactState = loadAcceptanceArtefactSet(repoRoot, acceptanceSetPath);
  } catch (error) {
    return {
      ok: false,
      failures: [
        createFailure(
          FAILURE.RELEASE_NOTE_UNPARSEABLE_SOURCE,
          normalizeRelativePath(acceptanceSetPath),
          error instanceof Error ? error.message : String(error)
        ),
      ],
    };
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(releaseNotesText)) {
      failures.push(
        createFailure(
          FAILURE.RELEASE_NOTE_FORBIDDEN_PHRASE,
          releaseNotesRepoRelative,
          `Forbidden release-note phrase matched pattern '${pattern}'.`
        )
      );
    }
  }

  for (const requirement of SURFACE_REQUIREMENTS) {
    const mentioned = requirement.patterns.some((pattern) => pattern.test(releaseNotesText));
    if (!mentioned) {
      continue;
    }

    if (!hasSupport(artefactState.roleCounts, requirement.role)) {
      failures.push(
        createFailure(
          requirement.failureToken,
          releaseNotesRepoRelative,
          requirement.details
        )
      );
    }
  }

  for (const rule of OVERREACH_RULES) {
    if (!rule.pattern.test(releaseNotesText)) {
      continue;
    }

    const supported = rule.supportedRoles.some((role) => hasSupport(artefactState.roleCounts, role));
    if (!supported) {
      failures.push(
        createFailure(
          FAILURE.RELEASE_NOTE_UNSUPPORTED_CLAIM,
          releaseNotesRepoRelative,
          rule.details
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
  const repoRoot = process.cwd();
  const releaseNotesPath = process.argv[2] ?? "docs/releases/V1_RELEASE_NOTES.md";
  const acceptanceSetPath = process.argv[3] ?? "docs/releases/V1_ACCEPTANCE_ARTEFACT_SET.json";

  const report = verifyReleaseNoteClaimBoundary({
    repoRoot,
    releaseNotesPath,
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
        token: FAILURE.RELEASE_NOTE_UNPARSEABLE_SOURCE,
        path: normalizeRelativePath(process.argv[2] ?? "docs/releases/V1_RELEASE_NOTES.md"),
        details: error instanceof Error ? error.message : String(error),
      },
    ],
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = 1;
}