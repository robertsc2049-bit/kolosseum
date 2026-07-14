# BETA-21 Replay Vector Envelope

## Status

BETA-21 packages deterministic beta replay vectors for Phase 1 through Phase 7 verification.

The suite extends the existing `CVE-1.0.0` structure as:

`BETA-CVE-1.0.0`

The existing v0 replay vector and S-V1-44 replay boundary are not modified.

## Boundary

BETA-21 adds replay data, validation, generation, tests, documentation, and CI only.

It does not change Phase 1 through Phase 7 implementation, registry content, runtime behaviour, product state, or coach-note handling.

Every vector records:

`implementation_mutation_allowed: false`

## Positive vectors

The suite contains exactly five positive vectors:

1. individual powerlifting;
2. individual general strength;
3. coach-managed rugby union;
4. split return continue;
5. partial completion.

Coach-managed execution remains athlete execution truth.

## Negative shells

The suite contains exactly three negative shells:

1. replay divergence;
2. invalid failure token;
3. missing phase output.

Negative shells contain the expected failure token and no accepted Phase 5, Phase 6, or Phase 7 output hash.

## Canonical Phase 1 input

Every vector contains canonical Phase 1 input and its Phase 2 SHA-256 binding.

The coach-managed rugby-union vector includes an explicit governing-authority identifier required by the Phase 1 schema.

Product authentication, payment state, UI state, coach notes, and organisation state are not replay inputs.

## Phase 3 and Phase 4 binding

The existing Phase 1 schema does not admit BETA-10 candidate exercise fields.

BETA-21 therefore packages Phase 4 verification using the existing BETA-11 structural fixtures, rebound to the current canonical Phase 1 hash and current registry references.

This is replay packaging only. It does not mutate Phase 3 or Phase 4 implementation.

## Pins

Each vector pins:

- engine version;
- enum-bundle version;
- schema IDs and versions;
- Phase 1 through Phase 7 contract versions;
- active registry-index version, path, and SHA-256;
- Phase 3 loaded-registry snapshot version and SHA-256.

## Expected output hashes

Positive vectors contain:

- canonical Phase 5 output hash;
- canonical Phase 6 output hash;
- Phase 6 reducer-state hash;
- canonical Phase 7 output hash;
- Phase 7 projection hash.

All hashes are lowercase SHA-256 values.

## Deterministic generation

The generator is:

`ci/scripts/generate_beta_21_replay_vectors.mjs`

Write mode:

`node ci/scripts/generate_beta_21_replay_vectors.mjs --write`

Check mode:

`node ci/scripts/generate_beta_21_replay_vectors.mjs --check`

Check mode rebuilds the suite using the existing Phase 1 through Phase 7 contracts and compares exact committed bytes.

The manifest binds the complete `vectors.json` file by SHA-256.

## Failure tokens

The closed BETA-21 failure-token set is:

- `beta21_replay_divergence`;
- `beta21_invalid_failure_token`;
- `beta21_missing_phase_output`.

No vector may invent another expected failure token.

## Claims boundary

Replay records process integrity only.

BETA-21 does not create certification, correctness, training-value, approval, recommendation, safety, suitability, or performance claims.

## V0 compatibility

The v0 suite excludes only these exact files:

- `replay/contracts/beta21_replay_vector_envelope.schema.json`;
- `replay/contracts/beta21_replay_failure_tokens.json`;
- `replay/suite/beta_phase1_7/vectors.json`;
- `replay/suite/beta_phase1_7/manifest.json`.

No replay directory, wildcard, suite-family, or broad beta exclusion is permitted.
