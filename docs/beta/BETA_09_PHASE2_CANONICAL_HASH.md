<!-- DEV NOTE: BETA-09 Phase 2 canonical hash record. This document records deterministic canonicalisation and hashing boundaries only; it does not change Phase 1 acceptance, registry law, replay authority, evidence authority, or downstream engine semantics. -->

# BETA-09 Phase 2 Canonical Hash

Status: beta contract record.

## Purpose

BETA-09 hardens Phase 2 canonicalisation and SHA256 hashing over exact canonical Phase 1 JSON bytes.

## Boundary

Phase 2 canonicalisation and hashing only.

BETA-09 does not create defaults, mutate Phase 1 acceptance, change registry law, create replay or evidence authority, or alter downstream engine semantics.

## Canonicalisation rules

Phase 2 must:

- accept UTF-8 JSON bytes or explicit already-parsed values
- reject malformed JSON, including trailing commas and comments, for byte/string input
- sort object keys lexicographically at every object level
- preserve array order
- emit JSON with no insignificant whitespace
- preserve explicit legal `null`
- preserve empty arrays and empty objects
- refuse unsupported values that JSON serialisation would drop or coerce, including `undefined`, functions, symbols, bigint values, and non-finite numbers
- avoid defaults, field removal, and value coercion

## Hash rules

Phase 2 hash scope is exactly `canonical_input_json` bytes.

The hash algorithm is SHA256.

The hash encoding is lowercase hexadecimal.

Downstream mutation must be detectable because any mutation to canonical bytes changes the recomputed hash.

## Machine proof

Machine-checkable implementation and proof:

- `engine/src/phases/phase2.ts`
- `test/beta_09_phase2_canonical_hash.test.mjs`
- `ci/contracts/canonical_hash_api_ci_cluster.json`

## Replay boundary

Repeated canonicalisation of the same accepted input must produce byte-identical canonical JSON and the same lowercase SHA256 hash.
