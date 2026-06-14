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

Anything outside this document and its authority map is not v1 unless a deliberate boundary-change slice rewrites this document and updates the matching acceptance and not-in-scope records.

## Controlled commercial launch extension

Self-serve launch additions may be included in v1 only as controlled-launch support surfaces.

Permitted controlled-launch support surfaces may include Stripe Checkout or customer portal, public status and factual error-reporting surfaces, legal surfaces, backup and restore readiness records, and factual email notifications where deliberately sliced.

These surfaces must never alter deterministic engine truth, programme assignment legality, compile output, substitution legality, replay truth, proof truth, factual history, or coach-athlete relationship authority.

Implementation-specific operational thresholds belong in operational readiness records, not this release-boundary law.

## Final rule

V1 is complete only when the coach-athlete product is fully usable, commercially credible, and boundary-proven.

Anything outside this document and its authority map is not v1 unless a deliberate boundary-change slice rewrites this document and updates the matching acceptance and not-in-scope records.

<!-- S-V1-10:RELEASE-BOUNDARY-CLOSURE:START -->
## S-V1-10 Release Boundary File Closure

V1 equals a complete coach-athlete product with proof layer and full supported registry/template/substitution coverage.

For S-V1-10, full supported registry/template/substitution coverage means full v1 coverage for the locked supported activities only. It does not unlock unsupported activities or post-v1 markets.

Controlled launch support is allowed only where separately sliced and only where it cannot alter engine truth.

Controlled launch support may control access, billing records, legal presentation, public status, error reporting, backup and restore evidence, or factual notifications where later slices explicitly permit it. It must not alter deterministic engine truth, programme assignment legality, compile output, substitution legality, replay truth, proof truth, factual history, or coach-athlete relationship authority.

The following remain excluded from v1 unless a later post-v1 boundary rewrite explicitly reopens them: organisations, organizations, teams, gyms, units, federations, marketplace, messaging, chat, EPOS, gym access, full dashboards, enterprise.

S-V1-10 does not create product implementation, engine implementation, registry content, payment implementation, auth implementation, UI implementation, database migrations, workflow authority, commercial authority, legal authority, proof authority, or release approval.

This file is the canonical v1 release-boundary statement. If another v1 planning document appears to widen v1 beyond this closure, this file wins unless a later named boundary slice deliberately changes it.
<!-- S-V1-10:RELEASE-BOUNDARY-CLOSURE:END -->

<!-- S-V1-11:ACCOUNT-MODEL-BOUNDARY:START -->
## S-V1-11 Account Model Boundary

V1 supports coach and athlete only.

The canonical account model boundary is `docs/v1/V1_ACCOUNT_MODEL_BOUNDARY.md`.

Dormant future roles may be documented only as dormant and must not become active v1 account scope.

Account state is platform state only and must not alter engine truth, programme legality, compile output, substitution legality, replay truth, proof truth, or factual history.

S-V1-11 does not activate organisation, organization, team, gym, unit, federation, enterprise, marketplace, messaging, chat, EPOS, gym access, full dashboards, auth provider implementation, payment implementation, database migrations, product UI, or engine behaviour.
<!-- S-V1-11:ACCOUNT-MODEL-BOUNDARY:END -->

<!-- S-V1-12:COACH-REGISTRATION-PROVISIONING:START -->
## S-V1-12 Coach Registration or Provisioning

The canonical v1 coach registration/provisioning boundary is `docs/v1/V1_COACH_REGISTRATION_PROVISIONING.md`.

V1 permits a coach account to be registered or provisioned as product/auth state only.

Coach registration cannot affect deterministic compile output.

The path may create a coach platform identity record shape and factual copy identifiers only.

S-V1-12 does not activate auth provider implementation, database migrations, product UI, payment implementation, enterprise account management, organisation admin, organization admin, team admin, gym admin, unit admin, federation admin, marketplace, coach discovery, messaging, chat, EPOS, gym access, full dashboards, registry content, engine behaviour, proof implementation, relationship implementation, or assignment implementation.
<!-- S-V1-12:COACH-REGISTRATION-PROVISIONING:END -->

<!-- S-V1-13:ATHLETE-REGISTRATION-INVITATION:START -->
## S-V1-13 Athlete Registration or Invitation

