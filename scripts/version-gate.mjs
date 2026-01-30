#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function logInfo(msg) {
  process.stdout.write(`INFO: ${msg}\n`);
}

function logError(msg) {
  process.stderr.write(`ERROR: ${msg}\n`);
}

function repoRoot() {
  return process.cwd();
}

function parseArgs(argv) {
  // Support: -Tag <x> or --tag <x> or --Tag=<x> or --tag=<x>
  let tag = "";
  for (let i = 0; i < argv.length; i++) {
    const a = String(argv[i] ?? "");
    const next = i + 1 < argv.length ? String(argv[i + 1] ?? "") : "";

    if (a === "-Tag" || a === "--Tag" || a === "--tag" || a === "-tag") {
      if (next && !next.startsWith("-")) tag = next;
      continue;
    }
    if (a.startsWith("--tag=") || a.startsWith("--Tag=")) {
      tag = a.split("=", 2)[1] ?? "";
      continue;
    }
  }
  return { tag };
}

function tagFromEnv() {
  // GitHub Actions standard envs
  const refType = String(process.env.GITHUB_REF_TYPE ?? "");
  const ref = String(process.env.GITHUB_REF ?? "");

  if (refType === "tag") {
    // On tag events, GITHUB_REF is refs/tags/<tag>
    if (ref.startsWith("refs/tags/")) return ref.slice("refs/tags/".length);
    return "";
  }

  // Fallback for other systems
  if (ref.startsWith("refs/tags/")) return ref.slice("refs/tags/".length);

  return "";
}

function normalizeTag(t) {
  const s = String(t ?? "").trim();
  if (!s) return "";
  return s;
}

function acceptableTagVariants(pkgVersion) {
  const v = String(pkgVersion ?? "").trim();
  if (!v) return [];
  return [`v${v}`, v];
}

function main() {
  const { tag: tagArg } = parseArgs(process.argv.slice(2));
  const envTag = tagFromEnv();

  const tag = normalizeTag(tagArg || envTag);

  if (!tag) {
    logInfo("No tag ref detected and no -Tag/--tag provided. Version gate skipped.");
    process.exit(0);
  }

  const pkgPath = path.join(repoRoot(), "package.json");
  if (!fs.existsSync(pkgPath)) {
    logError("package.json not found; cannot verify tag/version.");
    process.exit(2);
  }

  const pkg = readJson(pkgPath);
  const pkgVersion = String(pkg.version ?? "").trim();
  if (!pkgVersion) {
    logError("package.json version missing/empty; cannot verify tag/version.");
    process.exit(2);
  }

  const okTags = acceptableTagVariants(pkgVersion);
  if (!okTags.includes(tag)) {
    logError(
      `Tag/version mismatch. Tag='${tag}' package.json version='${pkgVersion}'. ` +
      `Expected tag to be one of: ${okTags.map(x => `'${x}'`).join(", ")}`
    );
    process.exit(3);
  }

  logInfo(`Version gate passed. Tag='${tag}' matches package.json version='${pkgVersion}'.`);
  process.exit(0);
}

main();
