# BETA-27 Projection and Evidence Export

## Status

BETA-27 implements byte-identical JSON export for stored Phase 7 projection artefacts and sealed Phase 8 EvidenceEnvelope artefacts.

It does not alter the Phase 7 projection law, BETA-26 sealed storage, the legacy S-V1-47 metadata export wrapper, or the S-V1-46 live proof-view permission contract.

## Phase 7 export

A Phase 7 output is validated before its canonical bytes are admitted to the export store.

Validation covers:

- the exact closed Phase 7 output fields;
- canonical rendered output;
- the projection hash;
- the projection identifier;
- the exact stored-byte checksum.

Export returns the already stored canonical Phase 7 bytes.

No regeneration occurs during export.

## Phase 8 export

Phase 8 evidence export calls the BETA-26 exact-byte export method.

BETA-26 verifies the stored-byte checksum and EvidenceEnvelope checksum before returning any bytes.

BETA-27 verifies those results again before delivery.

Export returns the exact sealed evidence bytes.

## Byte identity

Repeated export of the same artefact returns identical bytes and the same exact-byte checksum.

The API adapter places those exact bytes directly in the successful response body.

It does not parse or serialise the successful body.

## No export timestamp

No export timestamp is added to Phase 7 or Phase 8 artefact bytes.

Audit sequence identifiers are separate product-layer records and do not enter exported truth.

## No regeneration

Export never reruns Phase 7 projection, replay, RunnerVerdict generation, Phase 8 sealing, or envelope materialisation.

## No metadata mutation

Export cannot add, remove, rename, reorder, or replace fields inside stored artefact bytes.

Response headers and deterministic filenames remain outside the exported JSON bytes.

## Access policy

An `individual_user` may export only artefacts owned by that individual.

A coach may export only when all of the following are true:

- the relationship identifies the requesting coach;
- the relationship identifies the artefact owner;
- the relationship status is `active` or `archived`;
- the requested artefact type is present in `permitted_export_types`.

An active relationship permits current authorised export.

An archived relationship permits historical authorised export.

A revoked relationship is always blocked.

Pending, mismatched, or policy-excluded coach access is blocked.

An unauthorised individual is blocked.

This is an export-specific historical-access policy. It does not change the S-V1-46 live proof-view rule.

## Hash verification

Phase 7 validates:

- canonical projection bytes;
- stored-byte checksum;
- rendered-output canonicality;
- projection hash;
- record identifier and hash binding.

Phase 8 validates:

- exact stored-byte checksum;
- canonical sealed bytes;
- EvidenceEnvelope checksum;
- envelope identifier binding.

Any hash mismatch blocks delivery.

## Audit events

The service emits append-only events for:

- export requested;
- export delivered;
- export denied.

Audit events contain deterministic sequence identifiers and factual actor, artefact, and denial-token fields only.

## Transport boundary

A transport-only API adapter is included.

No live route is wired.

No UI link is added.

No database migration is added.

Future route, UI, and persistence work must preserve this exact-byte service contract.

## Proof

Run:

`npm.cmd run proof:beta-27`

The proof includes:

- repeated byte-identical Phase 7 export;
- repeated byte-identical sealed Phase 8 export;
- own-artifact access;
- active coach access;
- archived coach access;
- revoked coach denial;
- policy-excluded coach denial;
- unauthorised individual denial;
- projection hash mismatch denial;
- exact API response bytes;
- export requested, export delivered, and export denied audit events;
- manifest and v0 compatibility.
