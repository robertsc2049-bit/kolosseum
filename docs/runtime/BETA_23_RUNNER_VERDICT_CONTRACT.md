# BETA-23 Runner Verdict Contract

## Status

BETA-23 defines the stable machine-readable `RunnerVerdict` output consumed by a later Phase 8 sealing check.

## RunnerVerdict

Each replay vector produces exactly one object with these fields:

- `runner_verdict_id`
- `runner_verdict_checksum_sha256`
- `verdict`
- `canonical_input_hash`
- `selection_hash`
- `projection_hash`
- `replayed_phase_scope`
- `engine_version`
- `enum_bundle_version`
- `replay_suite_version`
- `failure_tokens`

No other field is admitted.

## Canonical checksum

The checksum algorithm is SHA-256 over canonical UTF-8 JSON containing every RunnerVerdict field except `runner_verdict_checksum_sha256`.

The identifier is derived independently from canonical UTF-8 JSON containing the verdict material without the identifier and checksum.

The checksum verifies recorded verdict bytes only. It does not create an external approval or a correctness claim.

## ACCEPTED

An `ACCEPTED` RunnerVerdict must contain:

- a canonical input hash;
- a Phase 5 selection hash;
- a Phase 7 projection hash;
- the exact ordered replay scope `phase1` through `phase7`;
- an empty `failure_tokens` array;
- the pinned engine, enum bundle, and replay suite versions.

A claimed full scope is rejected unless BETA-22 recorded exactly one attempt for every phase in every required repeat.

## REJECTED

A `REJECTED` RunnerVerdict must contain:

- a canonical input hash;
- `null` selection and projection hashes because the negative shell was not replayed;
- an empty `replayed_phase_scope`;
- at least one permitted closed failure token;
- the pinned engine, enum bundle, and replay suite versions.

A rejected shell cannot claim replayed phases or output hashes.

## No narrative

RunnerVerdict contains no message, description, explanation, advice, recommendation, scoring, readiness, safety, suitability, or correctness field.

## Phase 8 boundary

BETA-23 supplies a stable checksum-bearing dependency for Phase 8.

It does not implement Phase 8, create an evidence envelope, activate external attestation, mutate engine output, or change replay inputs.

## Proof

Run:

`npm.cmd run proof:beta-23`

The proof covers accepted output, rejected output, checksum mismatch, dishonest scope, missing required fields, exact schema closure, manifest binding, and CLI output.
