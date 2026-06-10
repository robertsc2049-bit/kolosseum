# S48 — Pilot Readiness Evaluator

Status: v0 implementation slice  
Scope: paid coach pilot operator evaluation  
Engine impact: none  
Depends on: S45 coach-ready pilot acceptance pack, S46 pilot sign-off record, S47 pilot blocked reason registry

## Purpose

The Pilot Readiness Evaluator is a pure function that derives the final pilot status from checklist result data.

It returns one of:

- `coach_ready`
- `blocked`

The evaluator does not store records. It does not sign records. It does not create timestamps. It does not read from a database. It does not use the network.

## Input

The evaluator accepts a single input object containing:

- `readiness_item_results`
- `negative_boundary_results`
- `source_artefact_refs`

Each readiness item result contains:

- `item_id`
- `passed`
- `source_artefact_ref_ids`

Each negative boundary result contains:

- `boundary_id`
- `passed`
- `source_artefact_ref_ids`

Each source artefact reference contains:

- `artefact_ref_id`

The evaluator treats all IDs as closed-world.

## Output

The evaluator returns exactly:

- `final_status`
- `blocked_reasons`
- `missing_readiness_ids`
- `failed_readiness_ids`
- `missing_negative_boundary_ids`
- `failed_negative_boundary_ids`
- `missing_source_artefact_ids`

## Deterministic rules

The evaluator returns `blocked` if any of the following are true:

- a required readiness item is missing
- any readiness item is failed
- a negative boundary item is missing
- any negative boundary item is failed
- a source artefact reference is missing
- an unknown readiness item ID is present
- an unknown negative boundary ID is present

The evaluator returns `coach_ready` only when:

- every required readiness item is present
- every readiness item passed
- every required negative boundary item is present
- every negative boundary item passed
- all item source artefact references resolve
- no unknown item IDs are present
- no blocked reasons are present

## Blocked reason derivation

The evaluator maps blocked states to S47 blocked reason IDs.

Readiness failures map through the S47 readiness mapping.

Negative boundary failures map to:

- `forbidden_surface_exposed`

Missing or unresolved source artefacts map to:

- `source_artefact_missing`

Unknown item IDs map to:

- `forbidden_surface_exposed`

## Prohibited behaviour

The evaluator must not:

- read from storage
- call external services
- generate timestamps
- use randomness
- mutate input
- infer missing data
- produce user-facing advice
- produce sales or outcome claims
- alter engine behaviour

## Acceptance criteria

Tests must prove:

- all-pass input returns `coach_ready`
- missing required readiness item returns `blocked`
- failed readiness item returns `blocked`
- missing negative boundary item returns `blocked`
- failed negative boundary item returns `blocked`
- missing source artefact returns `blocked`
- unknown readiness item returns `blocked`
- unknown negative boundary item returns `blocked`
- evaluator does not mutate input
- evaluator source contains no database, network, timestamp, or randomness dependency