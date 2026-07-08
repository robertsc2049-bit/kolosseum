<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# v1 Entry Lane

## Status

The v1 entry lane is open for boundary-controlled planning and execution.

Opened at UTC: 2026-06-04T15:56:35Z

## v0 closure reference

v0 is closed.

Release tag: v0.1.24

Immutable release commit: 40cc391fcc92027dbcee8313dc571ea6557b8dec

v0 release lane closure commit: 8c2b9f688ba1403bc3dc3f8ca70b3ead7ba5b512

The v0.1.24 tag must not be moved, deleted, overwritten, or force-pushed.

Future v0 release evidence must not be added by changing the tag. Any future release must use a new package version and a new immutable tag.

## v1 definition

v1 is the complete coach-athlete product build.

v1 must remain inside the coach-athlete product boundary unless explicitly reprioritised.

v1 includes:

- coach account flow
- athlete account flow
- coach-athlete relationship model
- lawful Phase 1 onboarding and declaration
- locked supported activities
- full v1 exercise registry for supported activities
- full v1 equipment registry for supported activities
- programme template system
- programme assignment
- deterministic compile path
- substitution engine coverage
- mobile session execution UI
- split and return
- partial completion
- factual history
- coach factual artefact view
- coach notes kept engine-invisible
- copy/legal claims boundary
- replay/proof/export where lawful and explicitly scoped
- auth and permissions
- CI/no-coupling proof

## Not v1 unless explicitly reprioritised

The following remain outside v1:

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
- new sports beyond the locked supported activity set
- media, merch, education, or event marketplace surfaces

## First v1 lane

The first v1 lane is boundary-first, not feature-first.

First lane:

1. confirm v1 product boundary
2. confirm supported activities
3. confirm v1 registry expansion target
4. confirm coach-athlete journey map
5. confirm data model freeze point
6. confirm engine/UI/auth boundary
7. confirm post-v1 exclusion list

No implementation slice should start before this lane is accepted.

## Guardrails

Do not alter v0 release tag.

Do not alter package version.

Do not create another release tag.

Do not change engine behaviour in this lane.

Do not introduce v1 feature implementation in this lane.

This document opens the v1 entry lane only.
