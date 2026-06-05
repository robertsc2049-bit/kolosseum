# S-DEV-NOTES - critical code comment baseline

## Status

Accepted as a developer handover slice.

Recorded at UTC: 2026-06-05T08:40:02Z

## Context

The v0 release lane is closed.

S21 created the inert v1 registry domain scaffold.

v0 release tag: v0.1.24

Immutable v0 release commit: 40cc391fcc92027dbcee8313dc571ea6557b8dec

v1 registry domain scaffold commit: 66174067776b95bfe1bf30f3ad103f1299c7ddd9

The v0.1.24 tag must not be moved, deleted, overwritten, or force-pushed.

This slice adds a critical code comment policy, a signposting map, targeted DEV NOTE blocks, and a CI guard. It does not add product features, registry content records, templates, UI screens, database migrations, package version changes, or tags.

## Purpose

A future developer should be able to open the repo, identify the critical boundaries, and understand why the boundary code exists without needing the founder present.

The goal is not comment volume. The goal is durable signposting at the files that protect determinism, registry truth, product boundaries, and handover safety.

## Rule

Canonical docs define law.

DEV NOTE comments explain boundaries.

Tests prove behaviour.

CI blocks drift.

## Acceptance criteria

S-DEV-NOTES is accepted when:

- docs/dev/CODE_COMMENT_POLICY.md exists
- docs/dev/CRITICAL_CODE_SIGNPOSTING_MAP.md exists
- ci/guards/dev_note_comment_policy_guard.mjs exists
- the guard is indexed in docs/GUARDS_INDEX.md
- package.json invokes the guard through lint:fast
- critical boundary files contain DEV NOTE blocks
- DEV NOTE blocks include Purpose, Boundary, Determinism, and Failure
- DEV NOTE blocks avoid forbidden claim and marketing language
- no registry content records are added
- no template records are added
- no UI screen is added
- no database migration is added
- no package version is changed
- no tag is created or moved
- lint:fast passes

## Guardrails

Do not alter v0 release tag.

Do not alter package version.

Do not create another release tag.

Do not add database migrations in this slice.

Do not add registry content records in this slice.

Do not add templates in this slice.

Do not add UI screens in this slice.

Do not widen v1 beyond powerlifting, general_strength, and rugby_union.

## Next lane

Return to S22 - v1 registry content production contract when ready.