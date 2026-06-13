# Naming Conventions

Status: canonical developer convention for v1 and later.
Release boundary: applies from S-V1-00 onward.
Authority: this document defines naming style. Canonical product law still lives in release, roadmap, registry, contract, and engine documents.

## Purpose

Consistent naming makes the repo readable for a future developer without needing the founder present. Names must show scope, boundary, and intent. Names must not imply behaviour that is not implemented or proved.

## Authority rule

Docs define law.
Tests prove behaviour.
Comments explain boundaries.
CI blocks drift.

A name must not create product authority by itself. If a name suggests a capability, the capability must be documented, tested, and inside the active release boundary.

## General naming rules

Use clear English words.
Prefer boring names over clever names.
Prefer exact domain language over generic helper names.
Use one concept per name.
Do not use temporary names such as new, old, final, final2, fixed, misc, stuff, helper2, or test123.
Do not use marketing names inside engine, registry, proof, or CI code.
Do not use medical, safety, risk, readiness, fatigue, diagnosis, optimisation, or recommendation language unless a canonical document explicitly permits it for that surface.

## Branch names

Use lowercase kebab-case.

Allowed branch forms:

- ticket/s-v1-00-short-slice-name
- ticket/s-v1-01-short-slice-name
- ticket/s-dev-short-dev-slice-name
- hotfix/short-critical-fix-name
- backup/short-reason-yyyyMMdd-HHmmss
- rescue/short-reason-yyyyMMdd-HHmmss

Rules:

- Every v1 feature branch must start with ticket/s-v1-.
- Every branch name must describe one slice only.
- Do not reuse old v0, pilot, postv1, or stale ticket branches for v1 work.
- Do not start v1 product work from anything except current main unless a documented rescue plan says otherwise.

## Slice IDs

Use S-V1-00, S-V1-01, S-V1-02 for v1 slices.

Use S-DEV-* only for developer-support slices that do not add product scope.

Use S-V0-* only for historic v0 records. Do not create new S-V0 product work after the v0 final tag unless it is an explicit v0 release correction.

## File and folder names

Use lowercase kebab-case for markdown docs unless an existing canonical family uses uppercase.

Examples:

- docs/dev/NAMING_CONVENTIONS.md is allowed because the dev docs already use uppercase convention docs.
- docs/dev/branch-and-pr-conventions.md would be allowed in a new lowercase family.
- ci/guards/developer_operating_conventions_guard.mjs is allowed because existing guard files use snake_case.

Use the local folder convention already present in that area:

- ci/guards: snake_case file names ending in _guard.mjs.
- ci/scripts: snake_case or existing script family naming.
- docs/dev: uppercase convention names are allowed for human-facing canonical docs.
- docs/roadmap: uppercase release and roadmap names are allowed.
- src and app code: follow existing TypeScript naming in that module.

## TypeScript names

Use PascalCase for exported types, interfaces, classes, and branded domain types.

Examples:

- SessionId
- AthleteId
- CoachId
- EngineRunId
- RegistryExerciseId
- CanonicalHash
- RuntimeEventSeq

Use camelCase for variables, functions, object properties, and local helpers.

Use UPPER_SNAKE_CASE only for true constants and failure tokens.

Do not use vague names such as data, info, result2, payload2, item, thing, or obj when a domain name exists.

## Functions

Function names must describe observable behaviour.

Good examples:

- assertCoachCanViewAthlete
- assertEngineInputIsCanonical
- assertNoCoachNoteInEngineInput
- reduceRuntimeEvent
- buildDecisionSummaryFromEngineRun
- verifyRegistryForeignKeyClosure

Bad examples:

- processData
- handleStuff
- makeItWork
- fixSession
- getResult

Use assert* only when the function throws on failure.
Use build* when constructing a new value.
Use reduce* when applying an event or state transition.
Use verify* when returning or throwing proof of validity.
Use load* when reading external state.
Use parse* when converting text or unknown input into a typed value.

## Tests

Test files should name the behaviour under test.

Preferred forms:

- test/<domain><Behaviour>.test.mjs
- test/<domain><Boundary>.test.mjs
- ci/scripts/run_<slice_or_gate>_guard.mjs
- ci/guards/<boundary>_guard.mjs

