import fs from "node:fs";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

function sha256FileHex(p) {
  const buf = fs.readFileSync(p);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function readUtf8NoBom(p) {
  let b = fs.readFileSync(p);
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) b = b.slice(3);
  return b.toString("utf8");
}

function writeUtf8NoBom(p, s) {
  fs.writeFileSync(p, s, "utf8"); // Node writes UTF-8 without BOM
}

function repinGoldenManifestGuard() {
  const manifestPath = "test/fixtures/golden/golden_manifest.v1.json";
  const guardPath = "ci/guards/golden_manifest_guard.mjs";

  const newSha = sha256FileHex(manifestPath);
  const guard = readUtf8NoBom(guardPath);

  // Expect the guard to contain: const PINNED_MANIFEST_SHA256="..."; OR with spaces
  const re = /(PINNED_MANIFEST_SHA256\s*=\s*")([a-f0-9]{64})(")/i;
  const m = guard.match(re);
  if (!m) {
    throw new Error(
      `Could not find PINNED_MANIFEST_SHA256 assignment in ${guardPath}. ` +
      `Expected something like: const PINNED_MANIFEST_SHA256="...";`
    );
  }

  const oldSha = m[2];
  if (oldSha.toLowerCase() === newSha.toLowerCase()) {
    console.log(`golden:update: PINNED_MANIFEST_SHA256 already up to date (${newSha})`);
    return { changed: false, oldSha, newSha };
  }

  const next = guard.replace(re, `$1${newSha}$3`);
  writeUtf8NoBom(guardPath, next);

  console.log(`golden:update: repinned PINNED_MANIFEST_SHA256`);
  console.log(`  old: ${oldSha}`);
  console.log(`  new: ${newSha}`);

  return { changed: true, oldSha, newSha };
}

const env = { ...process.env, UPDATE_GOLDEN: "1" };

// 1) Update expected fixtures via runner output
execSync("npm run e2e:golden", { stdio: "inherit", env });

// 2) Rebuild manifest json (paths + per-file hashes)
execSync("node ci/scripts/write_golden_manifest.mjs", { stdio: "inherit", env: process.env });

// 3) Repin guard to the new manifest bytes SHA
repinGoldenManifestGuard();

// 4) Prove repo is green after the whole workflow
execSync("npm run lint", { stdio: "inherit", env: process.env });

console.log("golden:update: done (fixtures + manifest + guard repin).");