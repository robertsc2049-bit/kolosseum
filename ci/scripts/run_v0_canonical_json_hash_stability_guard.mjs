#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repoRoot = process.cwd();
const contractRel = "ci/contracts/v0_canonical_json_hash_stability_contract.json";
const contractPath = path.join(repoRoot, contractRel);

function fail(token, details) {
  process.stderr.write(JSON.stringify({ ok: false, token, details }, null, 2) + "\n");
  process.exitCode = 1;
}

function canonicalize(value) {
  if (value === null) return "null";

  if (Array.isArray(value)) {
    return "[" + value.map((item) => canonicalize(item)).join(",") + "]";
  }

  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return "{" + keys.map((key) => JSON.stringify(key) + ":" + canonicalize(value[key])).join(",") + "}";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("non_finite_number_not_canonical_json");
    }
    return JSON.stringify(value);
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  throw new Error("unsupported_json_value_type_" + typeof value);
}

function sha256HexLower(text) {
  return crypto.createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex");
}

if (!fs.existsSync(contractPath)) {
  fail("v0_canonical_hash_contract_missing", `Missing ${contractRel}`);
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

if (!Array.isArray(contract.source_candidates) || contract.source_candidates.length === 0) {
  fail("v0_canonical_hash_sources_missing", "No canonical/hash source candidates recorded.");
}

for (const rel of contract.source_candidates) {
  if (String(rel).includes("__tmp_")) {
    fail("v0_canonical_hash_temp_source_recorded", rel);
    continue;
  }

  const full = path.join(repoRoot, rel);

  if (!fs.existsSync(full)) {
    fail("v0_canonical_hash_source_missing", rel);
  }
}

const fixture = {
  z: "last",
  a: {
    c: null,
    b: [3, "two", false, { y: "yes", x: "ex" }]
  },
  n: 12.5,
  s: "Kolosseum",
  arr: [
    { beta: 2, alpha: 1 },
    null,
    true
  ]
};

const equivalentFixture = {
  arr: [
    { alpha: 1, beta: 2 },
    null,
    true
  ],
  s: "Kolosseum",
  n: 12.5,
  a: {
    b: [3, "two", false, { x: "ex", y: "yes" }],
    c: null
  },
  z: "last"
};

const differentFixture = {
  z: "last",
  a: {
    c: null,
    b: [3, "two", false, { y: "yes", x: "changed" }]
  },
  n: 12.5,
  s: "Kolosseum",
  arr: [
    { beta: 2, alpha: 1 },
    null,
    true
  ]
};

const repeatRuns = Number(contract.repeat_runs_required || 50);
const expectedCanonical = contract.fixture.canonical_json;
const expectedHash = contract.fixture.sha256_hex_lower;
const expectedDifferentCanonical = contract.fixture.different_canonical_json;
const expectedDifferentHash = contract.fixture.different_sha256_hex_lower;

for (let i = 0; i < repeatRuns; i++) {
  const canonical = canonicalize(fixture);
  const equivalentCanonical = canonicalize(equivalentFixture);
  const differentCanonical = canonicalize(differentFixture);

  const hash = sha256HexLower(canonical);
  const equivalentHash = sha256HexLower(equivalentCanonical);
  const differentHash = sha256HexLower(differentCanonical);

  if (canonical !== expectedCanonical || hash !== expectedHash) {
    fail("v0_canonical_hash_repeat_drift", { run: i, canonical, hash, expectedCanonical, expectedHash });
    break;
  }

  if (equivalentCanonical !== expectedCanonical || equivalentHash !== expectedHash) {
    fail("v0_canonical_hash_equivalent_key_order_drift", { run: i, equivalentCanonical, equivalentHash, expectedCanonical, expectedHash });
    break;
  }

  if (differentCanonical !== expectedDifferentCanonical || differentHash !== expectedDifferentHash) {
    fail("v0_canonical_hash_difference_drift", { run: i, differentCanonical, differentHash, expectedDifferentCanonical, expectedDifferentHash });
    break;
  }

  if (canonical === differentCanonical || hash === differentHash) {
    fail("v0_canonical_hash_value_difference_not_reflected", { run: i });
    break;
  }
}

if (
  contract.canonical_rules.object_keys !== "lexicographic_order" ||
  contract.canonical_rules.arrays !== "preserve_order" ||
  contract.canonical_rules.nested_objects !== "canonicalize_recursively" ||
  contract.canonical_rules.nulls !== "preserve_explicit_null" ||
  contract.canonical_rules.hash_algorithm !== "sha256_hex_lower_over_utf8_canonical_bytes"
) {
  fail("v0_canonical_hash_contract_rules_missing", contract.canonical_rules || null);
}

if (!process.exitCode) {
  process.stdout.write(JSON.stringify({
    ok: true,
    repeat_runs: repeatRuns,
    canonical_json: expectedCanonical,
    sha256_hex_lower: expectedHash,
    sources_checked: contract.source_candidates.length
  }, null, 2) + "\n");
}