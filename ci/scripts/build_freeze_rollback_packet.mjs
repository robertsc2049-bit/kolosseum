import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(code, message, details = {}) {
  const err = new Error(message);
  err.code = code;
  err.details = details;
  throw err;
}

function ensureArray(value, code, message, details = {}) {
  if (!Array.isArray(value)) {
    fail(code, message, details);
  }
}

function toAbs(repoRoot, repoRelativePath) {
  return path.resolve(repoRoot, repoRelativePath);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function normalizePacketPath(packetPath, index) {
  if (typeof packetPath !== "string" || packetPath.length === 0) {
    fail(
      "FREEZE_ROLLBACK_PACKET_DEST_INVALID",
      `Rollback packet entry at index ${index} must include a non-empty packet_path.`,
      { index }
    );
  }

  if (path.isAbsolute(packetPath)) {
    fail(
      "FREEZE_ROLLBACK_PACKET_DEST_ABSOLUTE_FORBIDDEN",
      `Rollback packet entry at index ${index} must not use an absolute packet_path.`,
      { index, packet_path: packetPath }
    );
  }

  const normalized = packetPath.replace(/\\/g, "/");
  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    fail(
      "FREEZE_ROLLBACK_PACKET_DEST_TRAVERSAL_FORBIDDEN",
      `Rollback packet entry at index ${index} must not escape the rollback packet root.`,
      { index, packet_path: packetPath }
    );
  }

  return normalized;
}

function loadRollbackPacketSet(repoRoot, packetSetPath) {
  const abs = toAbs(repoRoot, packetSetPath);
  if (!fs.existsSync(abs)) {
    fail(
      "FREEZE_ROLLBACK_PACKET_SET_MISSING",
      `Rollback packet manifest '${packetSetPath}' does not exist.`,
      { path: packetSetPath }
    );
  }

  const manifest = readJson(abs);
  if (manifest?.schema_version !== "kolosseum.freeze.rollback_packet_set.v1") {
    fail(
      "FREEZE_ROLLBACK_PACKET_SET_SCHEMA_INVALID",
      "Rollback packet manifest schema_version must be kolosseum.freeze.rollback_packet_set.v1.",
      { schema_version: manifest?.schema_version ?? null }
    );
  }

  ensureArray(
    manifest.rollback_files,
    "FREEZE_ROLLBACK_PACKET_SET_FILES_INVALID",
    "Rollback packet manifest rollback_files must be an array."
  );

  const seenSources = new Set();
  const seenDestinations = new Set();

  const rollbackFiles = manifest.rollback_files.map((item, index) => {
    if (!item || typeof item !== "object") {
      fail(
        "FREEZE_ROLLBACK_PACKET_SET_ENTRY_INVALID",
        `Rollback packet entry at index ${index} must be an object.`,
        { index }
      );
    }

    if (typeof item.source_path !== "string" || item.source_path.length === 0) {
      fail(
        "FREEZE_ROLLBACK_PACKET_SOURCE_INVALID",
        `Rollback packet entry at index ${index} must include a non-empty source_path.`,
        { index }
      );
    }

    const packetPath = normalizePacketPath(item.packet_path, index);

    if (seenSources.has(item.source_path)) {
      fail(
        "FREEZE_ROLLBACK_PACKET_DUPLICATE_SOURCE",
        `Duplicate source_path '${item.source_path}' in rollback packet manifest.`,
        { source_path: item.source_path }
      );
    }

    if (seenDestinations.has(packetPath)) {
      fail(
        "FREEZE_ROLLBACK_PACKET_DUPLICATE_DESTINATION",
        `Duplicate packet_path '${packetPath}' in rollback packet manifest.`,
        { packet_path: packetPath }
      );
    }

    seenSources.add(item.source_path);
    seenDestinations.add(packetPath);

    return {
      source_path: item.source_path,
      packet_path: packetPath,
      required: item.required !== false
    };
  });

  rollbackFiles.sort((a, b) => a.packet_path.localeCompare(b.packet_path, "en"));
  return rollbackFiles;
}

