import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const TOKEN = {
  VERSION_MISMATCH: "CI_REGISTRY_SEAL_VERSION_MISMATCH",
  HASH_MISMATCH: "CI_REGISTRY_SEAL_HASH_MISMATCH",
  SIGNATURE_INVALID: "CI_REGISTRY_SEAL_SIGNATURE_INVALID",
  STRUCTURE_INVALID: "CI_REGISTRY_STRUCTURE_INVALID",
  SEAL_ID_COLLISION: "CI_REGISTRY_SEAL_ID_COLLISION"
};

function sha256HexFromBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sha256HexFromString(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function fail(token, details, extras = {}) {
  const payload = {
    ok: false,
    token,
    details,
    ...extras
  };
  process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(1);
}

function readJsonFile(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    fail(TOKEN.STRUCTURE_INVALID, `Unable to read ${label} at '${filePath}': ${error.message}`);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(TOKEN.STRUCTURE_INVALID, `Invalid JSON in ${label} at '${filePath}': ${error.message}`);
  }
}

function validateSchemaObject(schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    fail(TOKEN.STRUCTURE_INVALID, "Schema file must contain a JSON object.");
  }

  if (schema.additionalProperties !== false) {
    fail(TOKEN.STRUCTURE_INVALID, "Schema must set additionalProperties=false.");
  }

  if (!Array.isArray(schema.required) || schema.required.length === 0) {
    fail(TOKEN.STRUCTURE_INVALID, "Schema must declare a non-empty required array.");
  }

  if (!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) {
    fail(TOKEN.STRUCTURE_INVALID, "Schema must declare properties.");
  }
}

function validateSealAgainstSchema(seal, schema) {
  if (!seal || typeof seal !== "object" || Array.isArray(seal)) {
    fail(TOKEN.STRUCTURE_INVALID, "Seal record must be a JSON object.");
  }

  const allowedKeys = new Set(Object.keys(schema.properties));
  const requiredKeys = schema.required;

  for (const key of requiredKeys) {
    if (!(key in seal)) {
      fail(TOKEN.STRUCTURE_INVALID, `Seal record missing required field '${key}'.`, { path: key });
    }
  }

  for (const key of Object.keys(seal)) {
    if (!allowedKeys.has(key)) {
      fail(TOKEN.STRUCTURE_INVALID, `Seal record contains unknown field '${key}'.`, { path: key });
    }
  }

  for (const [key, rule] of Object.entries(schema.properties)) {
    if (!(key in seal)) {
      continue;
    }

    const value = seal[key];

    if (rule.const !== undefined && value !== rule.const) {
      fail(TOKEN.STRUCTURE_INVALID, `Field '${key}' must equal '${rule.const}'.`, { path: key });
    }

    if (rule.type === "string" && typeof value !== "string") {
      fail(TOKEN.STRUCTURE_INVALID, `Field '${key}' must be a string.`, { path: key });
    }

    if (typeof rule.minLength === "number" && typeof value === "string" && value.length < rule.minLength) {
      fail(TOKEN.STRUCTURE_INVALID, `Field '${key}' must have minLength ${rule.minLength}.`, { path: key });
    }

    if (rule.pattern && typeof value === "string") {
      const regex = new RegExp(rule.pattern);
      if (!regex.test(value)) {
        fail(TOKEN.STRUCTURE_INVALID, `Field '${key}' failed pattern validation.`, { path: key });
      }
    }

    if (rule.format === "date-time" && typeof value === "string") {
      const parsed = Date.parse(value);
      if (Number.isNaN(parsed)) {
        fail(TOKEN.STRUCTURE_INVALID, `Field '${key}' must be a valid date-time string.`, { path: key });
      }
    }
  }
}

function buildSignaturePayload(seal) {
  return {
    schema_version: seal.schema_version,
    seal_id: seal.seal_id,
    seal_version: seal.seal_version,
    registry_bundle_hash: seal.registry_bundle_hash,
    created_at: seal.created_at,
    engine_compatibility: seal.engine_compatibility,
    enum_bundle_version: seal.enum_bundle_version,
    seal_scope: seal.seal_scope
  };
}

