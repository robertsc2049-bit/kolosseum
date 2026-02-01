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
    return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString("utf8").trim();
  } catch (e) {
    const stderr = (e && e.stderr ? String(e.stderr) : "").trim();
    const stdout = (e && e.stdout ? String(e.stdout) : "").trim();
    return { ok: false, stdout, stderr };
  }
}

function execOrDie(cmd, failMsg) {
  const r = tryExec(cmd);
  if (typeof r === "string") return r;
  die(`${failMsg}\ncmd=${cmd}\nstdout=${r.stdout || "(empty)"}\nstderr=${r.stderr || "(empty)"}`);
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
  const ref = String(process.env.GITHUB_REF || "").trim();
  if (ref.startsWith("refs/tags/")) return ref.slice("refs/tags/".length);

  // local/manual fallback: only returns something if HEAD is exactly tagged
  const r = tryExec("git describe --tags --exact-match HEAD");
  if (typeof r === "string" && r) return r;

  return "";
}

function currentCommitForTagCheck() {
  // In Actions, this is the commit being built.
  const sha = String(process.env.GITHUB_SHA || "").trim();
  if (sha) return sha;

  // local fallback
  return execOrDie("git rev-parse HEAD", "[ERR] tag_version_guard: failed to read HEAD sha");
}

const repoRoot = process.cwd();
const tag = detectTagName();

// Not a tag build -> no-op
if (!tag) {
  console.log("[OK] tag_version_guard: no tag detected (branch build).");
  process.exit(0);
}

// Enforce v-prefixed tags
if (!tag.startsWith("v")) {
  die(`[ERR] tag_version_guard: tag must start with 'v' (got '${tag}'). Expected 'v<package.json version>'.`);
}

// 1) Tag name must match package version
const pkgVersion = readPkgVersion(repoRoot);
const expectedTag = `v${pkgVersion}`;
if (tag !== expectedTag) {
  die(
    `[ERR] tag_version_guard: version/tag mismatch.\n` +
      `package.json version=${pkgVersion}\n` +
      `tag=${tag}\n` +
      `expected tag=${expectedTag}\n` +
      `Fix: bump version and tag correctly. Immutable tags mean you must use a new version tag if one already exists.`
  );
}

// 2) Tag must point at the commit being built (exact-match)
const commit = currentCommitForTagCheck();

// Ensure tags exist locally (Actions often checks out shallow)
tryExec("git fetch --tags --force --prune origin"); // best-effort; failures will surface below if needed

const exact = tryExec(`git describe --tags --exact-match ${commit}`);
if (typeof exact !== "string" || !exact) {
  const hint =
    "Hint: ensure your CI checkout fetches tags + full history (actions/checkout fetch-depth: 0, fetch-tags: true).";
  die(
    `[ERR] tag_version_guard: commit is not exactly tagged.\n` +
      `commit=${commit}\n` +
      `expected exact tag=${tag}\n` +
      `${hint}`
  );
}

if (exact !== tag) {
  die(
    `[ERR] tag_version_guard: tag does not match the exact tag on commit.\n` +
      `commit=${commit}\n` +
      `GITHUB_REF tag=${tag}\n` +
      `git describe exact tag=${exact}\n` +
      `Fix: create the correct tag on this commit, or rebuild from the commit the tag points to.`
  );
}

console.log(`[OK] tag_version_guard: tag matches package.json and commit (${tag} @ ${commit}).`);
