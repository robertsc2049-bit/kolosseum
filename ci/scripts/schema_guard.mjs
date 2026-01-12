import fs from "node:fs";
import path from "node:path";

const schemaPath = path.resolve("ci/schemas/phase1.input.schema.v1.0.0.json");
if (!fs.existsSync(schemaPath)) {
  console.error("CI_MISSING_HARD_FAIL: missing Phase 1 schema");
  process.exit(1);
}

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

if (schema.additionalProperties !== false) {
  console.error("CI_MISSING_HARD_FAIL: Phase 1 schema must set additionalProperties:false");
  process.exit(1);
}

console.log("schema_guard: OK");
