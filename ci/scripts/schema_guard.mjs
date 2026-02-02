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

function addSchemaFile(rel) {
  const schemaPath = path.join(repoRoot, rel);
  if (!fs.existsSync(schemaPath)) {
    fail(`schema_guard: CI_MISSING_HARD_FAIL: schema missing: ${rel}`);
  }
  const schema = readJson(schemaPath);
  ajv.addSchema(schema, path.basename(rel));
}

function validateFixture(schemaName, fixtureRel, failureToken) {
  const fixturePath = path.join(repoRoot, fixtureRel);
  if (!fs.existsSync(fixturePath)) {
    fail(`schema_guard: CI_MISSING_HARD_FAIL: fixture missing: ${fixtureRel}`);
  }
  const obj = readJson(fixturePath);
  const ok = ajv.validate(schemaName, obj);
  if (!ok) {
    fail(`schema_guard: ${failureToken}: ${JSON.stringify(ajv.errors, null, 2)}`);
  }
}

// Phase 1 schema
addSchemaFile("ci/schemas/phase1.input.schema.v1.0.0.json");

// Exercise registry schema
addSchemaFile("ci/schemas/exercise.registry.schema.v1.0.0.json");

// Phase 4 output schema (program)
addSchemaFile("ci/schemas/phase4.output.schema.v1.0.0.json");

// Validate exercise registry file exists + conforms
{
  const registryPath = path.join(repoRoot, "registries", "exercise", "exercise.registry.json");
  if (!fs.existsSync(registryPath)) {
    fail(`schema_guard: CI_MISSING_HARD_FAIL: registry missing: ${path.relative(repoRoot, registryPath)}`);
  }
  const reg = readJson(registryPath);
  const ok = ajv.validate("exercise.registry.schema.v1.0.0.json", reg);
  if (!ok) {
    fail(`schema_guard: CI_SCHEMA_INVALID_EXERCISE_REGISTRY: ${JSON.stringify(ajv.errors, null, 2)}`);
  }
}

// Validate Phase4 output fixture conforms to Phase4 schema
validateFixture(
  "phase4.output.schema.v1.0.0.json",
  "ci/fixtures/phase4.output.fixture.v1.0.0.json",
  "CI_SCHEMA_INVALID_PHASE4_OUTPUT"
);

console.log("schema_guard: OK");