<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# v1 Implementation Readiness Checklist

## Status

Accepted as a planning target.

Recorded at UTC: 2026-06-04T16:38:26Z

## Context

The v0 release lane is closed.

The v1 entry lane is open.

The v1 supported activities decision is locked.

The v1 registry expansion target is accepted.

The v1 coach-athlete journey map is accepted.

The v1 data model freeze point is accepted.

The v1 engine/UI/auth boundary is accepted.

v0 release tag: v0.1.24

Immutable v0 release commit: 40cc391fcc92027dbcee8313dc571ea6557b8dec

v1 engine/UI/auth boundary commit: 6f1ea55d1d0007549cb49b9115b0542e9ae18759

The v0.1.24 tag must not be moved, deleted, overwritten, or force-pushed.

This document defines readiness conditions for beginning v1 implementation. It does not add implementation code, database migrations, registry content, templates, UI, auth, billing, proof, export, or commercial surfaces.

## Purpose

The purpose of this checklist is to prevent premature implementation.

v1 implementation must not begin until the first implementation slice has a narrow contract, known boundaries, exact proof, and no hidden expansion into post-v1 surfaces.

The first implementation slice must be boundary-first, test-first, and small enough to review.

## Implementation may begin only when

Implementation may begin only when all of the following are true:

- v0 release tag remains immutable
- v1 supported activities remain locked
- v1 registry target is accepted
- v1 coach-athlete journey is accepted
- v1 data model freeze point is accepted
- v1 engine/UI/auth boundary is accepted
- first implementation slice has a written contract
- first implementation slice has explicit invariants
- first implementation slice has exact proof commands
- first implementation slice has rollback-safe scope
- first implementation slice does not widen v1
- first implementation slice does not add post-v1 surfaces
- lint:fast passes before and after the slice

## Locked v1 supported activities

Implementation must remain limited to:

1. powerlifting
2. general_strength
3. rugby_union

No implementation slice may add, imply, seed, expose, copy, or test support for excluded activities unless a later accepted decision record changes the supported set.

## Required implementation order

The first implementation sequence should be:

1. boundary guard scaffolding
2. registry schema target hardening
3. locked activity set guard
4. excluded activity negative tests
5. known registry id validation
6. data model skeleton planning into migrations only after guard coverage
7. auth/relationship permission guard skeleton
8. coach note engine-invisibility proof
9. programme assignment relationship proof
10. session/runtime reference proof

Do not start with dashboard UI.

Do not start with commercial pages.

Do not start with broad registry content.

Do not start with auth provider integration before permission contracts exist.

Do not start with templates before registry and copy boundaries are guardable.

## First implementation slice target

The first implementation slice should be:

S18 - v1 boundary guard scaffolding

Purpose:

- create explicit boundary guard placeholders/helpers where safe
- prove boundary names exist
- prove no implementation surface uses them to widen scope yet
- establish test naming and failure-token pattern for v1 boundary work

The first implementation slice must not create active product flows.

The first implementation slice must not create database migrations.

The first implementation slice must not add registry content.

The first implementation slice must not add templates.

The first implementation slice must not add UI screens.

## Required guard functions

Future implementation should introduce guard functions where appropriate:

- assertCoachCanViewAthlete
- assertCoachCanAssignProgramme
- assertAthleteOwnsDeclaration
- assertRelationshipIsActive
- assertEngineInputIsCanonical
- assertNoCoachNoteInEngineInput
- assertNoBillingStateInEngineInput
- assertNoUiStateInEngineInput
- assertRegistryIdIsKnown
- assertActivityIsV1Supported
- assertSubstitutionEdgeIsAllowed
- assertCopyIdExists
- assertLiveViewIsReadOnly

S18 may create scaffolding for a subset of these if it remains non-invasive and test-backed.

## Required CI proof categories

Implementation slices must progressively prove:

- auth state does not enter engine input
- relationship state gates access but does not alter engine output
- coach notes cannot enter engine input
- billing/commercial state cannot enter engine input
- UI state cannot enter engine input
- live coach viewing cannot mutate session state
- coach cannot trigger substitution from live view
- substitution cannot use inferred readiness/fatigue/risk
- proof/replay output is unchanged by coach notes
- proof/replay output is unchanged by billing/commercial state
- copy guard rejects forbidden claim language
- unsupported activities remain excluded
- templates remain inside locked supported activities
- registry references reject unknown ids
- no post-v1 surface enters active v1 flows

## Required implementation-slice contract

Every implementation slice must state:

- slice id
- purpose
- files expected to change
- files forbidden to change
- invariants
- proof commands
- rollback notes
- scope exclusions
- relationship to v1 roadmap docs

No implementation slice may proceed without this contract.

## Files forbidden by default

Unless the slice explicitly justifies them, v1 implementation slices must not modify:

- package version
- release tags
- v0 release evidence
- v0 release closure record
- post-v1 scope documents
- commercial pricing documents
- organisation/team/gym/federation surfaces
- marketplace surfaces
- messaging/chat/video surfaces
- EPOS or gym access surfaces
- production deployment settings

