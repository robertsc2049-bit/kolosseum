# BETA-22 Replay Verify Runner

## Status

BETA-22 adds a CI-owned verify runner over the committed BETA-21 Phase 1 through Phase 7 replay vectors.

The runner verifies existing fixtures only. It does not create, refresh, accept, record, or update replay fixtures.

## Verify-only boundary

The admitted command is:

`node ci/scripts/run_beta_22_replay_verify.mjs --verify`

## Update mode

The runner rejects:

- `--update`;
- `--write`;
- `--accept`;
- `--refresh`;
- `--record`;
- missing mode;
- unknown or combined modes.

The CI workflow retains read-only repository permissions.

CI cannot update fixtures.

## Explicit replay inputs

BETA-22 consumes:

- the committed BETA-21 vector suite;
- the committed BETA-21 vector manifest;
- explicit Phase 4 replay bindings;
- explicit Phase 7 projection identifiers and content format;
- committed expected Phase 1 through Phase 7 canonical output bytes;
- the BETA-22 verify manifest.

The runner does not select a Phase 4 fixture from activity data at verification time.

The required Phase 4 input is packaged explicitly in:

`replay/suite/beta_phase1_7/verify_inputs.json`

No missing field is inferred.

## Phase order

Every accepted vector executes exactly once per repeat in this order:

1. Phase 1 validation;
2. Phase 2 canonicalisation and hash;
3. Phase 3 registry resolution;
4. Phase 4 enumeration;
5. Phase 5 materialisation;
6. Phase 6 event-log validation and factual reduction;
7. Phase 7 factual projection and rendered-output hash.

No phase may be omitted or reordered.

## Byte-exact comparison

Expected Phase 1 through Phase 7 outputs are stored as canonical UTF-8 JSON strings in:

`replay/suite/beta_phase1_7/expected_outputs.json`

The verifier compares each generated canonical output string using direct string equality.

The BETA-21 Phase 5, Phase 6, reducer-state, Phase 7, and projection hashes are also checked.

A hash match does not replace the byte-exact comparison.

## Three-repeat rule

Every accepted vector is replayed exactly three times.

Each repeat uses the same committed:

- canonical Phase 1 input;
- engine and enum-bundle versions;
- schema and phase-contract pins;
- registry references;
- explicit Phase 4 input;
- canonical Phase 6 event log;
- Phase 7 projection binding.

All seven output byte strings must match:

- the committed expected bytes;
- the first repeat;
- every subsequent repeat.

## No mutation inference skip fallback or retry

BETA-22 records these boundaries as false:

- input mutation;
- missing-data inference;
- phase skipping;
- altered-input retry;
- fallback;
- fixture update.

Every phase receives a cloned copy of the same committed source data.

The original vector, binding, expected-output record, and committed replay files are checked for unchanged bytes.

A rejected phase is not retried with corrected or altered input.

## Verdicts

A positive vector returns:

`ACCEPTED`

A divergent or invalid replay returns:

`REJECTED`

The three BETA-21 negative shells remain `REJECTED` with their registered BETA-21 failure tokens and are not converted into accepted phase output.

The complete verify command succeeds only when all five positive vectors are accepted and all three negative shells remain rejected as declared.

## Failure tokens

The closed BETA-22 failure-token set is:

- `beta22_verify_mode_required`;
- `beta22_update_mode_forbidden`;
- `beta22_cli_argument_invalid`;
- `beta22_manifest_invalid`;
- `beta22_vector_invalid`;
- `beta22_pin_mismatch`;
- `beta22_replay_binding_invalid`;
- `beta22_phase_execution_failed`;
- `beta22_phase_output_missing`;
- `beta22_phase_output_divergence`;
- `beta22_input_mutation`;
- `beta22_repeat_divergence`;
- `beta22_phase_skipped`.

## Manifest

The verify manifest binds the exact bytes of:

- the BETA-22 verify contract;
- the BETA-22 failure-token contract;
- the BETA-21 vectors;
- the BETA-21 vector manifest;
- the BETA-22 explicit verify inputs;
- the BETA-22 expected output bytes.

## Claims boundary

Replay verification records deterministic process integrity only.

It does not establish correctness, training value, effectiveness, readiness, safety, suitability, recommendation, approval, or external certification.

## V0 compatibility

The v0 suite excludes only these exact BETA-22 replay files:

- `replay/contracts/beta22_replay_verify_contract.json`;
- `replay/contracts/beta22_replay_verify_failure_tokens.json`;
- `replay/suite/beta_phase1_7/verify_inputs.json`;
- `replay/suite/beta_phase1_7/expected_outputs.json`;
- `replay/suite/beta_phase1_7/verify_manifest.json`.

No replay directory, wildcard, suite-family, or broad beta exclusion is permitted.
