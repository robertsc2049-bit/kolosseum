import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

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

function normalizeStringArray(values, code, label) {
  ensureArray(values, code, `${label} must be an array.`);
  const seen = new Set();
  const normalized = [];

  for (const value of values) {
    if (typeof value !== "string" || value.trim().length === 0) {
      fail(code, `${label} entries must be non-empty strings.`, { value });
    }

    const item = value.trim().replace(/\\/g, "/");
    if (seen.has(item)) {
      fail(code, `${label} contains duplicate entry '${item}'.`, { value: item });
    }

    seen.add(item);
    normalized.push(item);
  }

  normalized.sort((a, b) => a.localeCompare(b, "en"));
  return normalized;
}

function loadScopeManifest(repoRoot, scopePath) {
  const abs = toAbs(repoRoot, scopePath);
  if (!fs.existsSync(abs)) {
    fail(
      "FREEZE_MAINLINE_MUTATION_SCOPE_MANIFEST_MISSING",
      `Freeze mainline mutation scope manifest '${scopePath}' does not exist.`,
      { path: scopePath }
    );
  }

  const manifest = readJson(abs);
  if (manifest?.schema_version !== "kolosseum.freeze.mainline_mutation_scope.v1") {
    fail(
      "FREEZE_MAINLINE_MUTATION_SCOPE_SCHEMA_INVALID",
      "Freeze mainline mutation scope manifest schema_version must be kolosseum.freeze.mainline_mutation_scope.v1.",
      { schema_version: manifest?.schema_version ?? null }
    );
  }

  const freezeScopePaths = normalizeStringArray(
    manifest.freeze_scope_paths,
    "FREEZE_MAINLINE_MUTATION_SCOPE_FREEZE_PATHS_INVALID",
    "freeze_scope_paths"
  );

  const allowlistedPaths = normalizeStringArray(
    manifest.allowlisted_paths ?? [],
    "FREEZE_MAINLINE_MUTATION_SCOPE_ALLOWLIST_INVALID",
    "allowlisted_paths"
  );

  const overlap = freezeScopePaths.filter((item) => allowlistedPaths.includes(item));
  if (overlap.length > 0) {
    fail(
      "FREEZE_MAINLINE_MUTATION_SCOPE_OVERLAP_INVALID",
      "freeze_scope_paths and allowlisted_paths must not overlap.",
      { overlap }
    );
  }

  return {
    manifest,
    freeze_scope_paths: freezeScopePaths,
    allowlisted_paths: allowlistedPaths
  };
}

function resolveChangedFilesFromGit(repoRoot, baseSha, headSha) {
  if (typeof baseSha !== "string" || baseSha.trim().length === 0) {
    fail(
      "FREEZE_MAINLINE_MUTATION_SCOPE_BASE_SHA_MISSING",
      "BASE_SHA (or explicit baseSha) is required when changedFiles is not provided."
    );
  }

  if (typeof headSha !== "string" || headSha.trim().length === 0) {
    fail(
      "FREEZE_MAINLINE_MUTATION_SCOPE_HEAD_SHA_MISSING",
      "HEAD_SHA (or explicit headSha) is required when changedFiles is not provided."
    );
  }

  let output;
  try {
    output = execFileSync(
      "git",
      ["diff", "--name-only", baseSha, headSha],
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
  } catch (error) {
    fail(
      "FREEZE_MAINLINE_MUTATION_SCOPE_GIT_DIFF_FAILED",
      "Failed to resolve changed files from git diff.",
      {
        base_sha: baseSha,
        head_sha: headSha,
        cause: error?.message ?? String(error)
      }
    );
  }

  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return normalizeStringArray(
    lines,
    "FREEZE_MAINLINE_MUTATION_SCOPE_CHANGED_FILES_INVALID",
    "changed_files"
  );
}

export function verifyFreezeMainlineMutationScope({
  repoRoot = process.cwd(),
  scopePath = "docs/releases/V1_FREEZE_MAINLINE_MUTATION_SCOPE.json",
  changedFiles = null,
  baseSha = process.env.BASE_SHA ?? "",
  headSha = process.env.HEAD_SHA ?? ""
} = {}) {
  const scope = loadScopeManifest(repoRoot, scopePath);

  const normalizedChangedFiles = changedFiles === null
    ? resolveChangedFilesFromGit(repoRoot, baseSha, headSha)
    : normalizeStringArray(
        changedFiles,
        "FREEZE_MAINLINE_MUTATION_SCOPE_CHANGED_FILES_INVALID",
        "changed_files"
      );

  const freezeScopeSet = new Set(scope.freeze_scope_paths);
  const allowlistSet = new Set(scope.allowlisted_paths);

  const spillover = [];
  for (const filePath of normalizedChangedFiles) {
    if (!freezeScopeSet.has(filePath) && !allowlistSet.has(filePath)) {
      spillover.push(filePath);
    }
  }

  const report = {
    ok: spillover.length === 0,
    schema_version: "kolosseum.freeze.mainline_mutation_scope_report.v1",
    scope_path: scopePath,
    changed_file_count: normalizedChangedFiles.length,
    changed_files: normalizedChangedFiles,
    freeze_scope_paths: scope.freeze_scope_paths,
    allowlisted_paths: scope.allowlisted_paths,
    spillover
  };

  if (spillover.length > 0) {
    fail(
      "FREEZE_MAINLINE_MUTATION_SCOPE_SPILLOVER_DETECTED",
      "Detected changed files outside the declared freeze mainline mutation scope.",
      report
    );
  }

  return report;
}

function main() {
  const scopePath = process.argv[2] ?? "docs/releases/V1_FREEZE_MAINLINE_MUTATION_SCOPE.json";
  const baseSha = process.argv[3] ?? process.env.BASE_SHA ?? "";
  const headSha = process.argv[4] ?? process.env.HEAD_SHA ?? "";
  const outputReportPath = process.argv[5] ?? null;

  let report;
  try {
    report = verifyFreezeMainlineMutationScope({
      repoRoot: process.cwd(),
      scopePath,
      changedFiles: null,
      baseSha,
      headSha
    });
  } catch (error) {
    report = {
      ok: false,
      schema_version: "kolosseum.freeze.mainline_mutation_scope_report.v1",
      fatal_error: {
        code: error?.code ?? "FREEZE_MAINLINE_MUTATION_SCOPE_FATAL",
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