The canonical v1 athlete registration/invitation boundary is `docs/v1/V1_ATHLETE_REGISTRATION_INVITATION.md`.

V1 permits an athlete account to be registered or invited as product/auth state only.

Athlete registration cannot affect engine truth.

Athlete invitation cannot affect engine truth.

The path may create athlete platform identity and athlete account invitation record shapes with factual copy identifiers only.

Accepted athlete invitations in S-V1-13 do not create coach-athlete relationships, coach visibility, or assignment authority.

S-V1-13 does not activate friends, social, team invites, organisation invites, organization invites, gym invites, unit invites, federation invites, enterprise invites, marketplace, coach discovery, messaging, chat, auth provider implementation, database migrations, product UI, payment implementation, enterprise account management, registry content, engine behaviour, proof implementation, relationship implementation, or assignment implementation.
<!-- S-V1-13:ATHLETE-REGISTRATION-INVITATION:END -->

<!-- S-V1-14:COACH-ATHLETE-RELATIONSHIP-ACCEPTANCE:START -->
## S-V1-14 Coach-Athlete Relationship Acceptance

The canonical v1 coach-athlete relationship acceptance boundary is `docs/v1/V1_COACH_ATHLETE_RELATIONSHIP_ACCEPTANCE.md`.

V1 permits an explicit individual coach-athlete relationship as product permission state only.

Coach can view assigned athletes only.

Athlete can view own data only unless explicitly permitted.

Relationship changes do not mutate engine truth.

Accepted athlete invitation is not enough by itself. Accepted relationship state is required before coach visibility exists.

S-V1-14 does not activate teams, organisations, organizations, gyms, units, federations, enterprise relationships, friends, social connections, messaging, chat, marketplace, coach discovery, auth provider implementation, database migrations, product UI, payment implementation, assignment implementation, registry content, engine behaviour, or proof implementation.
<!-- S-V1-14:COACH-ATHLETE-RELATIONSHIP-ACCEPTANCE:END -->

<!-- S-V1-15:RELATIONSHIP-PERMISSION-GUARDS:START -->
## S-V1-15 Relationship Permission Guards

The canonical v1 relationship permission guard boundary is `docs/v1/V1_RELATIONSHIP_PERMISSION_GUARDS.md`.

V1 permits reusable fail-closed product/auth permission guard functions for coach-athlete access.

The active guard functions include `assertCoachCanViewAthlete`, `assertAthleteCanViewOwnData`, and `assertCoachAthleteAccess`.

Permission failure is product/auth failure, not engine decision.

Permission guard decisions do not mutate engine truth.

The guards are reusable by coach notes, factual artefact viewing, live session status, and factual history surfaces.

S-V1-15 does not activate engine behaviour, registry content, broad RBAC, organisation roles, organization roles, team roles, gym roles, unit roles, federation roles, enterprise roles, friends, social connections, messaging, chat, marketplace, coach discovery, auth provider implementation, database migrations, product UI, payment implementation, assignment implementation, proof implementation, or server surface rewiring.
<!-- S-V1-15:RELATIONSHIP-PERMISSION-GUARDS:END -->

<!-- S-V1-16:PHASE-1-DECLARATION-SURFACE:START -->
## S-V1-16 Phase 1 Declaration Surface

The canonical v1 Phase 1 declaration surface boundary is `docs/v1/V1_PHASE_1_DECLARATION_SURFACE.md`.

V1 permits a factual user-declared Phase 1 declaration record before compile admission.

Unknown top-level fields and unknown declaration payload fields fail closed.

Declaration copy must not imply medical advice, diagnosis, medical assessment, safety clearance, suitability clearance, readiness scoring, risk scoring, recommendation, training outcome, operational meaning, or external approval.

Permission, account, relationship, and declaration state remain product/app state unless explicitly admitted as canonical engine input by existing engine law.

S-V1-16 does not activate medical assessment, diagnosis, safety clearance, suitability clearance, readiness scoring, engine behaviour, registry content, database migrations, auth provider implementation, product UI, payment implementation, broad RBAC, organisation roles, organization roles, team roles, gym roles, unit roles, federation roles, enterprise roles, assignment implementation, or proof implementation.
<!-- S-V1-16:PHASE-1-DECLARATION-SURFACE:END -->
