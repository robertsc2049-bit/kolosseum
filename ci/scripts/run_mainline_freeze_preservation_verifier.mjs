#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    writeReport: true,
    manifest: "docs/releases/V1_FREEZE_EVIDENCE_MANIFEST.json",
    output: "docs/releases/V1_MAINLINE_FREEZE_PRESERVATION.json"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--manifest") {
      args.manifest = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output") {
      args.output = argv[i + 1];
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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function rel(root, fullPath) {
  return path.relative(root, fullPath).replace(/\\/g, "/");
}

function sha256File(filePath) {
  const bytes = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getAllObjects(node, out = []) {
  if (Array.isArray(node)) {
    for (const item of node) {
      getAllObjects(item, out);
    }
    return out;
  }

  if (node && typeof node === "object") {
    out.push(node);
    for (const value of Object.values(node)) {
      getAllObjects(value, out);
    }
  }

  return out;
}

function normalizePathValue(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\\/g, "/").trim();
  if (!normalized) {
    return null;
  }

  if (!normalized.startsWith("docs/") && !normalized.startsWith("ci/") && !normalized.startsWith("test/") && !normalized.startsWith("registries/") && !normalized.startsWith("replay/")) {
    return null;
  }

  return normalized;
}

function normalizeHashValue(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function extractGovernedArtefacts(manifest) {
  const objects = getAllObjects(manifest, []);
  const candidates = [];

  for (const obj of objects) {
    const pathValue =
      normalizePathValue(obj.path) ??
      normalizePathValue(obj.file) ??
      normalizePathValue(obj.file_path) ??
      normalizePathValue(obj.artefact_path) ??
      normalizePathValue(obj.artifact_path) ??
      normalizePathValue(obj.surface);

    const hashValue =
      normalizeHashValue(obj.sha256) ??
      normalizeHashValue(obj.checksum_sha256) ??
      normalizeHashValue(obj.content_sha256) ??
      normalizeHashValue(obj.file_sha256) ??
      normalizeHashValue(obj.hash);

    if (pathValue && hashValue) {
      candidates.push({
        path: pathValue,
        sha256: hashValue
      });
    }
  }

  const unique = new Map();
  for (const candidate of candidates) {
    const existing = unique.get(candidate.path);
    if (existing && existing !== candidate.sha256) {
      throw new Error(`Conflicting governed hashes for ${candidate.path} in freeze evidence manifest`);
    }
    unique.set(candidate.path, candidate.sha256);
  }

  return Array.from(unique.entries())
    .map(([filePath, sha256]) => ({ path: filePath, sha256 }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function verifyGovernedArtefacts(root, governedArtefacts) {
  const failures = [];

  for (const artefact of governedArtefacts) {
    const absolutePath = path.join(root, artefact.path);

    if (!fs.existsSync(absolutePath)) {
      failures.push({
        token: "CI_SPINE_MISSING_DOC",
        file: artefact.path,
        details: "Freeze-governed artefact missing on mainline."
      });
      continue;
    }

    const actual = sha256File(absolutePath);
    if (actual !== artefact.sha256) {
      failures.push({
        token: "CI_MANIFEST_MISMATCH",
        file: artefact.path,
        expected_sha256: artefact.sha256,
        actual_sha256: actual,
        details: "Mainline drift detected against freeze-governed artefact."
      });
    }
  }

  return failures;
}

function buildReport(root, manifestPath, governedArtefacts, failures) {
  return {
    ok: failures.length === 0,
    verifier_id: "mainline_freeze_preservation_verifier",
    checked_at_utc: new Date().toISOString(),
    root: root.replace(/\\/g, "/"),
    manifest: manifestPath.replace(/\\/g, "/"),
    invariant: "merge into mainline must not weaken freeze governance by changing, deleting, or orphaning freeze-governed artefacts after freeze has been established",
    governed_artefact_count: governedArtefacts.length,
    governed_artefacts: governedArtefacts,
    failures
  };
}

function writeReport(root, outputPath, report) {
  const absolute = path.join(root, outputPath);
  ensureDir(path.dirname(absolute));
  fs.writeFileSync(absolute, JSON.stringify(report, null, 2) + "\n", "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestAbsolute = path.join(args.root, args.manifest);

  if (!fs.existsSync(manifestAbsolute)) {
    const missingReport = {
      ok: false,
      verifier_id: "mainline_freeze_preservation_verifier",
      checked_at_utc: new Date().toISOString(),
      root: args.root.replace(/\\/g, "/"),
      manifest: args.manifest.replace(/\\/g, "/"),
      invariant: "merge into mainline must not weaken freeze governance by changing, deleting, or orphaning freeze-governed artefacts after freeze has been established",
      governed_artefact_count: 0,
      governed_artefacts: [],
      failures: [
        {
          token: "CI_SPINE_MISSING_DOC",
          file: args.manifest.replace(/\\/g, "/"),
          details: "Freeze evidence manifest missing."
        }
      ]
    };

    if (args.writeReport) {
      writeReport(args.root, args.output, missingReport);
    }

    process.stderr.write(JSON.stringify(missingReport, null, 2) + "\n");
    process.exit(1);
  }

  const manifest = readJson(manifestAbsolute);
  const governedArtefacts = extractGovernedArtefacts(manifest);

  if (governedArtefacts.length === 0) {
    const emptyReport = {
      ok: false,
      verifier_id: "mainline_freeze_preservation_verifier",
      checked_at_utc: new Date().toISOString(),
      root: args.root.replace(/\\/g, "/"),
      manifest: args.manifest.replace(/\\/g, "/"),
      invariant: "merge into mainline must not weaken freeze governance by changing, deleting, or orphaning freeze-governed artefacts after freeze has been established",
      governed_artefact_count: 0,
      governed_artefacts: [],
      failures: [
        {
          token: "CI_MISSING_HARD_FAIL",
          file: args.manifest.replace(/\\/g, "/"),
          details: "Freeze evidence manifest did not expose any governed artefact path+sha256 entries."
        }
      ]
    };

    if (args.writeReport) {
      writeReport(args.root, args.output, emptyReport);
    }

    process.stderr.write(JSON.stringify(emptyReport, null, 2) + "\n");
    process.exit(1);
  }

  const failures = verifyGovernedArtefacts(args.root, governedArtefacts);
  const report = buildReport(args.root, args.manifest, governedArtefacts, failures);

  if (args.writeReport) {
    writeReport(args.root, args.output, report);
  }

  if (!report.ok) {
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main();