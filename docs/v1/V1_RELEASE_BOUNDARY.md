<!-- DEV NOTE: V1 release-boundary control surface. This document freezes v1 scope for implementation planning. It does not redefine engine law, registry law, CI token meanings, commercial authority, or legal claims. -->

# V1 Release Boundary

Status: active v1 scope-control document.
Release name: First Lawful Run.
Slice: S-V1-00.

## Purpose

This document defines the permitted v1 implementation boundary before v1 product slices continue.

It exists to prevent v1 scope drift, duplicate authority, hidden product expansion, and accidental movement of post-v1 features into the v1 build.

This document is a scope-control surface. It points to authority; it does not create engine behaviour.

## Authority position

This document is subordinate to:

1. `docs/SPINE.md`
2. `docs/BUILD_TARGET_v0.md` while v0 closure remains active
3. `docs/POST_V0_TRANSITION_PLAN.md`
4. `docs/V1_ENTRY_CRITERIA.md`
5. `docs/V1_PHASE_OBJECTIVE_AND_FIRST_LANES.md`
6. `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`
7. `docs/roadmap/V1_SUPPORTED_ACTIVITIES_DECISION.md`
8. `docs/roadmap/V1_LOCKED_ACTIVITY_SET_GUARD.md`
9. `docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md`
10. `docs/roadmap/V1_COACH_ATHLETE_JOURNEY_MAP.md`
11. `docs/roadmap/V1_DATA_MODEL_FREEZE_POINT.md`
12. `docs/roadmap/V1_REGISTRY_EXPANSION_TARGET.md`
13. `docs/roadmap/V1_REGISTRY_SCHEMA_TARGET_HARDENING.md`
14. `docs/roadmap/V1_REGISTRY_DOMAIN_SCAFFOLD.md`
15. `docs/roadmap/V1_REGISTRY_CONTENT_PRODUCTION_CONTRACT.md`
16. `docs/roadmap/V1_IMPLEMENTATION_READINESS_CHECKLIST.md`
17. `docs/v1/V1_ACCEPTANCE_GATE.md`
18. `docs/v1/V1_NOT_IN_SCOPE.md`
19. `docs/v1/V1_DOC_AUTHORITY_MAP.md`

If this document and an upstream canonical source disagree, the upstream canonical source wins.

## V1 definition

Kolosseum v1 is the First Lawful Run: the first complete coach-athlete product release that turns the deterministic execution alpha into a commercially credible, proof-aware product surface without allowing product, payment, UI, notes, copy, or commercial state to alter engine truth.

V1 must be usable by a coach and athlete from lawful declaration through assignment, execution, factual history, proof-aware artefact viewing, controlled payment path, and supportable launch documentation.

## V1 includes

V1 includes:

- v0 completion as a prerequisite, not a replacement.
- coach account flow.
- athlete account flow.
- explicit coach-athlete relationship model.
- lawful Phase 1 onboarding and declaration.
- locked v1 supported activities.
- full v1 exercise registry coverage for supported activities.
- full v1 equipment registry coverage for supported activities.
- full exercise-to-sport applicability coverage for supported activities.
- full programme template system for supported activities.
- programme assignment by authorised coach.
- deterministic compile path.
- deterministic substitution engine with no undeclared fallback.
- mobile-first session execution surface.
- split and return.
- partial completion.
- factual session history.
- coach factual artefact view.
- coach notes that remain engine-invisible.
- live session status as read-only factual visibility for assigned coach-athlete relationships.
- proof-aware replay and artefact boundary where activated by v1 release law.
- export only where explicitly permitted by v1 proof/export boundary.
- auth and permission enforcement.
- stable data model before broad app build-out.
- payment path sufficient for controlled launch.
- copy registry and claim boundary enforcement.
- no-coupling tests proving app, UI, auth, billing, notes, and copy do not alter engine truth.
- developer handover documentation.
- controlled commercial launch boundary.

## V1 proof layer

V1 may include Phase 7 and Phase 8 work only where explicitly permitted by the active v1 release boundary and matching guards.

Proof surfaces must remain process-integrity surfaces only.

Evidence, replay, seals, exports, and proof wording must not imply correctness, outcome value, user ability, coaching quality, training effectiveness, medical meaning, operational meaning, or external approval.

## V1 coach-athlete minimum acceptance path

V1 is not complete unless the following path works end to end:

1. Coach registers or is provisioned.
2. Athlete registers or is invited.
3. Coach-athlete relationship is explicitly accepted and scoped.
4. Athlete completes lawful declaration.
5. Coach assigns a programme within permitted authority.
6. System compiles deterministically from declared inputs and registries.
7. Athlete executes the session on the mobile-first surface.
8. Runtime records factual events.
9. Split, return, stop, skip, substitution, and partial completion behave deterministically.
10. Coach views factual artefacts for assigned athletes only.
11. Coach writes notes that remain engine-invisible.
12. Athlete can view own factual history.
13. Proof-aware artefacts are available only where permitted.
14. Payment path does not alter engine output, legality, replay, proof, or artefact truth.
15. CI proves boundary, registry, copy, auth, and deterministic invariants.

## V1 Metric Threshold Marker position

Metric foundation may be prepared in v1 only as factual metric infrastructure if deliberately sliced.

The Metric Threshold Marker Engine is not a v1 core requirement unless a later release-boundary change explicitly activates it.

The permitted future direction is:

- factual Metric Registry 1C
- Metric to Exercise Link Registry 1C-A
- separate Threshold Marker Registry
- deterministic marker evaluator
- factual marker statuses only

Forbidden outputs include ability, readiness, suitability, safety, return-to-play, return-to-run, fitness-for-duty, operational-readiness, deployment, recommendation, or capability conclusions.

Safe future phrasing example:

Single-leg leg press/bodyweight ratio recorded at 1.25; marker threshold greater_than_or_equal 1.25; marker status recorded_met; source coach_entered; interpretation null.

## V1 hard boundaries

V1 must not introduce:

- organisation runtime
- team runtime
- unit runtime
- gym runtime
- federation runtime
- marketplace
- messaging or chat
- broad analytics dashboards
- athlete ranking
- coach ranking
- predictive modelling
- capability inference
- readiness scoring
- return-to-play decisions
- return-to-run decisions
- fitness-for-duty decisions
- operational-readiness decisions
- medical or rehabilitation claims
- safety claims
- suitability claims
- automatic progression based on inferred success
- formula visibility for licensed or protected programme packs
- gym access control
- EPOS
- enterprise billing
- new sports beyond the locked v1 supported set
- commercial dashboards unless explicitly listed in a later v1 boundary rewrite

## Implementation rule

A v1 slice may proceed only if it can name:

- the v1 acceptance item it advances
- the source-of-truth document that permits it
- the files it is allowed to touch
- the files it must not touch
- the tests or guards proving it
- the non-scope it refuses

If it cannot name those things, it is not ready to build.

## Final rule

V1 is complete only when the coach-athlete product is fully usable, commercially credible, and boundary-proven.

Anything outside this document and its authority map is not v1 unless a deliberate boundary-change slice rewrites this document and updates the matching acceptance and not-in-scope records.## Commercial rollout extension (2026-06-13)

*Self-serve launch additions (Stripe Checkout / Portal, status page, Sentry, legal surfaces, backups, email reminders) are included **only if they never alter deterministic engine truth**.*