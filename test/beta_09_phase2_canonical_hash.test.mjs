import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function fail(reason, details) {
  const error = new Error(reason);
  error.reason = reason;
  error.details = details;
  throw error;
}

function canonicalise(value, pathParts = []) {
  if (value === null) return null;

  if (Array.isArray(value)) {
    return value.map((item, index) => canonicalise(item, [...pathParts, String(index)]));
  }

  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = canonicalise(value[key], [...pathParts, key]);
    }
    return out;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail("phase2-non-finite-number-refused", { path: pathParts.join(".") });
    }
    return value;
  }

  if (["string", "boolean"].includes(typeof value)) return value;

  fail("phase2-unsupported-value-refused", {
    path: pathParts.join("."),
    value_type: typeof value
  });
}

function phase2Probe(input) {
  try {
    const parsed = typeof input === "string" || input instanceof Uint8Array
      ? JSON.parse(Buffer.from(input).toString("utf8"))
      : input;
    const canonical = canonicalise(parsed);
    const canonicalJson = JSON.stringify(canonical);
    const bytes = new TextEncoder().encode(canonicalJson);
    const hash = sha256Hex(bytes);

    return {
      ok: true,
      phase2: {
        phase2_canonical_json: canonicalJson,
        phase2_hash: hash,
        canonical_input_json: bytes,
        canonical_input_hash: hash,
        hash_scope: "canonical_input_json",
        hash_algorithm: "sha256",
        hash_encoding: "lowercase_hex",
        canonical_json_encoding: "utf8"
      }
    };
  } catch (error) {
    return {
      ok: false,
      failure_token: "phase2_canonicalise_failed",
      details: {
        reason: error?.reason ?? "phase2-json-parse-failed",
        details: error?.details
      }
    };
  }
}

function sha256Hex(bytes) {
  return crypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

function decode(bytes) {
  return Buffer.from(bytes).toString("utf8");
}

function assertOk(result) {
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.phase2.hash_scope, "canonical_input_json");
  assert.equal(result.phase2.hash_algorithm, "sha256");
  assert.equal(result.phase2.hash_encoding, "lowercase_hex");
  assert.equal(result.phase2.canonical_json_encoding, "utf8");
  assert.match(result.phase2.phase2_hash, /^[a-f0-9]{64}$/u);
  assert.equal(result.phase2.canonical_input_hash, result.phase2.phase2_hash);
  assert.equal(decode(result.phase2.canonical_input_json), result.phase2.phase2_canonical_json);
  assert.equal(sha256Hex(result.phase2.canonical_input_json), result.phase2.phase2_hash);
}

test("BETA-09 Phase 2 source exposes exact canonical input byte hash scope", () => {
  const sourcePath = path.join(process.cwd(), "engine", "src", "phases", "phase2.ts");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /hash_scope: "canonical_input_json"/);
  assert.match(source, /hash_algorithm: "sha256"/);
  assert.match(source, /hash_encoding: "lowercase_hex"/);
  assert.match(source, /canonical_json_encoding: "utf8"/);
  assert.match(source, /TextDecoder\("utf-8", \{ fatal: true \}\)/);
  assert.match(source, /Object\.keys\(value\)\.sort\(\)/);
  assert.match(source, /phase2-unsupported-value-refused/);
  assert.doesNotMatch(source, /constraints\s*=\s*\{\}/);
});

test("BETA-09 same Phase 1 bytes with different key order produce the same canonical bytes and hash", () => {
  const first = phase2Probe('{"b":2,"legal_null":null,"list":[{"b":"two","a":"one"}],"a":{"z":null,"a":true}}');
  const second = phase2Probe('{"a":{"a":true,"z":null},"list":[{"a":"one","b":"two"}],"legal_null":null,"b":2}');

  assertOk(first);
  assertOk(second);

  const expectedCanonicalJson = '{"a":{"a":true,"z":null},"b":2,"legal_null":null,"list":[{"a":"one","b":"two"}]}';
  const expectedHash = "eb90f7c8b67bb6c1132f4db09abb07044a3b42e7c1e5f6032120dca62d27bd93";

  assert.equal(first.phase2.phase2_canonical_json, expectedCanonicalJson);
  assert.equal(first.phase2.phase2_hash, expectedHash);
  assert.equal(second.phase2.phase2_canonical_json, expectedCanonicalJson);
  assert.equal(second.phase2.phase2_hash, expectedHash);
  assert.deepEqual(Array.from(second.phase2.canonical_input_json), Array.from(first.phase2.canonical_input_json));
});

test("BETA-09 changed declared value changes the canonical hash", () => {
  const powerlifting = phase2Probe({
    activity_id: "powerlifting",
    consent_granted: true,
    legal_null: null
  });
  const rugby = phase2Probe({
    activity_id: "rugby_union",
    consent_granted: true,
    legal_null: null
  });

  assertOk(powerlifting);
  assertOk(rugby);
  assert.notEqual(powerlifting.phase2.phase2_canonical_json, rugby.phase2.phase2_canonical_json);
  assert.notEqual(powerlifting.phase2.phase2_hash, rugby.phase2.phase2_hash);
});

test("BETA-09 downstream mutation causes byte/hash mismatch", () => {
  const result = phase2Probe({
    activity_id: "general_strength",
    consent_granted: true,
    legal_null: null
  });

  assertOk(result);

  const originalText = decode(result.phase2.canonical_input_json);
  const mutatedText = originalText.replace("general_strength", "powerlifting");
  const reencoded = new TextEncoder().encode(mutatedText);

  assert.notEqual(sha256Hex(reencoded), result.phase2.phase2_hash);
});

test("BETA-09 repeated canonicalisation is byte-identical", () => {
  const input = {
    z: "last",
    a: "first",
    nested: {
      explicit_null: null,
      value: 1
    }
  };

  const first = phase2Probe(input);
  const second = phase2Probe(input);

  assertOk(first);
  assertOk(second);
  assert.equal(second.phase2.phase2_canonical_json, first.phase2.phase2_canonical_json);
  assert.equal(second.phase2.phase2_hash, first.phase2.phase2_hash);
  assert.deepEqual(Array.from(second.phase2.canonical_input_json), Array.from(first.phase2.canonical_input_json));
});

test("BETA-09 malformed JSON, unsupported values, and field-loss hazards fail before hashing", () => {
  const trailingComma = phase2Probe('{"a":1,}');
  assert.equal(trailingComma.ok, false);
  assert.equal(trailingComma.failure_token, "phase2_canonicalise_failed");
  assert.equal(trailingComma.details.reason, "phase2-json-parse-failed");

  const comments = phase2Probe('{"a":1 // comment\n}');
  assert.equal(comments.ok, false);
  assert.equal(comments.failure_token, "phase2_canonicalise_failed");
  assert.equal(comments.details.reason, "phase2-json-parse-failed");

  const undefinedField = phase2Probe({
    a: 1,
    constraints: undefined
  });
  assert.equal(undefinedField.ok, false);
  assert.equal(undefinedField.failure_token, "phase2_canonicalise_failed");
  assert.equal(undefinedField.details.reason, "phase2-unsupported-value-refused");
});
