import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { buildFreezePromotionPacket } from "./build_freeze_promotion_packet.mjs";

function fail(code, message, details = {}) {
  const err = new Error(message);
  err.code = code;
  err.details = details;
  throw err;
}

function runGitStatus(repoRoot) {
  try {
    return execFileSync("git", ["status", "--short"], {
      cwd: repoRoot,
      encoding: "utf8"
    }).trim();
  } catch (error) {
    fail(
      "FREEZE_PROMOTION_PACKET_CLEANLINESS_GIT_STATUS_FAILED",
      "Failed to read git status for cleanliness verification.",
      {
        cause: error?.message ?? String(error)
      }
    );
  }
}

function ensureGitRepo(repoRoot) {
  try {
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch {
    fail(
      "FREEZE_PROMOTION_PACKET_CLEANLINESS_NOT_GIT_REPO",
      "Cleanliness verifier requires a git repository."
    );
  }
}

function ensureDirectoryAbsent(dirPath, code) {
  if (fs.existsSync(dirPath)) {
    fail(
      code,
      `Disposable output directory '${dirPath}' still exists after cleanup.`,
      { path: dirPath }
    );
  }
}

export function verifyFreezePromotionPacketCleanliness({
  repoRoot = process.cwd(),
  packetSetPath = "docs/releases/V1_FREEZE_PROMOTION_PACKET_SET.json",
  disposableOutputDir = ".tmp/freeze-promotion-packet-cleanliness"
} = {}) {
  ensureGitRepo(repoRoot);

  const outputAbs = path.resolve(repoRoot, disposableOutputDir);
  const beforeStatus = runGitStatus(repoRoot);

  if (beforeStatus.length !== 0) {
    fail(
      "FREEZE_PROMOTION_PACKET_CLEANLINESS_REPO_NOT_CLEAN_BEFORE",
      "Repository must be clean before promotion packet cleanliness verification.",
      { git_status_before: beforeStatus }
    );
  }

  fs.rmSync(outputAbs, { recursive: true, force: true });

  let buildReport;
  try {
    buildReport = buildFreezePromotionPacket({
      repoRoot,
      packetSetPath,
      outputDir: disposableOutputDir
    });
  } finally {
    fs.rmSync(outputAbs, { recursive: true, force: true });
  }

  ensureDirectoryAbsent(
    outputAbs,
    "FREEZE_PROMOTION_PACKET_CLEANLINESS_OUTPUT_RESIDUE"
  );

  const afterStatus = runGitStatus(repoRoot);
  if (afterStatus.length !== 0) {
    fail(
      "FREEZE_PROMOTION_PACKET_CLEANLINESS_REPO_DIRTY_AFTER",
      "Promotion packet build left tracked or untracked residue in the repository.",
      { git_status_after: afterStatus }
    );
  }

  return {
    ok: true,
    schema_version: "kolosseum.freeze.promotion_packet_cleanliness_report.v1",
    packet_set_path: packetSetPath,
    disposable_output_dir: disposableOutputDir.replace(/\\/g, "/"),
    built_file_count: buildReport.file_count,
    repo_clean_before: true,
    repo_clean_after: true
  };
}

function main() {
  const packetSetPath = process.argv[2] ?? "docs/releases/V1_FREEZE_PROMOTION_PACKET_SET.json";
  const disposableOutputDir = process.argv[3] ?? ".tmp/freeze-promotion-packet-cleanliness";
  const outputReportPath = process.argv[4] ?? null;

  let report;
  try {
    report = verifyFreezePromotionPacketCleanliness({
      repoRoot: process.cwd(),
      packetSetPath,
      disposableOutputDir
    });
  } catch (error) {
    report = {
      ok: false,
      schema_version: "kolosseum.freeze.promotion_packet_cleanliness_report.v1",
      fatal_error: {
        code: error?.code ?? "FREEZE_PROMOTION_PACKET_CLEANLINESS_FATAL",
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