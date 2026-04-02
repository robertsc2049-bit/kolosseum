import fs from "node:fs";
import path from "node:path";

const TOKEN = "CI_RELEASE_NOTES_SEAL_SCOPE_VIOLATION";

function fail(details, pathValue = undefined) {
  return {
    ok: false,
    failures: [
      {
        token: TOKEN,
        ...(pathValue ? { path: pathValue } : {}),
        details,
      },
    ],
  };
}

function ok() {
  return { ok: true };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { __read_error__: `Failed to parse JSON at ${filePath}: ${message}` };
  }
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asStringSet(value) {
  return new Set(asArray(value).map((item) => String(item).trim()).filter(Boolean));
}

function collectClaims(noteText) {
  const text = noteText.toLowerCase();
  const claims = new Set();

  const claimChecks = [
    {
      key: "claims_evidence_sealed",
      patterns: [
        /\bevidence sealed\b/,
        /\bsealed evidence\b/,
        /\bevidence envelope(?:s)? sealed\b/,
        /\bevidence sealing (?:is )?(?:complete|done|active|enabled)\b/,
      ],
    },
    {
      key: "claims_proof_complete",
      patterns: [
        /\bproof[- ]complete\b/,
        /\bproof complete\b/,
        /\bfirst lawful run\b/,
        /\bfull lawful proof\b/,
      ],
    },
    {
      key: "claims_export_ready",
      patterns: [
        /\bexport ready\b/,
        /\bexportable\b/,
        /\bexports? enabled\b/,
        /\bportable evidence\b/,
      ],
    },
    {
      key: "claims_phase7_live",
      patterns: [
        /\bphase 7\b/,
        /\btruth projection\b/,
      ],
    },
    {
      key: "claims_phase8_live",
      patterns: [
        /\bphase 8\b/,
        /\bevidence envelope\b/,
        /\bevidence sealing\b/,
      ],
    },
    {
      key: "claims_replay_full_scope",
      patterns: [
        /\bfull replay proof\b/,
        /\breplay proves all phases\b/,
        /\breplay proves complete execution\b/,
        /\bproof across phases 1-8\b/,
        /\bproof across all phases\b/,
      ],
    },
  ];

  for (const claimCheck of claimChecks) {
    if (claimCheck.patterns.some((pattern) => pattern.test(text))) {
      claims.add(claimCheck.key);
    }
  }

  return claims;
}

function verifyReleaseNotesBoundary({ sealStatePath, sealedSurfaceManifestPath, releaseNotesPath }) {
  const sealState = readJson(sealStatePath);
  if (sealState.__read_error__) {
    return fail(sealState.__read_error__, "seal_state");
  }

  const sealedSurfaceManifest = readJson(sealedSurfaceManifestPath);
  if (sealedSurfaceManifest.__read_error__) {
    return fail(sealedSurfaceManifest.__read_error__, "sealed_surface_manifest");
  }

  const releaseNotesText = normalizeText(fs.readFileSync(releaseNotesPath, "utf8"));

  const activeSealState = String(
    sealState.active_seal_state ??
    sealState.seal_state ??
    sealState.pre_seal_state ??
    ""
  ).trim().toLowerCase();

  if (!activeSealState) {
    return fail("Seal state missing required active state field.", "seal_state.active_seal_state");
  }

  if (!["pre_seal", "sealed"].includes(activeSealState)) {
    return fail(
      `Unsupported active seal state '${activeSealState}'. Expected 'pre_seal' or 'sealed'.`,
      "seal_state.active_seal_state"
    );
  }

  const sealedSurfaces = asStringSet(
    sealedSurfaceManifest.sealed_surfaces ??
    sealedSurfaceManifest.freeze_surfaces ??
    sealedSurfaceManifest.surface_ids
  );

  if (sealedSurfaces.size === 0) {
    return fail(
      "Sealed surface manifest must declare at least one sealed surface.",
      "sealed_surface_manifest.sealed_surfaces"
    );
  }

  const allowedClaims = asStringSet(sealedSurfaceManifest.allowed_note_claims);
  const activeReplayScope = String(sealedSurfaceManifest.replay_scope ?? "").trim().toLowerCase();

  const claims = collectClaims(releaseNotesText);

  const surfaceLinePattern = /^\s*surface:\s*([A-Za-z0-9._/-]+)\s*$/gim;
  for (const match of releaseNotesText.matchAll(surfaceLinePattern)) {
    const surfaceId = String(match[1]).trim();
    if (!sealedSurfaces.has(surfaceId)) {
      return fail(
        `Release notes reference unsealed surface '${surfaceId}'.`,
        "release_notes"
      );
    }
  }

  if (activeSealState === "pre_seal") {
    const forbiddenPreSealClaims = [
      "claims_evidence_sealed",
      "claims_proof_complete",
      "claims_export_ready",
      "claims_phase7_live",
      "claims_phase8_live",
    ];

    for (const claim of forbiddenPreSealClaims) {
      if (claims.has(claim)) {
        return fail(
          `Release notes claim '${claim}' is illegal while active seal state is pre_seal.`,
          "release_notes"
        );
      }
    }
  }

  if (!allowedClaims.has("claims_replay_full_scope") && claims.has("claims_replay_full_scope")) {
    return fail(
      "Release notes claim broader replay proof than the declared lawful replay scope.",
      "release_notes"
    );
  }

  if (activeReplayScope === "phase2_and_phase6_only" && claims.has("claims_replay_full_scope")) {
    return fail(
      "Release notes claim full replay proof while manifest limits replay scope to phase2_and_phase6_only.",
      "release_notes"
    );
  }

  if (!sealedSurfaces.has("phase7_truth_projection") && claims.has("claims_phase7_live")) {
    return fail(
      "Release notes reference Phase 7 / truth projection outside the active sealed surface set.",
      "release_notes"
    );
  }

  if (!sealedSurfaces.has("phase8_evidence_sealing") && (claims.has("claims_phase8_live") || claims.has("claims_evidence_sealed"))) {
    return fail(
      "Release notes reference Phase 8 / evidence sealing outside the active sealed surface set.",
      "release_notes"
    );
  }

  return ok();
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    process.stderr.write(
      JSON.stringify(
        fail(
          "Usage: node ci/scripts/run_freeze_notes_seal_surface_binding_verifier.mjs <seal_state.json> <sealed_surface_manifest.json> <release_notes.txt>"
        ),
        null,
        2
      ) + "\n"
    );
    process.exit(1);
  }

  const [sealStatePath, sealedSurfaceManifestPath, releaseNotesPath] = args.map((value) => path.resolve(value));
  const result = verifyReleaseNotesBoundary({
    sealStatePath,
    sealedSurfaceManifestPath,
    releaseNotesPath,
  });

  const target = result.ok ? process.stdout : process.stderr;
  target.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { verifyReleaseNotesBoundary };