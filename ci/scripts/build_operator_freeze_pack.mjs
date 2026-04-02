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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
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

function validateArtefactSet(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Operator freeze artefact set must be a JSON object.");
  }
  if (!Array.isArray(data.artefacts) || data.artefacts.length === 0) {
    throw new Error("Operator freeze artefact set must contain a non-empty artefacts array.");
  }
  if (typeof data.output_dir !== "string" || data.output_dir.trim() === "") {
    throw new Error("Operator freeze artefact set must declare output_dir.");
  }

  const seen = new Set();
  for (const entry of data.artefacts) {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new Error("Artefact entries must be non-empty strings.");
    }
    const normalized = normalizeRel(entry.trim());

    if (path.isAbsolute(normalized)) {
      throw new Error(`Absolute artefact path forbidden: ${normalized}`);
    }
    if (normalized.startsWith("../") || normalized.includes("/../")) {
      throw new Error(`Parent traversal forbidden in artefact path: ${normalized}`);
    }
    if (seen.has(normalized)) {
      throw new Error(`Duplicate artefact path in set: ${normalized}`);
    }
    seen.add(normalized);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const setAbsolute = path.join(args.root, args.setPath);

  if (!fs.existsSync(setAbsolute)) {
    throw new Error(`Missing operator freeze artefact set: ${normalizeRel(args.setPath)}`);
  }

  const artefactSet = readJson(setAbsolute);
  validateArtefactSet(artefactSet);

  const outputDirRel = normalizeRel(artefactSet.output_dir.trim());
  const outputDirAbs = path.join(args.root, outputDirRel);

  fs.rmSync(outputDirAbs, { recursive: true, force: true });
  ensureDir(outputDirAbs);

  const manifestEntries = [];

  for (const relPath of artefactSet.artefacts.map((x) => normalizeRel(x.trim()))) {
    const sourceAbs = path.join(args.root, relPath);
    if (!fs.existsSync(sourceAbs)) {
      throw new Error(`Declared operator freeze artefact missing: ${relPath}`);
    }

    const destinationAbs = path.join(outputDirAbs, relPath);
    ensureDir(path.dirname(destinationAbs));
    fs.copyFileSync(sourceAbs, destinationAbs);

    manifestEntries.push({
      path: relPath,
      sha256: sha256File(sourceAbs)
    });
  }

  const manifest = {
    schema_version: "kolosseum.release.operator_freeze_pack_manifest.v1",
    release_id: artefactSet.release_id,
    pack_id: artefactSet.pack_id,
    source_set: normalizeRel(args.setPath),
    output_dir: outputDirRel,
    artefact_count: manifestEntries.length,
    artefacts: manifestEntries
  };

  const manifestAbs = path.join(outputDirAbs, "manifest.json");
  fs.writeFileSync(manifestAbs, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  const builtFiles = listFilesRecursive(outputDirAbs)
    .map((filePath) => normalizeRel(path.relative(outputDirAbs, filePath)))
    .sort();

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        builder_id: "build_operator_freeze_pack",
        output_dir: outputDirRel,
        artefact_count: manifestEntries.length,
        built_files: builtFiles
      },
      null,
      2
    ) + "\n"
  );
}

main();