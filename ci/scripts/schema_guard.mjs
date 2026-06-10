import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { createRequire } from "node:module";

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

// Ajv2020 supports draft 2020-12, but DOES NOT preload draft-07 meta schema.
// This repo contains schemas that reference draft-07, so we must add that meta schema explicitly.
const require = createRequire(import.meta.url);
const draft7Meta = require("ajv/dist/refs/json-schema-draft-07.json");

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false
});

// Register draft-07 meta schema so Ajv2020 can compile/validate older schemas too.
ajv.addMetaSchema(draft7Meta);

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

// Phase 6 output schema (session)
addSchemaFile("ci/schemas/phase6.output.schema.v1.0.0.json");

// Evidence envelope + seal schemas (Phase 7/8 contract layer)
addSchemaFile("ci/schemas/evidence_envelope.schema.v1.0.0.json");
addSchemaFile("ci/schemas/evidence_seal.schema.v1.0.0.json");

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

// Validate Phase6 output fixture conforms to Phase6 schema
validateFixture(
  "phase6.output.schema.v1.0.0.json",
  "ci/fixtures/phase6.output.fixture.v1.0.0.json",
  "CI_SCHEMA_INVALID_PHASE6_OUTPUT"
);

// Validate Evidence Envelope fixture conforms to schema
validateFixture(
  "evidence_envelope.schema.v1.0.0.json",
  "ci/fixtures/evidence_envelope.fixture.v1.0.0.json",
  "CI_SCHEMA_INVALID_EVIDENCE_ENVELOPE"
);

// Validate Evidence Seal fixture conforms to schema
validateFixture(
  "evidence_seal.schema.v1.0.0.json",
  "ci/fixtures/evidence_seal.fixture.v1.0.0.json",
  "CI_SCHEMA_INVALID_EVIDENCE_SEAL"
);

console.log("schema_guard: OK");
