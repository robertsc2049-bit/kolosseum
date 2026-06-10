import test from "node:test";
import assert from "node:assert/strict";

import { selectCanonicalHash } from "../dist/src/api/canonical_hash.js";

test("API canonical_hash: ignores caller-supplied canonical_hash by default", () => {
  const res = selectCanonicalHash({
    requested: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    phase2_hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    allow_override: false,
    expected_token: "secret",
    provided_token: "secret"
  });

  assert.equal(res.used_override, false);
  assert.equal(res.canonical_hash, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
});

test("API canonical_hash: ignores caller-supplied canonical_hash when token missing/mismatch", () => {
  const phase2 = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const requested = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  const miss = selectCanonicalHash({
    requested,
    phase2_hash: phase2,
    allow_override: true,
    expected_token: "secret",
    provided_token: undefined
  });
  assert.equal(miss.used_override, false);
  assert.equal(miss.canonical_hash, phase2);

  const mismatch = selectCanonicalHash({
    requested,
    phase2_hash: phase2,
    allow_override: true,
    expected_token: "secret",
    provided_token: "wrong"
  });
  assert.equal(mismatch.used_override, false);
  assert.equal(mismatch.canonical_hash, phase2);
});

test("API canonical_hash: allows override ONLY when explicitly enabled and token matches", () => {
  const res = selectCanonicalHash({
    requested: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    phase2_hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    allow_override: true,
    expected_token: "secret",
    provided_token: "secret"
  });

  assert.equal(res.used_override, true);
  assert.equal(res.canonical_hash, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
});