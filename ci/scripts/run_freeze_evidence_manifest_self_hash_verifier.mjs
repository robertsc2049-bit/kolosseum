#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    manifestPath: "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    reportPath: "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST_SELF_HASH.json",
    writeReport: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--manifest") {
      args.manifestPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--report") {
      args.reportPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--no-write-report") {
      args.writeReport = false;
      continue;
    }
  }

  return args;
}

function normalizeRel(input) {
  return input.replace(/\\/g, "/").trim();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256Bytes(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function sha256File(filePath) {
  return sha256Bytes(fs.readFileSync(filePath));
}

function buildFailure(token, file, details, extra = {}) {
  return { token, file, details, ...extra };
}

function stable(value) {
  if (Array.isArray(value)) {
    return value.map(stable);
  }

  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = stable(value[key]);
    }
    return out;
  }

  return value;
}

function computeManifestSelfHash(manifest) {
  const cloned = structuredClone(manifest);
  delete cloned.manifest_self_hash;
  const canonical = JSON.stringify(stable(cloned));
  return sha256Bytes(Buffer.from(canonical, "utf8"));
}

function writeReport(root, reportPath, report) {
  const absolute = path.join(root, reportPath);
  ensureDir(path.dirname(absolute));
  fs.writeFileSync(absolute, JSON.stringify(report, null, 2) + "\n", "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestAbs = path.join(args.root, args.manifestPath);
  const failures = [];

  if (!fs.existsSync(manifestAbs)) {
    failures.push(buildFailure("CI_SPINE_MISSING_DOC", normalizeRel(args.manifestPath), "Freeze evidence manifest missing."));
  }

  let manifest = null;
  let recomputedManifestSelfHash = null;

  if (failures.length === 0) {
    manifest = readJson(manifestAbs);

    if (!manifest || typeof manifest !== "object") {
      failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", normalizeRel(args.manifestPath), "Freeze evidence manifest must be a JSON object."));
    } else {
      if (typeof manifest.manifest_self_hash !== "string" || !/^[a-f0-9]{64}$/i.test(manifest.manifest_self_hash.trim())) {
        failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", normalizeRel(args.manifestPath), "Freeze evidence manifest must contain manifest_self_hash as a 64-char sha256 hex string."));
      }

      if (!Array.isArray(manifest.governed_artefacts)) {
        failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", normalizeRel(args.manifestPath), "Freeze evidence manifest must contain governed_artefacts array."));
      }

      recomputedManifestSelfHash = computeManifestSelfHash(manifest);

      if (typeof manifest.manifest_self_hash === "string" && /^[a-f0-9]{64}$/i.test(manifest.manifest_self_hash.trim())) {
        const embedded = manifest.manifest_self_hash.trim().toLowerCase();
        if (embedded !== recomputedManifestSelfHash) {
          failures.push(buildFailure(
            "CI_MANIFEST_MISMATCH",
            normalizeRel(args.manifestPath),
            "Freeze evidence manifest self hash does not match canonical recompute.",
            {
              expected_manifest_self_hash: recomputedManifestSelfHash,
              actual_manifest_self_hash: embedded
            }
          ));
        }
      }

      if (Array.isArray(manifest.governed_artefacts)) {
        for (const entry of manifest.governed_artefacts) {
          const relPath = normalizeRel(String(entry?.path ?? ""));
          const embeddedSha = String(entry?.sha256 ?? "").trim().toLowerCase();

          if (!relPath) {
            failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", normalizeRel(args.manifestPath), "governed_artefacts entry missing path."));
            continue;
          }

          if (!/^[a-f0-9]{64}$/.test(embeddedSha)) {
            failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", relPath, "governed_artefacts entry missing valid sha256."));
            continue;
          }

          const absolute = path.join(args.root, relPath);
          if (!fs.existsSync(absolute)) {
            failures.push(buildFailure("CI_SPINE_MISSING_DOC", relPath, "Governed artefact missing from repo while verifying embedded hash."));
            continue;
          }

          const liveSha = sha256File(absolute);
          if (liveSha !== embeddedSha) {
            failures.push(buildFailure(
              "CI_MANIFEST_MISMATCH",
              relPath,
              "Live governed artefact hash does not match embedded manifest hash.",
              {
                expected_sha256: liveSha,
                actual_sha256: embeddedSha
              }
            ));
          }
        }
      }
    }
  }

  const report = {
    ok: failures.length === 0,
    verifier_id: "freeze_evidence_manifest_self_hash_verifier",
    checked_at_utc: new Date().toISOString(),
    manifest: normalizeRel(args.manifestPath),
    invariant: "freeze evidence manifest cannot drift structurally without fresh governed artefact recomputation",
    recomputed_manifest_self_hash: recomputedManifestSelfHash,
    failures
  };

  if (args.writeReport) {
    writeReport(args.root, args.reportPath, report);
  }

  if (!report.ok) {
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main();