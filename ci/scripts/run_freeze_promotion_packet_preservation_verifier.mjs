import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { buildFreezePromotionPacket } from "./build_freeze_promotion_packet.mjs";

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function fail(code, message, details = {}) {
  const err = new Error(message);
  err.code = code;
  err.details = details;
  throw err;
}

function walkFiles(rootDir) {
  const files = [];

  function walk(currentDir) {
    for (const dirent of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const abs = path.join(currentDir, dirent.name);
      if (dirent.isDirectory()) {
        walk(abs);
      } else if (dirent.isFile()) {
        const rel = path.relative(rootDir, abs).replace(/\\/g, "/");
        files.push({
          relative_path: rel,
          sha256: sha256File(abs),
          size_bytes: fs.statSync(abs).size
        });
      }
    }
  }

  if (fs.existsSync(rootDir)) {
    walk(rootDir);
  }

  files.sort((a, b) => a.relative_path.localeCompare(b.relative_path, "en"));
  return files;
}

function normalizeBuilderReport(report) {
  return {
    ok: report.ok,
    schema_version: report.schema_version,
    file_count: report.file_count,
    files: [...(report.files ?? [])]
      .map((item) => ({
        source_path: item.source_path,
        packet_path: item.packet_path,
        sha256: item.sha256
      }))
      .sort((a, b) => a.packet_path.localeCompare(b.packet_path, "en"))
  };
}

export function verifyFreezePromotionPacketPreservation({
  repoRoot = process.cwd(),
  packetSetPath = "docs/releases/V1_FREEZE_PROMOTION_PACKET_SET.json"
} = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "kolosseum-freeze-packet-preservation-"));
  const runA = path.join(tempRoot, "run-a");
  const runB = path.join(tempRoot, "run-b");

  try {
    const reportA = buildFreezePromotionPacket({
      repoRoot,
      packetSetPath,
      outputDir: path.relative(repoRoot, runA)
    });

    const reportB = buildFreezePromotionPacket({
      repoRoot,
      packetSetPath,
      outputDir: path.relative(repoRoot, runB)
    });

    const filesA = walkFiles(runA);
    const filesB = walkFiles(runB);

    if (!fs.existsSync(runA) || !fs.existsSync(runB)) {
      fail(
        "FREEZE_PROMOTION_PACKET_PRESERVATION_OUTPUT_MISSING",
        "Preservation verifier expected both packet outputs to exist.",
        { runA_exists: fs.existsSync(runA), runB_exists: fs.existsSync(runB) }
      );
    }

    if (filesA.length !== filesB.length) {
      fail(
        "FREEZE_PROMOTION_PACKET_PRESERVATION_FILE_COUNT_MISMATCH",
        "Packet rebuild produced different file counts across reruns.",
        { runA_file_count: filesA.length, runB_file_count: filesB.length }
      );
    }

    const pathsA = filesA.map((item) => item.relative_path);
    const pathsB = filesB.map((item) => item.relative_path);
    if (JSON.stringify(pathsA) !== JSON.stringify(pathsB)) {
      fail(
        "FREEZE_PROMOTION_PACKET_PRESERVATION_PATH_MISMATCH",
        "Packet rebuild produced different file paths across reruns.",
        { runA_paths: pathsA, runB_paths: pathsB }
      );
    }

    const drift = [];
    for (let i = 0; i < filesA.length; i += 1) {
      const a = filesA[i];
      const b = filesB[i];

      if (a.relative_path !== b.relative_path) {
        drift.push({
          code: "FREEZE_PROMOTION_PACKET_PRESERVATION_PATH_ENTRY_MISMATCH",
          runA: a,
          runB: b
        });
        continue;
      }

      if (a.sha256 !== b.sha256 || a.size_bytes !== b.size_bytes) {
        drift.push({
          code: "FREEZE_PROMOTION_PACKET_PRESERVATION_CONTENT_MISMATCH",
          relative_path: a.relative_path,
          runA_sha256: a.sha256,
          runB_sha256: b.sha256,
          runA_size_bytes: a.size_bytes,
          runB_size_bytes: b.size_bytes
        });
      }
    }

    const reportANormalized = normalizeBuilderReport(reportA);
    const reportBNormalized = normalizeBuilderReport(reportB);
    const reportAJson = JSON.stringify(reportANormalized, null, 2);
    const reportBJson = JSON.stringify(reportBNormalized, null, 2);

    if (reportAJson !== reportBJson) {
      drift.push({
        code: "FREEZE_PROMOTION_PACKET_PRESERVATION_REPORT_MISMATCH",
        runA_report: reportANormalized,
        runB_report: reportBNormalized
      });
    }

    if (drift.length > 0) {
      fail(
        "FREEZE_PROMOTION_PACKET_PRESERVATION_DRIFT_DETECTED",
        "Promotion packet rebuild drift detected across reruns.",
        { drift }
      );
    }

    return {
      ok: true,
      schema_version: "kolosseum.freeze.promotion_packet_preservation_report.v1",
      packet_set_path: packetSetPath,
      file_count: filesA.length,
      files: filesA
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function main() {
  const packetSetPath = process.argv[2] ?? "docs/releases/V1_FREEZE_PROMOTION_PACKET_SET.json";
  const outputReportPath = process.argv[3] ?? null;

  let report;
  try {
    report = verifyFreezePromotionPacketPreservation({
      repoRoot: process.cwd(),
      packetSetPath
    });
  } catch (error) {
    report = {
      ok: false,
      schema_version: "kolosseum.freeze.promotion_packet_preservation_report.v1",
      fatal_error: {
        code: error?.code ?? "FREEZE_PROMOTION_PACKET_PRESERVATION_FATAL",
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