Test names must explain behaviour, not implementation trivia.

Good examples:

- rejects coach notes in engine input
- preserves replay output after session reload
- blocks commercial claim language in active v0 copy
- keeps live session watching read-only

Bad examples:

- works
- handles case
- test 1
- should pass

## Failure tokens

Use UPPER_SNAKE_CASE.

Failure tokens must be stable, searchable, and documented when they are part of a user-facing or CI-facing contract.

Examples:

- CI_GATE_FAILED
- V0_SCOPE_LEAK
- REGISTRY_FK_VIOLATION
- ENGINE_COUPLING_DETECTED
- COPY_CLAIM_FORBIDDEN

Do not put dynamic values inside token names.
Do not rename existing tokens without updating the failure token index and affected tests.

## Registry IDs

Registry IDs must be stable and machine-safe.

Use lowercase kebab-case unless the existing registry schema says otherwise.

Examples:

- barbell-back-squat
- dumbbell-bench-press
- trap-bar-deadlift
- powerlifting
- general-strength

Registry IDs must not include coach names, protected method names, brand names, or misleading attribution unless a licence and canonical commercial rule explicitly permit it.

## Runtime events

Use lowercase snake_case for event type values unless the existing schema defines another format.

Examples:

- session_started
- work_item_completed
- work_item_skipped
- substitution_declared
- split_started
- split_returned
- session_stopped

Runtime event names must describe recorded facts only. They must not imply recommendations, risk, readiness, fatigue, effectiveness, diagnosis, or optimisation.

## API routes

Use lowercase kebab-case or existing route style.

Routes must be factual and boundary-safe.

Examples:

- GET /health
- POST /sessions/plan
- POST /sessions/:id/start
- GET /sessions/:id/state
- GET /sessions/:id/events
- GET /sessions/decision-summary/:run_id

Do not name routes as if they recommend, optimise, diagnose, prescribe, or intervene unless that capability is explicitly inside the active release boundary.

## Database names

Use snake_case for tables and columns.

Examples:

- engine_runs
- runtime_events
- session_event_seq
- coach_notes
- athlete_declarations
- created_at
- updated_at
- run_id
- session_id

Database names must describe stored facts, not inferred judgements.

## Documentation names

Use uppercase names for canonical release, roadmap, and dev-control documents where the repo already follows that pattern.

Examples:

- ACTIVE_RELEASE_BOUNDARY.md
- V1_SUPPORTED_ACTIVITIES_DECISION.md
- NAMING_CONVENTIONS.md
- SLICE_TEMPLATE.md
- CI_FAILURE_GUIDE.md

Use docs/dev for developer operating rules.
Use docs/roadmap for active release and future planning boundaries.
Use docs/release for shipped release evidence.
Use docs/contracts for stable interface contracts.
Use docs/adr for architecture decision records.

## Forbidden naming patterns

Do not use:

- smart
- optimal
- recommended
- readiness
- fatigue
- risk score
- safe score
- injury risk
- diagnosis
- treatment
- prescription
- adherence score
- compliance score
- coach intervention
- live monitoring

unless the exact term is explicitly approved by canonical law for that surface.

## Change rule

Changing naming conventions is a developer-operating change. It requires:

- update to this document,
- update to any affected template or guard,
- proof through lint or targeted guard,
- clear commit message.

<!-- S-V1-06:ADR-NAMING-RULE:START -->
## ADR names

Use `docs/adr` for Architecture Decision Records.

Numbered ADR files must live directly under `docs/adr/` and use:

- `ADR-0001-short-decision-name.md`

ADR filenames must match `ADR-[0-9]{4}-[a-z0-9]+(-[a-z0-9]+)*.md`.

Allowed non-numbered files directly under `docs/adr/` are:

- `README.md`
- `INDEX.md`
- `ADR_TEMPLATE.md`

Do not use vague ADR names such as `ADR-0001-final.md`, `ADR-0002-new.md`, `ADR-0003-fix.md`, `ADR-0004-misc.md`, or `ADR-0005-stuff.md`.

ADRs document decisions; they do not create engine law.
<!-- S-V1-06:ADR-NAMING-RULE:END -->
