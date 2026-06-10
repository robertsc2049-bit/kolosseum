import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = process.cwd();

const RELEASE_NOTES_PATH = path.join("docs", "releases", "V1_RELEASE_NOTES.md");
const SEAL_PATH = path.join("ci", "evidence", "registry_seal_manifest.v1.json");

const TOKEN = {
  MISSING_NOTES: "CI_RELEASE_NOTES_SEAL_MISSING_NOTES",
  MISSING_REFERENCE: "CI_RELEASE_NOTES_SEAL_REFERENCE_MISSING",
  STALE_REFERENCE: "CI_RELEASE_NOTES_SEAL_REFERENCE_STALE",
  STRUCTURE: "CI_RELEASE_NOTES_SEAL_STRUCTURE_INVALID"
};

function fail(failures, token, details, extra = {}) {
  failures.push({ token, details, ...extra });
}

function readFileSafe(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} missing at ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function extractSealReference(notesContent) {
  const match = notesContent.match(/registry_seal_manifest\.v1\.json\s*:\s*([a-f0-9]{64})/i);
  return match ? match[1].toLowerCase() : null;
}

export async function verifyReleaseNotesSealBinding(rootDir = DEFAULT_ROOT) {
  const failures = [];

  const notesPath = path.join(rootDir, RELEASE_NOTES_PATH);
  const sealPath = path.join(rootDir, SEAL_PATH);

  if (!fs.existsSync(notesPath)) {
    fail(failures, TOKEN.MISSING_NOTES, "Release notes file is missing.", {
      path: RELEASE_NOTES_PATH
    });
    return { ok: false, failures };
  }

  if (!fs.existsSync(sealPath)) {
    fail(failures, TOKEN.STRUCTURE, "Registry seal manifest is missing.", {
      path: SEAL_PATH
    });
    return { ok: false, failures };
  }

  const notesContent = readFileSafe(notesPath, "release notes");
  const sealContent = readFileSafe(sealPath, "registry seal manifest");

  const referencedHash = extractSealReference(notesContent);

  if (!referencedHash) {
    fail(
      failures,
      TOKEN.MISSING_REFERENCE,
      "Release notes must include 'registry_seal_manifest.v1.json: <sha256>'.",
      { path: RELEASE_NOTES_PATH }
    );
    return { ok: false, failures };
  }

  const actualHash = crypto.createHash("sha256").update(sealContent).digest("hex");

  if (referencedHash !== actualHash) {
    fail(
      failures,
      TOKEN.STALE_REFERENCE,
      "Release notes reference does not match the active registry seal manifest.",
      {
        path: RELEASE_NOTES_PATH,
        expected: actualHash,
        found: referencedHash
      }
    );
  }

  return {
    ok: failures.length === 0,
    failures
  };
}

async function main() {
  try {
    const report = await verifyReleaseNotesSealBinding(DEFAULT_ROOT);

    if (!report.ok) {
      process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
      process.exit(1);
    }

    process.stdout.write(`${JSON.stringify({ ok: true }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      token: TOKEN.STRUCTURE,
      details: error instanceof Error ? error.message : String(error)
    }, null, 2)}\n`);
    process.exit(1);
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main();
}