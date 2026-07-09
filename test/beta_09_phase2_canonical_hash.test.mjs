import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

let phase2Promise = null;

async function loadPhase2Fresh() {
  const sourcePath = path.join(process.cwd(), "engine", "src", "phases", "phase2.ts");
  const source = await fs.readFile(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  });
  const href = `data:text/javascript;base64,${Buffer.from(transpiled.outputText, "utf8").toString("base64")}`;
  const phase2Module = await import(href);
  assert.equal(typeof phase2Module.phase2CanonicaliseAndHash, "function");
  return phase2Module.phase2CanonicaliseAndHash;
}

async function loadPhase2() {
  phase2Promise ??= loadPhase2Fresh();
  return phase2Promise;
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

test("BETA-09 same Phase 1 bytes with different key order produce the same canonical bytes and hash", async () => {
  const phase2CanonicaliseAndHash = await loadPhase2();

  const first = phase2CanonicaliseAndHash('{"b":2,"legal_null":null,"list":[{"b":"two","a":"one"}],"a":{"z":null,"a":true}}');
  const second = phase2CanonicaliseAndHash('{"a":{"a":true,"z":null},"list":[{"a":"one","b":"two"}],"legal_null":null,"b":2}');

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

test("BETA-09 changed declared value changes the canonical hash", async () => {
  const phase2CanonicaliseAndHash = await loadPhase2();

  const powerlifting = phase2CanonicaliseAndHash({
    activity_id: "powerlifting",
    consent_granted: true,
    legal_null: null
  });
  const rugby = phase2CanonicaliseAndHash({
    activity_id: "rugby_union",
    consent_granted: true,
    legal_null: null
  });

  assertOk(powerlifting);
  assertOk(rugby);
  assert.notEqual(powerlifting.phase2.phase2_canonical_json, rugby.phase2.phase2_canonical_json);
  assert.notEqual(powerlifting.phase2.phase2_hash, rugby.phase2.phase2_hash);
});

test("BETA-09 downstream mutation causes byte/hash mismatch", async () => {
  const phase2CanonicaliseAndHash = await loadPhase2();
  const result = phase2CanonicaliseAndHash({
    activity_id: "general_strength",
    consent_granted: true,
    legal_null: null
  });

  assertOk(result);

  const mutatedBytes = new Uint8Array(result.phase2.canonical_input_json);
  const originalText = decode(mutatedBytes);
  const mutatedText = originalText.replace("general_strength", "powerlifting");
  const reencoded = new TextEncoder().encode(mutatedText);

  assert.notEqual(sha256Hex(reencoded), result.phase2.phase2_hash);
});

test("BETA-09 repeated canonicalisation is byte-identical", async () => {
  const phase2CanonicaliseAndHash = await loadPhase2();
  const input = {
    z: "last",
    a: "first",
    nested: {
      explicit_null: null,
      value: 1
    }
  };

  const first = phase2CanonicaliseAndHash(input);
  const second = phase2CanonicaliseAndHash(input);

  assertOk(first);
  assertOk(second);
  assert.equal(second.phase2.phase2_canonical_json, first.phase2.phase2_canonical_json);
  assert.equal(second.phase2.phase2_hash, first.phase2.phase2_hash);
  assert.deepEqual(Array.from(second.phase2.canonical_input_json), Array.from(first.phase2.canonical_input_json));
});

test("BETA-09 malformed JSON, unsupported values, and field-loss hazards fail before hashing", async () => {
  const phase2CanonicaliseAndHash = await loadPhase2();

  const trailingComma = phase2CanonicaliseAndHash('{"a":1,}');
  assert.equal(trailingComma.ok, false);
  assert.equal(trailingComma.failure_token, "phase2_canonicalise_failed");
  assert.equal(trailingComma.details.reason, "phase2_json_parse_failed");

  const comments = phase2CanonicaliseAndHash('{"a":1 // comment\n}');
  assert.equal(comments.ok, false);
  assert.equal(comments.failure_token, "phase2_canonicalise_failed");
  assert.equal(comments.details.reason, "phase2_json_parse_failed");

  const undefinedField = phase2CanonicaliseAndHash({
    a: 1,
    constraints: undefined
  });
  assert.equal(undefinedField.ok, false);
  assert.equal(undefinedField.failure_token, "phase2_canonicalise_failed");
  assert.equal(undefinedField.details.reason, "phase2_unsupported_value_refused");
});
