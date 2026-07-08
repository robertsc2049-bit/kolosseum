# S-DEV-FUNCTION-NOTES - exported boundary function documentation

## Status

Accepted as a developer handover slice.

Recorded at UTC: 2026-06-05T08:46:52Z

## Context

The v0 release lane is closed.

S-DEV-NOTES added file-level DEV NOTE blocks, code comment policy, a critical signposting map, and CI enforcement.

v0 release tag: v0.1.24

Immutable v0 release commit: 40cc391fcc92027dbcee8313dc571ea6557b8dec

DEV NOTES commit: b8dd0a8bdaef306eea185bd03bc35dd2fde8a6e7

The v0.1.24 tag must not be moved, deleted, overwritten, or force-pushed.

This slice adds function/export-level documentation to critical boundary entrypoints. It does not add product features, registry content records, templates, UI screens, database migrations, package version changes, or tags.

## Purpose

A future developer should be able to open a critical boundary file and understand what each exported entrypoint does, what it accepts, what it returns or refuses, and what boundary it must preserve.

The goal is practical handover. The goal is not comment volume.

## Required function note shape

FUNCTION NOTE:

- Export
- Purpose
- Inputs
- Output
- Boundary
- Determinism
- Failure

## Scope

This slice covers exported functions and exported const entrypoints in critical boundary files.

It does not document private helpers unless they become boundary entrypoints.

## Guardrails

Canonical docs define law.

DEV NOTE comments explain file boundaries.

FUNCTION NOTE comments explain exported entrypoints.

Tests prove behaviour.

CI blocks drift.

## Acceptance criteria

S-DEV-FUNCTION-NOTES is accepted when:

- docs/dev/FUNCTION_DOCUMENTATION_POLICY.md exists
- docs/roadmap/DEV_FUNCTION_NOTES_BASELINE.md exists
- ci/guards/dev_function_note_policy_guard.mjs exists
- the guard is indexed in docs/GUARDS_INDEX.md
- package.json invokes the guard through lint:fast
- exported functions and exported const entrypoints in critical boundary files have FUNCTION NOTE blocks
- FUNCTION NOTE blocks include Export, Purpose, Inputs, Output, Boundary, Determinism, and Failure
- FUNCTION NOTE blocks avoid forbidden claim and marketing language
- no registry content records are added
- no template records are added
- no UI screen is added
- no database migration is added
- no package version is changed
- no tag is created or moved
- lint:fast passes

## Next lane

Return to S22 - v1 registry content production contract when ready.