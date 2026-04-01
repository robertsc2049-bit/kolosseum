import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const TOKEN = "CI_FREEZE_DRIFT_SINCE_MERGE_BASE";
const DEFAULT_MANIFEST_PATH = "ci/freeze/freeze_sensitive_surfaces.v1.json";
const DEFAULT_EVIDENCE_PATH = "docs/releases/V1_FREEZE_DRIFT_EVIDENCE.json";

function fail(details, extra = {}) {
  return {
    ok: false,
    failures: [
      {
        token: TOKEN,
        details,
        ...extra,
      },
    ],
  };
}

function ok(meta = {}) {
  return { ok: true, ...meta };
}

function normalizePath(value) {
  return String(value ?? "").replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { __read_error__: `Failed to read JSON at ${filePath}: ${message}` };
  }
}

function git(repoRoot, args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegex(glob) {
  let pattern = escapeRegex(normalizePath(glob));
  pattern = pattern.replace(/\\\*\\\*/g, "__DOUBLE_STAR__");
  pattern = pattern.replace(/\\\*/g, "__SINGLE_STAR__");
  pattern = pattern.replace(/\\\?/g, "__QMARK__");
  pattern = pattern.replace(/__DOUBLE_STAR__/g, ".*");
  pattern = pattern.replace(/__SINGLE_STAR__/g, "[^/]*");
  pattern = pattern.replace(/__QMARK__/g, ".");
  return new RegExp(`^${pattern}$`);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueNormalized(items) {
  return [...new Set(ensureArray(items).map((item) => normalizePath(item)).filter(Boolean))];
}

function getMergeBase(repoRoot, baseRef) {
  try {
    return git(repoRoot, ["merge-base", "HEAD", baseRef]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to compute merge-base against '${baseRef}': ${message}`);
  }
}

function getChangedFilesSince(repoRoot, baseSha) {
  const output = git(repoRoot, ["diff", "--name-only", `${baseSha}..HEAD`]);
  return uniqueNormalized(output.split(/\r?\n/));
}

function fileMatchesAnyGlob(filePath, globs) {
  return globs.some((glob) => globToRegex(glob).test(filePath));
}

function resolveFreezeSensitiveChanges(changedFiles, surfaceGlobs) {
  return changedFiles.filter((filePath) => fileMatchesAnyGlob(filePath, surfaceGlobs));
}

function verifyFreezeDrift({
  baseRef,
  manifestPath,
  evidencePath,
  repoRoot,
}) {
  const resolvedRepoRoot = path.resolve(repoRoot ?? process.cwd());

  const manifest = readJson(manifestPath);
  if (manifest.__read_error__) {
    return fail(manifest.__read_error__, { path: normalizePath(manifestPath) });
  }

  const evidence = readJson(evidencePath);
  if (evidence.__read_error__) {
    return fail(evidence.__read_error__, { path: normalizePath(evidencePath) });
  }

  const surfaceGlobs = uniqueNormalized(
    manifest.freeze_sensitive_surfaces ??
    manifest.freeze_surface_globs ??
    manifest.surface_globs
  );

  if (surfaceGlobs.length === 0) {
    return fail(
      "Freeze-sensitive manifest must declare at least one surface glob.",
      { path: normalizePath(manifestPath) }
    );
  }

  const declaredBaseRef = String(
    evidence.base_ref ??
    evidence.merge_base_ref ??
    ""
  ).trim();

  if (declaredBaseRef && declaredBaseRef !== baseRef) {
    return fail(
      `Freeze drift evidence base ref '${declaredBaseRef}' does not match verifier base ref '${baseRef}'.`,
      { path: normalizePath(evidencePath) }
    );
  }

  let mergeBase;
  let changedFiles;
  try {
    mergeBase = getMergeBase(resolvedRepoRoot, baseRef);
    changedFiles = getChangedFilesSince(resolvedRepoRoot, mergeBase);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(message);
  }

  const changedFreezeSensitiveFiles = resolveFreezeSensitiveChanges(changedFiles, surfaceGlobs);
  const declaredFreezeChanges = uniqueNormalized(
    evidence.freeze_surface_changes ??
    evidence.changed_freeze_surfaces ??
    evidence.changed_files
  );
  const attestation = String(
    evidence.freeze_drift_attested ??
    evidence.freeze_surface_drift_attested ??
    ""
  ).trim().toLowerCase();

  if (changedFreezeSensitiveFiles.length === 0) {
    return ok({
      repo_root: normalizePath(resolvedRepoRoot),
      base_ref: baseRef,
      merge_base: mergeBase,
      changed_freeze_sensitive_files: [],
      evidence_path: normalizePath(evidencePath),
      manifest_path: normalizePath(manifestPath),
      reason: "No freeze-sensitive drift detected since merge-base.",
    });
  }

  if (attestation !== "true") {
    return fail(
      "Freeze-sensitive drift detected since merge-base but freeze drift evidence is not explicitly attested.",
      {
        path: normalizePath(evidencePath),
        changed_freeze_sensitive_files: changedFreezeSensitiveFiles,
      }
    );
  }

  for (const changedFile of changedFreezeSensitiveFiles) {
    if (!declaredFreezeChanges.includes(changedFile)) {
      return fail(
        `Freeze-sensitive file '${changedFile}' changed since merge-base without corresponding evidence entry.`,
        {
          path: normalizePath(evidencePath),
          changed_freeze_sensitive_files: changedFreezeSensitiveFiles,
        }
      );
    }
  }

  for (const declaredFile of declaredFreezeChanges) {
    if (!changedFreezeSensitiveFiles.includes(declaredFile)) {
      return fail(
        `Freeze drift evidence declares '${declaredFile}' but it is not changed since merge-base.`,
        {
          path: normalizePath(evidencePath),
          changed_freeze_sensitive_files: changedFreezeSensitiveFiles,
        }
      );
    }
  }

  return ok({
    repo_root: normalizePath(resolvedRepoRoot),
    base_ref: baseRef,
    merge_base: mergeBase,
    changed_freeze_sensitive_files: changedFreezeSensitiveFiles,
    evidence_path: normalizePath(evidencePath),
    manifest_path: normalizePath(manifestPath),
    attested: true,
  });
}

function main() {
  const args = process.argv.slice(2);

  if (args.length > 4) {
    process.stderr.write(
      JSON.stringify(
        fail(
          "Usage: node ci/scripts/run_freeze_drift_since_merge_base_verifier.mjs [baseRef] [manifestPath] [evidencePath] [repoRoot]"
        ),
        null,
        2
      ) + "\n"
    );
    process.exit(1);
  }

  const baseRef = String(args[0] ?? "origin/main").trim();
  const manifestPath = path.resolve(args[1] ?? DEFAULT_MANIFEST_PATH);
  const evidencePath = path.resolve(args[2] ?? DEFAULT_EVIDENCE_PATH);
  const repoRoot = path.resolve(args[3] ?? process.cwd());

  const result = verifyFreezeDrift({
    baseRef,
    manifestPath,
    evidencePath,
    repoRoot,
  });

  const target = result.ok ? process.stdout : process.stderr;
  target.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  DEFAULT_EVIDENCE_PATH,
  DEFAULT_MANIFEST_PATH,
  verifyFreezeDrift,
};