function parseArgs(argv) {
  const args = {
    schemaPath: "ci/schemas/registry_seal.v1.schema.json",
    bundlePath: "registries/registry_bundle.json",
    sealPath: "ci/evidence/registry_seal.v1.json",
    expectedSealId: null,
    expectedSealVersion: null,
    compareSealPath: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--schema") {
      args.schemaPath = argv[++i];
      continue;
    }

    if (token === "--bundle") {
      args.bundlePath = argv[++i];
      continue;
    }

    if (token === "--seal") {
      args.sealPath = argv[++i];
      continue;
    }

    if (token === "--expected-seal-id") {
      args.expectedSealId = argv[++i];
      continue;
    }

    if (token === "--expected-seal-version") {
      args.expectedSealVersion = argv[++i];
      continue;
    }

    if (token === "--compare-seal") {
      args.compareSealPath = argv[++i];
      continue;
    }

    fail(TOKEN.STRUCTURE_INVALID, `Unknown CLI argument '${token}'.`);
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const schemaPath = path.resolve(args.schemaPath);
  const bundlePath = path.resolve(args.bundlePath);
  const sealPath = path.resolve(args.sealPath);

  const schema = readJsonFile(schemaPath, "schema");
  validateSchemaObject(schema);

  const seal = readJsonFile(sealPath, "seal");
  validateSealAgainstSchema(seal, schema);

  const bundleBytes = fs.readFileSync(bundlePath);
  const actualBundleHash = sha256HexFromBuffer(bundleBytes);

  if (seal.registry_bundle_hash !== actualBundleHash) {
    fail(
      TOKEN.HASH_MISMATCH,
      "Registry bundle hash does not match seal record.",
      {
        expected_registry_bundle_hash: seal.registry_bundle_hash,
        actual_registry_bundle_hash: actualBundleHash,
        seal_id: seal.seal_id,
        seal_version: seal.seal_version
      }
    );
  }

  if (args.expectedSealId !== null && seal.seal_id !== args.expectedSealId) {
    fail(
      TOKEN.SEAL_ID_COLLISION,
      `Seal ID mismatch: expected '${args.expectedSealId}', got '${seal.seal_id}'.`,
      {
        expected_seal_id: args.expectedSealId,
        actual_seal_id: seal.seal_id,
        seal_version: seal.seal_version
      }
    );
  }

  if (args.expectedSealVersion !== null && seal.seal_version !== args.expectedSealVersion) {
    fail(
      TOKEN.VERSION_MISMATCH,
      `Seal version mismatch: expected '${args.expectedSealVersion}', got '${seal.seal_version}'.`,
      {
        expected_seal_version: args.expectedSealVersion,
        actual_seal_version: seal.seal_version,
        seal_id: seal.seal_id
      }
    );
  }

  const signaturePayload = buildSignaturePayload(seal);
  const canonicalSignaturePayload = canonicalize(signaturePayload);
  const actualSignature = sha256HexFromString(canonicalSignaturePayload);

  if (seal.signature !== actualSignature) {
    fail(
      TOKEN.SIGNATURE_INVALID,
      "Seal signature is invalid.",
      {
        expected_signature: seal.signature,
        actual_signature: actualSignature,
        seal_id: seal.seal_id,
        seal_version: seal.seal_version
      }
    );
  }

  if (args.compareSealPath !== null) {
    const compareSeal = readJsonFile(path.resolve(args.compareSealPath), "comparison seal");
    validateSealAgainstSchema(compareSeal, schema);

    if (
      compareSeal.seal_id === seal.seal_id &&
      compareSeal.seal_version === seal.seal_version &&
      compareSeal.registry_bundle_hash !== seal.registry_bundle_hash
    ) {
      fail(
        TOKEN.SEAL_ID_COLLISION,
        "Two seals share the same (seal_id, seal_version) but bind different registry bundle hashes.",
        {
          seal_id: seal.seal_id,
          seal_version: seal.seal_version,
          left_registry_bundle_hash: seal.registry_bundle_hash,
          right_registry_bundle_hash: compareSeal.registry_bundle_hash
        }
      );
    }
  }

  const result = {
    ok: true,
    seal_id: seal.seal_id,
    seal_version: seal.seal_version,
    registry_bundle_hash: actualBundleHash,
    engine_compatibility: seal.engine_compatibility,
    enum_bundle_version: seal.enum_bundle_version,
    seal_scope: seal.seal_scope
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();