## Engine boundary readiness

Before any product flow calls the engine, the repo must prove:

- engine input is canonical
- engine input excludes coach notes
- engine input excludes billing state
- engine input excludes UI presentation state
- engine input excludes auth session state
- engine input uses only known registry ids
- engine input uses only locked supported activities
- engine output is not mutated by product state
- replay/proof output is not mutated by product state

## Auth and relationship readiness

Before coach or athlete UI depends on permissions, the repo must prove:

- unauthenticated users cannot access private product records
- coach can access only active accepted athlete relationships
- coach cannot access pending invite athlete data
- coach cannot assign programme without active accepted relationship
- coach cannot mutate athlete declarations
- athlete controls own Phase 1 declaration
- revoked relationships remove active coach access
- relationship state remains outside engine truth

## Registry readiness

Before registry expansion content is added, the repo must prove:

- locked supported activity set is enforced
- excluded activities are refused
- unknown registry ids are refused
- movement pattern ids are known
- exercise ids are known
- equipment ids are known
- substitution edge ids are known
- registry output is deterministic
- copy/legal boundary can reject forbidden claims

## Template readiness

Before templates are added, the repo must prove:

- template activity id is one of powerlifting, general_strength, rugby_union
- template references only known exercises
- template references only known equipment
- template references only known copy ids
- template copy does not use forbidden claims
- template does not imply excluded activity support
- template does not imply organisation/team/gym product support

## UI readiness

Before UI screens are added, the repo must prove:

- UI state cannot enter engine input
- UI can render factual states without mutating them
- UI cannot hide deterministic failures as success
- UI copy can be checked against forbidden claim language
- unsupported activity refusal exists conceptually
- coach live viewing is read-only
- coach notes remain engine-invisible

## Data model readiness

Before database migrations are added, the repo must prove or document:

- target data group
- ownership boundary
- permission boundary
- engine visibility status
- retention/audit expectation
- references to known entities
- forbidden coupling to engine truth
- tests expected for the migration

No migration should be added just because the data model freeze document exists.

## Copy/legal readiness

Before public or in-product copy is added, the repo must prove:

- copy id exists where required
- copy category is known
- forbidden claim language is rejected
- unsupported activity claims are rejected
- medical, safety, readiness, fatigue, risk, diagnosis, optimisation, and guarantee language is blocked
- copy does not imply support for excluded surfaces

## Post-v1 excluded surfaces

Implementation must not add active support for:

- organisations
- teams
- gyms
- units
- federations
- marketplace
- messaging
- chat
- video
- EPOS
- gym access
- enterprise billing
- broad analytics
- public coach marketplace
- team dashboards
- organisation dashboards
- automatic programme optimisation
- automatic progression
- diagnosis
- injury risk scoring
- readiness scoring
- fatigue scoring

Placeholder references must not create active functionality or product claims.

## Stop conditions

Stop implementation and repair the lane if any slice:

- moves the v0 release tag
- changes package version without explicit release slice
- adds unsupported activity support
- adds registry content before registry guards
- adds templates before template guards
- adds UI before permission and copy boundaries
- adds migrations before data model proof
- lets coach notes enter engine input
- lets billing or commercial state enter engine input
- lets UI state enter engine input
- adds marketplace, messaging, organisation, gym, federation, EPOS, or broad analytics scope
- weakens lint:fast
- bypasses guard failures instead of fixing them

## Required local proof before push

Every implementation slice must run at minimum:

- npm.cmd run lint:fast

Additional proof commands must be added when a slice touches tests, build, engine, registry, API, auth, DB, or UI.

For implementation slices, avoid broad raw test commands unless the repo's composed wrappers require them.

## Acceptance criteria

S17 is accepted when:

- this document exists
- implementation readiness conditions are defined
- first implementation slice target is defined
- required guard functions are listed
- CI proof categories are listed
- implementation-slice contract is defined
- forbidden files are listed
- engine boundary readiness is defined
- auth and relationship readiness is defined
- registry readiness is defined
- template readiness is defined
- UI readiness is defined
- data model readiness is defined
- copy/legal readiness is defined
- post-v1 excluded surfaces are listed
- stop conditions are defined
- no implementation code is added
- no database migration is added
- no registry content is added
- no template content is added
- no package version is changed
- no tag is created or moved
- lint:fast passes

## Guardrails

Do not alter v0 release tag.

Do not alter package version.

Do not create another release tag.

Do not change engine behaviour in this slice.

Do not add implementation code in this slice.

Do not add database migrations in this slice.

Do not add registry content in this slice.

Do not add templates in this slice.

Do not widen v1 beyond powerlifting, general_strength, and rugby_union.

## Next lane

The next lane is S18 - v1 boundary guard scaffolding.

S18 is the first implementation-adjacent slice, but it must remain narrow and guard-first.
