# V0 Completion Gate Manifest

Status: authoritative v0 completion gate manifest.
Slice coverage: S-V0-01 V0 Completion Gate Manifest Finalisation and S-V0-02 Scope Guard Hardening.
Release identity: Kolosseum v0 is the Deterministic Execution Alpha.

## DEV NOTE: completion authority

This document is the release decision surface for v0. It does not add product capability. It binds existing engine, runtime, replay, registry, copy/legal, scope, CI, documentation, and release/tag gates into one human-readable completion manifest.

A future developer must not declare v0 complete from one passing command. V0 completion requires the full local gate set, clean tree, origin sync, and GitHub CI confirmation before final release/tag work.

## DEV NOTE: active v0 scope boundary

S-V0-02 is satisfied by confirming and preserving the existing active-scope guard and negative-scope tests. This manifest makes the active v0 exclusion boundary explicit without weakening or rewriting the guard scripts.

Valid future roadmap documents may exist, but active v0 runtime code must stay inside the Deterministic Execution Alpha boundary.

## Required v0 completion gates

The following local gates are required before v0 can be declared complete:

- npm run test:v0
- npm run lint
- npm run build
- npm run test:change
- npm run test:full

The following repository state is required:

- branch is main
- working tree is clean
- local main matches origin/main
- GitHub CI is green before release/tag

## Required completion sections

### 1. Engine determinism

Required proof:

- deterministic engine entrypoints remain stable
- canonical JSON and hash behaviour remain byte-stable
- app, UI, copy, coach notes, commercial state, auth, billing, and future surfaces do not alter engine truth

Blocking gates:

- npm run test:v0
- npm run lint
- npm run test:change
- npm run test:full

### 2. Runtime state

Required proof:

- session state is derived from recorded runtime events
- reads do not mutate state
- replay/reload parity remains stable
- split, return, continue, skip, stop, and partial completion remain factual runtime outcomes

Blocking gates:

- npm run test:v0
- npm run build

### 3. Replay and proof boundary

Required proof:

- v0 replay language remains honest about the active v0 proof scope
- golden outputs remain stable
- v0 does not claim evidence-complete release status

Blocking gates:

- golden manifest guard
- golden outputs guard
- npm run test:v0
- npm run lint

### 4. Registry law

Required proof:

- active registry schemas are present
- active registry bundles validate
- required foreign keys close
- registry store remains read-only
- active runtime does not use registry fallback behaviour

Blocking gates:

- registry schema presence guard
- registry bundle guard
- registry law guard
- npm run lint

### 5. Copy and legal claims

Required proof:

- active v0 copy remains factual
- active copy does not present coaching, medical, suitability, outcome, or optimisation claims
- inactive future surfaces remain outside active v0 runtime

Blocking gates:

- sales/copy claims lint
- v0 boundary claim consistency guard
- npm run lint

### 6. Scope guard

Required proof:

- active v0 code paths remain inside individual and coach-managed execution
- active v0 remains limited to powerlifting, rugby_union, and general_strength
- active v0 remains limited to Phase 1 through Phase 6
- organisation, team, unit, gym, marketplace, messaging, subscription, broad dashboard, scoring, ranking, and proof-layer runtime are not active v0 ship criteria

Blocking gates:

- run_v0_active_scope_guard
- run_v0_active_scope_negative_tests
- npm run lint

### 7. CI gates

Required proof:

- direct gates and wrapper gates agree
- wrapper gates do not create false failures
- clean-tree guard is respected by committing intentional changes before full lint gates

Blocking gates:

- npm run test:v0
- npm run lint
- npm run build
- npm run test:change
- npm run test:full

### 8. Documentation

Required proof:

- v0 boundary is documented
- this completion manifest exists
- developer handover notes explain what must not drift
- docs do not create active product scope beyond v0

Blocking gates:

- documentation validation guards
- workflow policy/header guards
- npm run lint

### 9. Release and tag readiness

V0 may be tagged only when:

- local main matches origin/main
- working tree is clean
- all local gates pass
- GitHub CI is green
- final decision note exists
- no active v1 or post-v1 capability is required for v0 completion

## Explicit post-v0 exclusions

The following are not v0 completion requirements:

- Phase 7 truth projection as a release capability
- Phase 8 evidence sealing
- exportable proof artefacts
- organisation runtime
- team runtime
- unit runtime
- gym access
- marketplace
- messaging
- billing implementation
- broad dashboards
- scoring
- ranking
- outcome evaluation
- full coach-athlete v1 product surface

## Completion rule

If any required gate fails, v0 is not complete.

If local main and origin/main differ, v0 is not complete.

If the working tree is dirty, v0 is not complete.

If GitHub CI is not green, v0 is not complete.

If active v0 requires a post-v0 feature to pass, v0 is not complete.
