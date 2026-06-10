# v1 Supported Activities Decision Record

## Status

Accepted.

Recorded at UTC: 2026-06-04T15:58:30Z

## Context

The v0 release lane is closed.

The v1 entry lane is open.

v0 release tag: v0.1.24

Immutable v0 release commit: 40cc391fcc92027dbcee8313dc571ea6557b8dec

v1 entry lane commit: 79eb2a5d194fa5c8776eeb04093889dc7f810f08

The v0.1.24 tag must not be moved, deleted, overwritten, or force-pushed.

This decision records v1 supported activities only. It does not implement registry expansion, templates, UI, auth, billing, proof, export, or commercial surfaces.

## Decision

v1 supported activities are locked to:

1. powerlifting
2. general_strength
3. rugby_union

These are the only supported activities for v1 unless a later explicit decision record replaces this one.

## Rationale

This is the tightest credible v1 set.

It preserves the current deterministic activity spine while allowing the coach-athlete product to become commercially usable without widening into too many sport-specific registries.

The set covers:

- powerlifting-specific strength programming
- general strength programming
- one concrete field/team sport pathway through rugby_union

This gives enough product proof to test the coach-athlete workflow, registry coverage, substitution behaviour, programme assignment, session execution, factual history, and coach review surfaces without exploding scope.

## Explicit v1 exclusions

The following activities are not supported in v1:

- strongman
- bodybuilding
- weightlifting
- combat sports
- running
- cycling
- swimming
- tactical or uniformed-force-specific activity packs
- youth-specific sport variants
- rehabilitation-specific activity packs
- additional team sports
- additional individual sports

These may be considered after v1 only through a new decision record, registry plan, substitution coverage plan, template plan, copy/legal review, and CI proof.

## Product boundary

v1 is a coach-athlete product.

This decision does not add:

- organisations
- teams
- gyms
- units
- federations
- marketplace
- messaging
- full commercial dashboards
- gym access
- EPOS
- enterprise billing
- broad analytics
- media, merch, education, or event marketplace surfaces

## Registry implication

The v1 registry expansion target must cover the locked activity set only.

Registry work must include:

- activity registry coverage for powerlifting, general_strength, and rugby_union
- exercise registry coverage for the locked activity set
- equipment registry coverage for the locked activity set
- exercise-to-activity applicability
- movement pattern coverage
- substitution edge coverage
- programme template compatibility
- copy/legal boundary review
- deterministic registry law checks

No registry item may imply support for an excluded activity.

## Template implication

Programme templates for v1 must only target:

- powerlifting
- general_strength
- rugby_union

Templates must not imply support for excluded sports or broader organisation/gym/team products.

## Copy and claims boundary

Public and in-product copy may say that v1 supports powerlifting, general strength, and rugby union.

Copy must not claim support for strongman, bodybuilding, weightlifting, combat sports, tactical populations, youth sport, rehabilitation pathways, or broad team-sport coverage.

Copy must not describe the activity set as comprehensive, universal, complete for all sports, or suitable for every athlete.

## Guardrails

Do not alter v0 release tag.

Do not alter package version.

Do not create another release tag.

Do not change engine behaviour in this slice.

Do not add implementation code in this slice.

Do not add registry content in this slice.

Do not add templates in this slice.

Do not widen v1 beyond the locked activity set.

## Next lane

The next lane is v1 registry expansion target planning.

That lane must define the exact registry coverage required for:

- powerlifting
- general_strength
- rugby_union

No implementation slice should begin until the registry expansion target is accepted.