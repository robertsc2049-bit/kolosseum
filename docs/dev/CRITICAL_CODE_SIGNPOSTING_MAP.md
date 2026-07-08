# Critical Code Signposting Map

## Status

Accepted.

## Purpose

This map tells a future developer where to look first when trying to understand Kolosseum's critical boundaries.

It does not replace canonical roadmap or engine law documents.

## Primary rule

Canonical docs define law.

DEV NOTE comments explain boundaries.

Tests prove behaviour.

CI blocks drift.

## Current critical files

### v1 boundary and registry

- shared/v1-boundary/v1BoundaryGuards.mjs
- shared/v1-registry/v1RegistryDomainScaffold.mjs

Purpose:

- protect v1 activity boundary
- protect product-state and engine-state separation
- protect inert registry scaffold before content production

### coach notes and artefacts

- server/api/coachNotes.ts
- server/api/sessionArtefactViewer.ts

Purpose:

- keep coach notes product-only
- preserve factual artefact viewing
- avoid product notes becoming deterministic truth

### history read model

- server/history/historyCounts.access.ts
- server/history/historyCounts.contract.ts
- server/history/historyCounts.query.ts

Purpose:

- keep history outputs factual
- keep access checks separate from engine truth
- prevent interpretation drift

### pilot lifecycle and declaration gates

- shared/pilot-lifecycle/coachOperableGateContract.mjs
- shared/pilot-lifecycle/declarationAcceptanceStateSurface.mjs
- shared/pilot-lifecycle/onboardingStartGateContract.mjs
- shared/pilot-lifecycle/pilotLifecycleStateMachine.mjs
- shared/pilot-lifecycle/pilotStatusReasonCodes.mjs

Purpose:

- protect onboarding and declaration state transitions
- keep gate behaviour explicit
- avoid hidden inference or implicit acceptance

### presentation boundary

- shared/presentation/nd_mode_execution_surface.mjs

Purpose:

- keep presentation state separate from deterministic truth
- keep ND mode as a display/input burden reduction surface, not an engine mutation path

## Future critical files

When added, the following must receive DEV NOTE blocks:

- auth and relationship permission guards
- registry loader
- registry FK validators
- substitution engine
- runtime event reducer
- canonical JSON and hash functions
- replay/evidence/export layer
- copy registry helper
- free-tool import path
- no-coupling tests

## Handover expectation

A future developer should be able to open the files listed above and immediately see:

- what the file protects
- what state is forbidden
- what must stay deterministic
- what failure means