export function buildFreezeRollbackPacket({
  repoRoot = process.cwd(),
  packetSetPath = "docs/releases/V1_FREEZE_ROLLBACK_PACKET_SET.json",
  outputDir = "artifacts/freeze-rollback-packet"
} = {}) {
  const rollbackFiles = loadRollbackPacketSet(repoRoot, packetSetPath);
  const outputAbs = toAbs(repoRoot, outputDir);

  fs.rmSync(outputAbs, { recursive: true, force: true });
  fs.mkdirSync(outputAbs, { recursive: true });

  const written = [];

  for (const entry of rollbackFiles) {
    const srcAbs = toAbs(repoRoot, entry.source_path);

    if (!fs.existsSync(srcAbs)) {
      fail(
        "FREEZE_ROLLBACK_PACKET_REQUIRED_SOURCE_MISSING",
        `Required rollback packet source '${entry.source_path}' does not exist.`,
        { source_path: entry.source_path, packet_path: entry.packet_path }
      );
    }

    const stat = fs.statSync(srcAbs);
    if (!stat.isFile()) {
      fail(
        "FREEZE_ROLLBACK_PACKET_SOURCE_NOT_FILE",
        `Rollback packet source '${entry.source_path}' is not a file.`,
        { source_path: entry.source_path, packet_path: entry.packet_path }
      );
    }

    const destAbs = path.join(outputAbs, entry.packet_path);
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });
    fs.copyFileSync(srcAbs, destAbs);

    written.push({
      source_path: entry.source_path,
      packet_path: entry.packet_path,
      sha256: sha256File(destAbs)
    });
  }

  const actualFiles = [];
  function walk(currentDir) {
    for (const dirent of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const abs = path.join(currentDir, dirent.name);
      if (dirent.isDirectory()) {
        walk(abs);
      } else if (dirent.isFile()) {
        actualFiles.push(path.relative(outputAbs, abs).replace(/\\/g, "/"));
      }
    }
  }
  walk(outputAbs);

  actualFiles.sort((a, b) => a.localeCompare(b, "en"));

  const declaredFiles = written.map((item) => item.packet_path).sort((a, b) => a.localeCompare(b, "en"));
  const declaredSet = new Set(declaredFiles);

  const extraFiles = actualFiles.filter((item) => !declaredSet.has(item));
  if (extraFiles.length > 0) {
    fail(
      "FREEZE_ROLLBACK_PACKET_EXTRA_FILE_EMITTED",
      "Rollback packet builder emitted undeclared files.",
      { extra_files: extraFiles }
    );
  }

  const missingFiles = declaredFiles.filter((item) => !actualFiles.includes(item));
  if (missingFiles.length > 0) {
    fail(
      "FREEZE_ROLLBACK_PACKET_DECLARED_FILE_MISSING",
      "Rollback packet builder failed to emit one or more declared rollback packet files.",
      { missing_files: missingFiles }
    );
  }

  return {
    ok: true,
    schema_version: "kolosseum.freeze.rollback_packet_report.v1",
    packet_root: outputDir.replace(/\\/g, "/"),
    file_count: written.length,
    files: written
  };
}

function main() {
  const packetSetPath = process.argv[2] ?? "docs/releases/V1_FREEZE_ROLLBACK_PACKET_SET.json";
  const outputDir = process.argv[3] ?? "artifacts/freeze-rollback-packet";
  const outputReportPath = process.argv[4] ?? null;

  let report;
  try {
    report = buildFreezeRollbackPacket({
      repoRoot: process.cwd(),
      packetSetPath,
      outputDir
    });
  } catch (error) {
    report = {
      ok: false,
      schema_version: "kolosseum.freeze.rollback_packet_report.v1",
      fatal_error: {
        code: error?.code ?? "FREEZE_ROLLBACK_PACKET_FATAL",
        message: error?.message ?? String(error),
        details: error?.details ?? {}
      }
    };
  }

  const json = `${JSON.stringify(report, null, 2)}\n`;

  if (outputReportPath) {
    const outputReportAbs = path.resolve(process.cwd(), outputReportPath);
    fs.mkdirSync(path.dirname(outputReportAbs), { recursive: true });
    fs.writeFileSync(outputReportAbs, json, "utf8");
  }

  process.stdout.write(json);
  process.exit(report.ok ? 0 : 1);
}

const entryHref = process.argv[1] ? new URL(`file://${path.resolve(process.argv[1])}`).href : null;
if (entryHref && import.meta.url === entryHref) {
  main();
}