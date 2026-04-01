import fs from "node:fs";
import path from "node:path";

function fail(message, details = {}) {
  const payload = { ok: false, message, ...details };
  process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    manifest: "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--root") {
      i += 1;
      args.root = argv[i];
      continue;
    }
    if (token === "--manifest") {
      i += 1;
      args.manifest = argv[i];
      continue;
    }
    fail("unknown_argument", { argument: token });
  }

  return args;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function listFreezeJsonFiles(releasesDir) {
  if (!fs.existsSync(releasesDir)) {
    return [];
  }

  return fs
    .readdirSync(releasesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^V1_FREEZE_.*\.json$/i.test(name))
    .map((name) => path.posix.join("docs/releases", name))
    .sort();
}

function main() {
  const args = parseArgs(process.argv);
  const root = path.resolve(args.root);
  const manifestPath = path.resolve(root, args.manifest);

  if (!fs.existsSync(manifestPath)) {
    fail("missing_manifest", {
      manifest_path: path.relative(root, manifestPath).replace(/\\/g, "/"),
    });
  }

  const manifest = readJson(manifestPath);

  if (manifest.schema_version !== "kolosseum.release.freeze_evidence_manifest.v1") {
    fail("invalid_schema_version", {
      expected: "kolosseum.release.freeze_evidence_manifest.v1",
      actual: manifest.schema_version ?? null,
    });
  }

  if (!Array.isArray(manifest.artefacts) || manifest.artefacts.length === 0) {
    fail("manifest_artefacts_missing", {
      manifest_path: path.relative(root, manifestPath).replace(/\\/g, "/"),
    });
  }

  const evidenceIds = new Set();
  const evidencePaths = new Set();
  const results = [];

  for (const artefact of manifest.artefacts) {
    const evidenceId = artefact?.evidence_id;
    const relativePath = artefact?.path;
    const contentType = artefact?.content_type;
    const required = artefact?.required === true;

    if (typeof evidenceId !== "string" || evidenceId.length === 0) {
      fail("invalid_evidence_id", { artefact });
    }
    if (typeof relativePath !== "string" || relativePath.length === 0) {
      fail("invalid_evidence_path", { artefact });
    }
    if (evidenceIds.has(evidenceId)) {
      fail("duplicate_evidence_id", { evidence_id: evidenceId });
    }
    if (evidencePaths.has(relativePath)) {
      fail("duplicate_evidence_path", { path: relativePath });
    }

    evidenceIds.add(evidenceId);
    evidencePaths.add(relativePath);

    const absolutePath = path.resolve(root, relativePath);
    if (required && !fs.existsSync(absolutePath)) {
      fail("missing_required_evidence", {
        evidence_id: evidenceId,
        path: relativePath,
      });
    }

    if (contentType === "json") {
      try {
        const parsed = readJson(absolutePath);
        if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
          fail("invalid_json_evidence_shape", {
            evidence_id: evidenceId,
            path: relativePath,
          });
        }
      } catch (error) {
        fail("invalid_json_evidence", {
          evidence_id: evidenceId,
          path: relativePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    results.push({
      evidence_id: evidenceId,
      path: relativePath,
      content_type: contentType,
      required,
      ok: true,
    });
  }

  const releasesDir = path.resolve(root, "docs/releases");
  const discovered = listFreezeJsonFiles(releasesDir);
  const excluded = new Set(
    Array.isArray(manifest.discovery?.exclude_paths)
      ? manifest.discovery.exclude_paths
      : []
  );

  const undeclared = discovered.filter(
    (relativePath) =>
      !excluded.has(relativePath) &&
      !evidencePaths.has(relativePath)
  );

  if (undeclared.length > 0) {
    fail("undeclared_freeze_evidence", {
      undeclared_paths: undeclared,
    });
  }

  const payload = {
    ok: true,
    manifest_path: path.relative(root, manifestPath).replace(/\\/g, "/"),
    evidence_count: results.length,
    evidence: results,
  };

  process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
}

main();