<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S47 — Pilot Blocked Reason Registry

Status: v0 implementation slice  
Scope: paid coach pilot operator controls  
Engine impact: none  
Depends on: S45 coach-ready pilot acceptance pack, S46 pilot sign-off record

## Purpose

The Pilot Blocked Reason Registry defines the only blocked reasons operators may use when a paid coach pilot is not ready to proceed.

The registry prevents vague operator language and keeps pilot failure states closed-world, factual, and machine-checkable.

## Boundary

This registry is a platform/operator artefact.

It does not:

- alter engine legality
- alter compilation
- alter Phase 1 declarations
- alter session execution
- create coach authority
- create organisation, team, or gym runtime
- create analytics
- create messaging
- create export proof
- create evidence envelope semantics
- create medical, safety, optimisation, or advisory meaning

## Closed-world rule

Only blocked reason IDs listed in `pilot_blocked_reason_registry.json` may be used.

Unknown blocked reason IDs fail.

An empty blocked reason list fails when `final_status` is `blocked`.

A `coach_ready` sign-off must not contain blocked reasons.

## Required blocked reason IDs

The registry must contain exactly the required blocked reason IDs for S47:

- `payment_missing`
- `workspace_missing`
- `coach_account_inactive`
- `athlete_account_inactive`
- `coach_athlete_link_not_accepted`
- `scope_not_locked`
- `phase1_not_accepted`
- `compile_not_admitted`
- `first_session_missing`
- `factual_execution_not_proven`
- `split_return_not_proven_if_claimed`
- `partial_completion_not_proven_if_claimed`
- `coach_artefact_view_missing`
- `non_binding_note_missing`
- `history_counts_not_factual`
- `support_boundary_missing`
- `claim_guard_missing`
- `forbidden_surface_exposed`
- `source_artefact_missing`

No other blocked reason IDs are permitted.

## S45 readiness mapping rule

Every S45 readiness item must map to at least one blocked reason.

The registry carries this through `s45_readiness_item_mappings`.

Each mapping contains:

- `s45_readiness_item_id`
- `blocked_reason_ids`

The guard fails if:

- a S45 readiness item is not mapped
- a mapping points to an unknown blocked reason
- a mapping has an empty blocked reason list

## S45 negative boundary mapping rule

Every S45 negative boundary failure maps to:

- `forbidden_surface_exposed`

The registry carries this through `s45_negative_boundary_failure_mapping`.

The guard fails if any listed negative boundary maps to any reason other than `forbidden_surface_exposed`.

## S46 sign-off compatibility rule

S47 extends the S46 final-status semantics without changing S46.

Rules:

- `final_status: blocked` requires at least one known blocked reason
- `final_status: blocked` fails if any blocked reason is unknown
- `final_status: coach_ready` fails if any blocked reason is present

## Operator use

Operators must select blocked reasons from the registry only.

Operators must not invent free-text blocked reasons.

Corrections require a new append-only sign-off record under S46, using registry-controlled blocked reason IDs.

## Acceptance criteria

The guard must prove:

- Registry is closed-world.
- Every S45 readiness item maps to at least one blocked reason.
- Every S45 negative boundary failure maps to `forbidden_surface_exposed`.
- Unknown blocked reason fails.
- Empty blocked reason list fails when final_status is blocked.
- Coach Ready cannot include blocked reasons.
