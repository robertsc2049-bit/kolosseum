# BETA-26 Evidence Immutability

## Status

BETA-26 introduces the canonical append-only proof-layer store for sealed evidence bytes.

BETA-24 remains the closed EvidenceEnvelope schema authority.

BETA-25 remains the chain-validation and seal-authorisation authority.

BETA-26 materialises and stores a complete EvidenceEnvelope only after the BETA-25 gate passes.

## Lawful creation path

The only lawful creation path is:

1. BETA-25 validates Phase 5, Phase 6, Phase 7, and RunnerVerdict bindings.
2. CL passed.
3. CI passed.
4. Replay verdict is accepted.
5. Pre-seal state is inactive.
6. BETA-26 internally materialises the complete envelope.
7. BETA-26 writes the exact canonical bytes once.

No caller supplies sealed evidence bytes to the lawful seal method.

Manual creation is denied.

A partial envelope is denied.

## Immutable sealed evidence bytes

The store writes canonical UTF-8 JSON bytes once.

The record contains:

- `evidence_envelope_id`
- `sealed_bytes`
- `sealed_bytes_checksum_sha256`

The record is frozen and remains private inside the store.

Update after sealing is denied.

Delete after sealing is denied because no explicit legal or admin deletion path exists.

Regeneration after a failed or successful seal attempt is denied.

## Envelope checksum

The envelope checksum is SHA-256 over canonical envelope material with the `evidence_envelope_checksum_sha256` field omitted.

The stored-byte checksum is SHA-256 over the exact stored UTF-8 bytes.

Both checksums are verified on every read.

A checksum mismatch fails closed and returns no evidence.

## Export-time mutation

A normal export returns the exact stored bytes and exact stored-byte checksum.

Any export option that requests replacement, transformation, reformatting, regeneration, or mutation is denied.

The export operation cannot rewrite or reserialise the envelope.

## Audit events

The store emits append-only machine events for:

- seal attempt;
- seal success;
- seal denial;
- mutation denial.

Audit events have deterministic sequence identifiers and contain no timestamps, narrative, coach notes, payment state, organisation metadata, or marketing copy.

## Failed seal attempts

A failed seal attempt reserves the deterministic envelope identity as failed.

The same evidence identity cannot be retried or regenerated after CL refusal, CI failure, rejected replay, chain failure, checksum failure, manual creation attempt, or partial creation attempt.

## Existing v1 surfaces

The existing v1 evidence activation builder remains unchanged.

The existing v1 export boundary remains unchanged.

No database migration is added because no established DB-backed evidence storage surface currently exists.

No API route is added because no established evidence write route currently exists.

A future database adapter must preserve the same append-only exact-byte and checksum-on-read contract.

## Proof

Run:

`npm.cmd run proof:beta-26`

The proof covers:

- successful complete sealing;
- read checksum verification;
- update denial;
- delete denial;
- manual creation denial;
- partial envelope denial;
- regeneration denial after failure;
- regeneration denial after success;
- checksum mismatch;
- export-time mutation denial;
- exact export bytes;
- required audit events;
- manifest and v0 compatibility.
