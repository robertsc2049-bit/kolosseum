import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";

function stripBom(s) {
  return s.length > 0 && s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

function readJson(p) {
  const raw = stripBom(fs.readFileSync(p, "utf8"));
  return JSON.parse(raw);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const repoRoot = process.cwd();

const ajv = new Ajv({
  allErrors: true,
  strict: true,
  strictRequired: false
});

// Phase 1 schema
{
  const schemaPath = path.join(repoRoot, "ci", "schemas", "phase1.input.schema.v1.0.0.json");
  const schema = readJson(schemaPath);
  ajv.addSchema(schema, "phase1.input.schema.v1.0.0.json");
}

// Exercise registry schema
{
  const schemaPath = path.join(repoRoot, "ci", "schemas", "exercise.registry.schema.v1.0.0.json");
  const schema = readJson(schemaPath);
  ajv.addSchema(schema, "exercise.registry.schema.v1.0.0.json");
}

// Validate exercise registry file exists + conforms
{
  const registryPath = path.join(repoRoot, "registries", "exercise", "exercise.registry.json");
  if (!fs.existsSync(registryPath)) {
    fail(`schema_guard: CI_MISSING_HARD_FAIL: registry missing: ${path.relative(repoRoot, registryPath)}`);
  }
  const reg = readJson(registryPath);
  const ok = ajv.validate("exercise.registry.schema.v1.0.0.json", reg);
  if (!ok) {
    fail(
      `schema_guard: CI_SCHEMA_INVALID_EXERCISE_REGISTRY: ${JSON.stringify(ajv.errors, null, 2)}`
    );
  }
}

console.log("schema_guard: OK");
