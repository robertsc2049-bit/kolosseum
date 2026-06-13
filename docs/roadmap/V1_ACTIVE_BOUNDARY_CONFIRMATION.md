# S-V1-01 Active v1 Boundary Confirmation

Status: active boundary confirmed
Phase: Boundary and repo law foundation
Release: v1 - First Lawful Run

## Purpose

This artefact confirms the active v1 boundary in repo-readable form.

S-V1-01 does not implement product capability. It binds the release boundary so later v1 slices have one explicit repo surface to check before adding proof, export, coach-athlete, registry, or UI work.

## Active v1 boundary

v1 includes the First Lawful Run boundary.

The active v1 boundary includes:

- Phase 7 truth projection as a v1 release capability.
- Phase 8 evidence sealing as a v1 release capability.
- Export artefacts only where bound to v1 acceptance.
- Coach-athlete product work only where later v1 slices explicitly activate it.
- Registry, UI, auth, and proof surfaces only where later v1 slices bind them.

## Non-scope for S-V1-01

This slice does not add:

- Engine runtime behaviour.
- Phase order changes.
- Registry payload entries.
- Product payment logic.
- Coach-athlete workflow screens.
- Organisation, team, unit, or gym runtime execution.
- Export implementation.
- Evidence implementation.

## Invariants

S-V1-01 preserves engine isolation.

Product state, payment state, UI state, presentation state, notes, and commercial state must not alter engine truth.

All user-facing language remains controlled by copy and claim-boundary gates.

The v0 boundary is not reopened by this slice.

## Machine-readable binding

The matching machine-readable artefact is:

docs/roadmap/V1_ACTIVE_BOUNDARY_CONFIRMATION.json

CI guard:

ci/guards/s_v1_01_active_boundary_confirmation_guard.mjs
