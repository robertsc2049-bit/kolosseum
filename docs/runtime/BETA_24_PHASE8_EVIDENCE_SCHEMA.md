# BETA-24 Phase 8 Evidence Schema

## Status

BETA-24 defines the closed-world beta `EvidenceEnvelope` JSON Schema.

This slice creates schema law only. It does not create Phase 8 runtime sealing, evidence regeneration, persistence, export, user-facing proof, or external attestation.

## EvidenceEnvelope

The envelope admits exactly these required fields:

- `evidence_envelope_id`
- `engine_version`
- `enum_bundle_version`
- `replay_suite_version`
- `canonical_input_hash`
- `selection_hash`
- `execution_trace_hash`
- `projection_hash`
- `runner_verdict_id`
- `runner_verdict_checksum_sha256`
- `runner_verdict`
- `phase5_output_checksum_sha256`
- `phase6_output_checksum_sha256`
- `phase7_output_checksum_sha256`
- `evidence_envelope_checksum_sha256`
- `evidence_scope`
- `limitations`
- `failure_tokens`

The schema sets `additionalProperties` to false.

All fields are required. Null values are not admitted.

## Runner verdict binding

`runner_verdict` is fixed to `ACCEPTED`.

The envelope requires the BETA-23 `runner_verdict_id` and `runner_verdict_checksum_sha256`.

A rejected replay does not produce an evidence envelope. Valid envelopes therefore carry an empty `failure_tokens` array.

## Phase output checksums

The schema requires canonical SHA-256 checksums for Phase 5, Phase 6, and Phase 7 outputs.

These checksums bind selected executable material, factual execution state, and factual projection output without embedding those payloads in the envelope.

`execution_trace_hash` separately binds the canonical execution trace.

## Evidence scope and limitations

`evidence_scope` is fixed to `process_verification_only`.

`limitations` is a closed ordered token list:

- `no_correctness_claim`
- `no_safety_claim`
- `no_suitability_claim`
- `no_effectiveness_claim`
- `no_outcome_quality_claim`
- `no_external_approval`

No narrative text is admitted.

## sealed_at

`sealed_at` is not admitted in BETA-24.

No canonical replay-safe clock contract exists in the beta proof layer. A timestamp would therefore introduce non-replay-safe metadata. Because the schema is closed, adding `sealed_at` fails as an extra field.

## Forbidden metadata

The envelope cannot contain:

- user narrative
- coach notes
- payment or commercial state
- organisation or organization metadata
- marketing copy
- arbitrary extra metadata

## No persistence

BETA-24 does not create or alter storage models.

The existing evidence activation and v1 envelope surfaces remain outside this schema-only implementation.

## Proof

Run:

`npm.cmd run proof:beta-24`

The proof covers:

- valid envelope;
- missing required field;
- extra field;
- invalid enum;
- illegal null;
- forbidden metadata;
- non-admission of `sealed_at`;
- exact manifest binding;
- v0 compatibility.
