"use strict";

const fs = require("node:fs");
const path = require("node:path");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function main() {
  const indexPath = path.join("registries", "registry_index.json");
  const index = readJson(indexPath);

  if (!index || typeof index !== "object") throw new Error("bundle_writer: registry_index must be an object");
  if (typeof index.version !== "string" || index.version.trim() === "") throw new Error("bundle_writer: registry_index.version must be string");
  if (!Array.isArray(index.order)) throw new Error("bundle_writer: registry_index.order must be array");

  const registries = {};
  for (const name of index.order) {
    const p = path.join("registries", name, `${name}.registry.json`);
    if (!fs.existsSync(p)) throw new Error(`bundle_writer: missing registry file: ${p}`);
    registries[name] = readJson(p);
  }

  const out = {
    version: index.version,
    note: "generated bundle (do not hand edit)",
    registries
  };

  const outPath = path.join("registries", "registry_bundle.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log("bundle_writer: wrote", outPath);
  console.log("bundle_writer: keys:", Object.keys(registries).sort().join(","));
}

main();
