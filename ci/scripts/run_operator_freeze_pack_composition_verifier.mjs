#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    setPath: "docs/releases/V1_OPERATOR_FREEZE_ARTEFACT_SET.json"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--set") {
      args.setPath = argv[i + 1];
      i += 1;
      continue;
    }
  }

  return args;
}

function normalizeRel(input) {
  return input.replace(/\\/g, "/");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256File(filePath) {
  const bytes = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function listFilesRecursive(rootDir) {
  const out = [];
  if (!fs.existsSync(rootDir)) {
    return out;
  }

  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else {
        out.push(full);
      }
    }
  }

  return out;
}

function buildFailure(token, file, details, extra = {}) {
  return { token, file, details, ...extra };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const setAbs = path.join(args.root, args.setPath);
  const failures = [];

  if (!fs.existsSync(setAbs)) {
    failures.push(buildFailure("CI_SPINE_MISSING_DOC", normalizeRel(args.setPath), "Operator freeze artefact set missing."));
  }

  let artefactSet = null;
  if (failures.length === 0) {
    artefactSet = readJson(setAbs);
    if (!artefactSet || typeof artefactSet !== "object") {
      failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", normalizeRel(args.setPath), "Operator freeze artefact set must be a JSON object."));
    } else if (!Array.isArray(artefactSet.artefacts) || artefactSet.artefacts.length === 0) {
      failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", normalizeRel(args.setPath), "Operator freeze artefact set must contain a non-empty artefacts array."));
    } else if (typeof artefactSet.output_dir !== "string" || artefactSet.output_dir.trim() === "") {
      failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", normalizeRel(args.setPath), "Operator freeze artefact set must declare output_dir."));
    }
  }

  let outputDirRel = null;
  let outputDirAbs = null;
  let manifestAbs = null;
  let declaredPaths = [];

  if (failures.length === 0) {
    declaredPaths = artefactSet.artefacts.map((x) => normalizeRel(String(x).trim()));
    outputDirRel = normalizeRel(artefactSet.output_dir.trim());
    outputDirAbs = path.join(args.root, outputDirRel);
    manifestAbs = path.join(outputDirAbs, "manifest.json");

    for (const relPath of declaredPaths) {
      const sourceAbs = path.join(args.root, relPath);
      if (!fs.existsSync(sourceAbs)) {
        failures.push(buildFailure("CI_SPINE_MISSING_DOC", relPath, "Declared operator freeze artefact missing from repo."));
      }
    }

    if (!fs.existsSync(outputDirAbs)) {
      failures.push(buildFailure("CI_SPINE_MISSING_DOC", outputDirRel, "Operator freeze bundle output directory missing. Run builder first."));
    } else if (!fs.existsSync(manifestAbs)) {
      failures.push(buildFailure("CI_SPINE_MISSING_DOC", normalizeRel(path.relative(args.root, manifestAbs)), "Operator freeze bundle manifest missing. Run builder first."));
    }
  }

  let manifest = null;
  if (failures.length === 0) {
    manifest = readJson(manifestAbs);
    if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.artefacts)) {
      failures.push(buildFailure("CI_REGISTRY_STRUCTURE_INVALID", normalizeRel(path.relative(args.root, manifestAbs)), "Operator freeze bundle manifest has invalid shape."));
    }
  }

  if (failures.length === 0) {
    const manifestEntries = manifest.artefacts.map((entry) => ({
      path: normalizeRel(String(entry.path)),
      sha256: String(entry.sha256).toLowerCase()
    }));

    const manifestMap = new Map();
    for (const entry of manifestEntries) {
      manifestMap.set(entry.path, entry.sha256);
    }

    for (const relPath of declaredPaths) {
      const builtAbs = path.join(outputDirAbs, relPath);
      const sourceAbs = path.join(args.root, relPath);

      if (!fs.existsSync(builtAbs)) {
        failures.push(buildFailure("CI_SPINE_MISSING_DOC", relPath, "Declared operator freeze artefact missing from built pack."));
        continue;
      }

      const sourceSha = sha256File(sourceAbs);
      const builtSha = sha256File(builtAbs);
      const manifestSha = manifestMap.get(relPath);

      if (sourceSha !== builtSha) {
        failures.push(buildFailure("CI_MANIFEST_MISMATCH", relPath, "Built operator freeze artefact bytes differ from source.", { expected_sha256: sourceSha, actual_sha256: builtSha }));
      }

      if (manifestSha !== sourceSha) {
        failures.push(buildFailure("CI_MANIFEST_MISMATCH", relPath, "Bundle manifest hash does not match source artefact.", { expected_sha256: sourceSha, actual_sha256: manifestSha ?? null }));
      }
    }

    const expectedBuilt = new Set(["manifest.json", ...declaredPaths].map(normalizeRel));
    const actualBuilt = listFilesRecursive(outputDirAbs)
      .map((filePath) => normalizeRel(path.relative(outputDirAbs, filePath)));

    for (const relPath of actualBuilt) {
      if (!expectedBuilt.has(relPath)) {
        failures.push(buildFailure("CI_MANIFEST_MISMATCH", normalizeRel(path.join(outputDirRel, relPath)), "Undeclared file present in operator freeze bundle."));
      }
    }

    for (const manifestEntry of manifestEntries) {
      if (!declaredPaths.includes(manifestEntry.path)) {
        failures.push(buildFailure("CI_MANIFEST_MISMATCH", manifestEntry.path, "Undeclared artefact present in bundle manifest."));
      }
    }
  }

  const report = {
    ok: failures.length === 0,
    verifier_id: "operator_freeze_pack_composition_verifier",
    checked_at_utc: new Date().toISOString(),
    set: normalizeRel(args.setPath),
    output_dir: outputDirRel,
    failures
  };

  if (!report.ok) {
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main();