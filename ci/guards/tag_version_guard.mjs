import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function tryExec(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8").trim();
  } catch {
    return "";
  }
}

function readPkgVersion(repoRoot) {
  const p = path.join(repoRoot, "package.json");
  let raw;
  try {
    raw = readFileSync(p, "utf8");
  } catch {
    die(`[ERR] tag_version_guard: missing package.json at ${p}`);
  }
  let pkg;
  try {
    pkg = JSON.parse(raw);
  } catch {
    die(`[ERR] tag_version_guard: failed to parse package.json JSON at ${p}`);
  }
  const v = String(pkg && pkg.version ? pkg.version : "").trim();
  if (!v) die("[ERR] tag_version_guard: package.json missing version");
  return v;
}

function detectTagName() {
  // Prefer GitHub Actions ref if present
  const ref = String(process.env.GITHUB_REF || "").trim();
  if (ref.startsWith("refs/tags/")) return ref.slice("refs/tags/".length);

  // Fallback for local/manual runs
  const exact = tryExec("git describe --tags --exact-match");
  if (exact) return exact;

  return "";
}

const repoRoot = process.cwd();
const tag = detectTagName();

// Not a tag build -> no-op
if (!tag) {
  console.log("[OK] tag_version_guard: no tag detected (branch build).");
  process.exit(0);
}

// Enforce v-prefixed semver tags only (your repo already uses v0.x.y)
if (!tag.startsWith("v")) {
  die(`[ERR] tag_version_guard: tag must start with 'v' (got '${tag}'). Expected 'v<package.json version>'.`);
}

const pkgVersion = readPkgVersion(repoRoot);
const expectedTag = `v${pkgVersion}`;

if (tag !== expectedTag) {
  die(
    `[ERR] tag_version_guard: version/tag mismatch.\n` +
      `package.json version=${pkgVersion}\n` +
      `tag=${tag}\n` +
      `expected tag=${expectedTag}\n` +
      `Fix: bump version (npm version --no-git-tag-version) and tag correctly, or recreate the release with a new version.`
  );
}

console.log(`[OK] tag_version_guard: tag matches package.json (${tag}).`);
