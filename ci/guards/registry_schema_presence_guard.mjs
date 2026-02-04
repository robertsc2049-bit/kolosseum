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

function main() {
  const indexPath = path.join("registries", "registry_index.json");
  if (!fs.existsSync(indexPath)) die(`registry_schema_presence_guard: missing ${indexPath}`);

  const index = readJson(indexPath);
  if (!index || typeof index !== "object") die("registry_schema_presence_guard: registry_index must be an object");
  if (!Array.isArray(index.order)) die("registry_schema_presence_guard: registry_index.order must be an array");

  const missing = [];
  for (const name of index.order) {
    if (typeof name !== "string" || name.trim() === "") {
      die("registry_schema_presence_guard: registry_index.order contains a non-string/empty entry");
    }
    const schemaPath = path.join("ci", "schemas", `${name}.registry.schema.json`);
    if (!fs.existsSync(schemaPath)) missing.push(schemaPath);
  }

  if (missing.length) {
    die(
      "registry_schema_presence_guard: missing registry schema(s):\n" +
      missing.map((p) => ` - ${p}`).join("\n") +
      "\nFix: add schema files under ci/schemas named <registry>.registry.schema.json for every registry_index.order entry."
    );
  }

  console.log("OK: registry_schema_presence_guard");
}

main();
