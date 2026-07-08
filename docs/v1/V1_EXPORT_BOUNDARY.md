# S-V1-47 Export Boundary

## Purpose

S-V1-47 defines the permitted v1 proof export boundary.

The export surface is a read-only proof-layer surface over one permission-scoped proof artefact and its source evidence envelope.

## Boundary

Included:

- single proof artefact export
- evidence envelope reference export
- deterministic export payload hash
- immutable export result object
- neutral copy IDs
- API adapter for export requests

Not included:

- broad data export
- entity export
- roster export
- coach notes export
- raw runtime event export
- credential export
- external endorsement export
- programme judgement
- outcome status

## Invariants

- Export is permitted only where the v1 proof/export boundary permits it.
- Export requires an existing permission-scoped proof artefact.
- Export requires an accepted immutable evidence envelope.
- Export emits one deterministic payload object.
- Export never mutates the source proof artefact or envelope.
- Export includes no coach notes, raw runtime events, roster, entity, or broad data surface.
- Export states no coaching judgement and no outcome status.

## Contract files

- `src/v1ExportBoundaryContract.mjs`
- `src/api/v1ExportBoundaryApi.mjs`
- `copy/export_boundary_copy.json`

## Proof files

- `test/s_v1_47_export_boundary.test.mjs`
- `ci/guards/s_v1_47_export_boundary_guard.mjs`

## Standard proof sequence

Run:

- `node --test test/s_v1_47_export_boundary.test.mjs`
- `node ci/guards/s_v1_47_export_boundary_guard.mjs`
- `node ci/scripts/run_failure_token_index_guard.mjs --write`
- `node ci/scripts/run_failure_token_index_guard.mjs`
- `npm.cmd run guard:index`
- `node ci/guards/guards_index_guard.mjs`
- `npm.cmd run hash:write`
- `node ci/scripts/sha256_guard.mjs`
- `npm.cmd run lint:fast`