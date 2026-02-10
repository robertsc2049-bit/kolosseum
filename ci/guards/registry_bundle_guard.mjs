// @law: Registry Law
// @severity: high
// @scope: registry
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function readUtf8(p) {
  return fs.readFileSync(p, "utf8");
}

function readJson(p) {
  return JSON.parse(readUtf8(p));
}

function buildBundle() {
  const indexPath = path.join("registries", "registry_index.json");
  const index = readJson(indexPath);

  if (!index || typeof index !== "object") die("registry_bundle_guard: registry_index must be an object");
  if (typeof index.version !== "string" || index.version.trim() === "") die("registry_bundle_guard: registry_index.version must be a non-empty string");
  if (!Array.isArray(index.order)) die("registry_bundle_guard: registry_index.order must be an array");

  const registries = {};
  for (const name of index.order) {
    if (typeof name !== "string" || name.trim() === "") die("registry_bundle_guard: registry_index.order contains a non-string/empty entry");
    const p = path.join("registries", name, `${name}.registry.json`);
    if (!fs.existsSync(p)) die(`registry_bundle_guard: missing registry file: ${p}`);
    registries[name] = readJson(p);
  }

  const out = {
    version: index.version,
    note: "generated bundle (do not hand edit)",
    registries
  };

  return JSON.stringify(out, null, 2) + "\n";
}

function main() {
  const bundlePath = path.join("registries", "registry_bundle.json");
  if (!fs.existsSync(bundlePath)) {
    die(
      "registry_bundle_guard: missing registries/registry_bundle.json\n" +
      "Fix: npm run registry:bundle (or node scripts/bundle_writer.cjs) and commit the result."
    );
  }

  const expected = buildBundle();
  const actual = readUtf8(bundlePath);

  if (actual !== expected) {
    die(
      "registry_bundle_guard: registries/registry_bundle.json is out of date (does not match generated output)\n" +
      "Fix: npm run registry:bundle (or node scripts/bundle_writer.cjs) then commit the updated bundle."
    );
  }

  console.log("OK: registry_bundle_guard");
}

main();
