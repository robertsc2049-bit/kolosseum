<!-- DEV NOTE: V1 authority-map surface. This document tells future developers where v1 authority lives. It does not create or duplicate authority. -->

# V1 Document Authority Map

Status: active v1 authority pointer.
Release name: First Lawful Run.
Slice: S-V1-00.

## Purpose

This map tells developers which documents to read before touching v1 scope.

It prevents scattered docs, founder memory, commercial notes, reference examples, or old milestone names from becoming hidden authority.

## Authority levels

### Level 0 - Repository spine and active release pointer

Read first:

- `docs/SPINE.md`
- `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`

Purpose:

- defines the current document universe and where the active boundary is found
- prevents orphan scope records from becoming authority

### Level 1 - V0 closure and transition authority

Read before any v1 implementation:

- `docs/BUILD_TARGET_v0.md`
- `docs/POST_V0_TRANSITION_PLAN.md`
- `docs/release/V0_COMPLETION_GATE_MANIFEST.md`
- `docs/release/V0_FINAL_RELEASE_READINESS_GATE.md`

Purpose:

- confirms v0 closure remains a prerequisite
- prevents v1 work being added as unfinished v0 scope
- keeps v0 from absorbing proof-complete or broader platform work

### Level 2 - V1 scope authority

Read before choosing or implementing a v1 slice:

- `docs/v1/V1_RELEASE_BOUNDARY.md`
- `docs/v1/V1_ACCEPTANCE_GATE.md`
- `docs/v1/V1_NOT_IN_SCOPE.md`
- `docs/V1_ENTRY_CRITERIA.md`
- `docs/V1_PHASE_OBJECTIVE_AND_FIRST_LANES.md`

Purpose:

- defines what v1 is
- defines what v1 must prove
- defines what v1 must not include
- defines first lanes and entry criteria

### Level 3 - V1 roadmap boundary records

Read when working on the relevant area:

- `docs/roadmap/V1_SUPPORTED_ACTIVITIES_DECISION.md`
- `docs/roadmap/V1_LOCKED_ACTIVITY_SET_GUARD.md`
- `docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md`
- `docs/roadmap/V1_COACH_ATHLETE_JOURNEY_MAP.md`
- `docs/roadmap/V1_DATA_MODEL_FREEZE_POINT.md`
- `docs/roadmap/V1_REGISTRY_EXPANSION_TARGET.md`
- `docs/roadmap/V1_REGISTRY_SCHEMA_TARGET_HARDENING.md`
- `docs/roadmap/V1_REGISTRY_DOMAIN_SCAFFOLD.md`
- `docs/roadmap/V1_REGISTRY_CONTENT_PRODUCTION_CONTRACT.md`
- `docs/roadmap/V1_IMPLEMENTATION_READINESS_CHECKLIST.md`

Purpose:

- locks activity set
- protects registry scope
- protects app-engine-auth boundaries
- defines journey and data-model freeze points

### Level 4 - Engine, CI, registry, and proof law

Read when touching engine, registries, CI, replay, proof, or output boundaries:

- `docs/CORE_ENGINE_GOVERNANCE_EXECUTION_LAW.docx`
- `docs/MASTER_CI_GATES.docx`
- `docs/REGISTRY_LAW_CANONICAL_STRUCTURE.docx`
- `docs/PHASE_1_INPUT_DECLARATION_CONSENT.docx`
- `docs/PHASE_2_CANONICALISATION_HASHING.docx`
- `docs/PHASE_3_CONSTRAINT_RESOLUTION_LEGAL_BOUNDING.docx`
- `docs/PHASE_4_PROGRAM_ASSEMBLY.docx`
- `docs/PHASE_5_SUBSTITUTION_ADJUSTMENT.docx`
- `docs/PHASE_6_SESSION_OUTPUT.docx`

Purpose:

- preserves deterministic engine law
- preserves CI build-existence law
- preserves registry closure
- preserves phase behaviour
- prevents product surfaces from redefining engine truth

### Level 5 - Developer handover and execution docs

Read before writing a slice or opening a PR:

- `docs/dev/SLICE_TEMPLATE.md`
- `docs/dev/FAILURE_TOKEN_INDEX.md`
- `docs/dev/CI_FAILURE_GUIDE.md`
- `.github/pull_request_template.md`
- `docs/GUARDS_INDEX.md`
- `docs/REPO_DOCS_INDEX.md`
- `README.md`

Purpose:

- standardises slice work
- makes failure tokens searchable
- requires boundary, proof, non-scope, and rollback to be stated
- prevents undocumented guard drift

## Non-authority surfaces

These surfaces are not v1 scope authority unless explicitly referenced by the active release boundary:

- demo scripts
- sales packs
- commercial pricing notes
- founder notes
- reference examples
- screenshots
- old release notes
- post-v1 packaging artefacts
- freeze artefacts
- dormant enterprise documents

They may support planning, but they do not permit implementation.

## Conflict rule

If two documents conflict:

1. active canonical law wins over roadmap
2. roadmap boundary wins over demo or commercial notes
3. active v1 boundary wins over old v1 lane notes
4. not-in-scope wins over implication
5. tests and guards prove behaviour; docs do not prove behaviour alone

## Developer preflight

Before starting a v1 slice, record:

- release boundary source
- acceptance gate item
- not-in-scope check
- files allowed
- files forbidden
- guard or test proof
- rollback path

If any item is unknown, inspect first. Do not implement by guesswork.

<!-- S-V1-06:ADR-AUTHORITY-MAP:START -->
## ADR authority position

Architecture Decision Records live in `docs/adr`.

Read the ADR system entry point at `docs/adr/README.md`.

ADRs document decisions; they do not create engine law.

Boundary docs, contracts, tests, and guards remain authoritative where applicable.

Use ADRs to understand why a boundary or architecture decision was made, not to infer permission to implement product, engine, registry, app, payment, auth, UI, commercial, legal, proof, or export behaviour.
<!-- S-V1-06:ADR-AUTHORITY-MAP:END -->

<!-- S-V1-10:AUTHORITY-MAP-CLOSURE:START -->
## S-V1-10 Release Boundary Authority Closure

Authority order for v1 release-boundary closure:

1. `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`
2. `docs/v1/V1_RELEASE_BOUNDARY.md`
3. `docs/v1/V1_ACCEPTANCE_GATE.md`
4. `docs/v1/V1_NOT_IN_SCOPE.md`
5. `docs/v1/V1_DOC_AUTHORITY_MAP.md`
6. `docs/v1/V1_CI_MASTER_GATE.md`
7. executable CI guards and tests

This authority map confirms that v1 equals a complete coach-athlete product with proof layer and full supported registry/template/substitution coverage.

Controlled launch support is allowed only where separately sliced and only where it cannot alter engine truth.

Organisations, organizations, teams, gyms, units, federations, marketplace, messaging, chat, EPOS, gym access, full dashboards, and enterprise remain excluded from v1 unless a later named post-v1 boundary rewrite explicitly reopens them.

No lower-authority document, ADR, checklist, fixture, script, copy surface, payment reference, support note, or placeholder may widen v1 scope.
<!-- S-V1-10:AUTHORITY-MAP-CLOSURE:END -->

<!-- S-V1-11:ACCOUNT-MODEL-AUTHORITY:START -->
## S-V1-11 Account Model Authority

`docs/v1/V1_ACCOUNT_MODEL_BOUNDARY.md` is the canonical v1 account role boundary.

It is subordinate to the active v1 release boundary and app-engine boundary, and it is enforced by `ci/guards/s_v1_11_account_model_boundary_guard.mjs`.

Authority order for account role scope:

1. `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`
2. `docs/v1/V1_RELEASE_BOUNDARY.md`
3. `docs/v1/V1_ACCOUNT_MODEL_BOUNDARY.md`
4. `docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md`
5. `docs/v1/V1_ACCEPTANCE_GATE.md`
6. `docs/v1/V1_NOT_IN_SCOPE.md`
7. executable CI guards and tests

No lower-authority document, schema, fixture, route, UI surface, account state, billing state, support state, dormant future role, or implementation note may widen active v1 account scope beyond coach and athlete.
<!-- S-V1-11:ACCOUNT-MODEL-AUTHORITY:END -->

<!-- S-V1-12:COACH-REGISTRATION-AUTHORITY:START -->
## S-V1-12 Coach Registration Authority

`docs/v1/V1_COACH_REGISTRATION_PROVISIONING.md` is the canonical v1 coach registration/provisioning boundary.

It is subordinate to the active v1 release boundary, account model boundary, and app-engine boundary.

It is enforced by:

- `src/coachRegistrationProvisioning.mjs`
- `test/s_v1_12_coach_registration_provisioning.test.mjs`
- `ci/guards/s_v1_12_coach_registration_provisioning_guard.mjs`

Authority order for coach registration/provisioning scope:

1. `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`
2. `docs/v1/V1_RELEASE_BOUNDARY.md`
3. `docs/v1/V1_ACCOUNT_MODEL_BOUNDARY.md`
4. `docs/v1/V1_COACH_REGISTRATION_PROVISIONING.md`
5. `docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md`
6. `docs/v1/V1_ACCEPTANCE_GATE.md`
7. `docs/v1/V1_NOT_IN_SCOPE.md`
8. executable tests and CI guards

No lower-authority document, route, schema, fixture, copy surface, billing state, support state, dormant future role, or implementation note may widen coach registration/provisioning beyond coach product/auth state.
<!-- S-V1-12:COACH-REGISTRATION-AUTHORITY:END -->

<!-- S-V1-13:ATHLETE-REGISTRATION-AUTHORITY:START -->
## S-V1-13 Athlete Registration Authority

`docs/v1/V1_ATHLETE_REGISTRATION_INVITATION.md` is the canonical v1 athlete registration/invitation boundary.

It is subordinate to the active v1 release boundary, account model boundary, coach registration/provisioning boundary, and app-engine boundary.

It is enforced by:

- `src/athleteRegistrationInvitation.mjs`
- `test/s_v1_13_athlete_registration_invitation.test.mjs`
- `ci/guards/s_v1_13_athlete_registration_invitation_guard.mjs`

Authority order for athlete registration/invitation scope:

1. `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`
2. `docs/v1/V1_RELEASE_BOUNDARY.md`
3. `docs/v1/V1_ACCOUNT_MODEL_BOUNDARY.md`
4. `docs/v1/V1_COACH_REGISTRATION_PROVISIONING.md`
5. `docs/v1/V1_ATHLETE_REGISTRATION_INVITATION.md`
6. `docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md`
7. `docs/v1/V1_ACCEPTANCE_GATE.md`
8. `docs/v1/V1_NOT_IN_SCOPE.md`
9. executable tests and CI guards

No lower-authority document, route, schema, fixture, copy surface, billing state, support state, dormant future role, or implementation note may widen athlete registration/invitation beyond athlete product/auth state.
<!-- S-V1-13:ATHLETE-REGISTRATION-AUTHORITY:END -->

<!-- S-V1-14:COACH-ATHLETE-RELATIONSHIP-AUTHORITY:START -->
## S-V1-14 Coach-Athlete Relationship Authority

`docs/v1/V1_COACH_ATHLETE_RELATIONSHIP_ACCEPTANCE.md` is the canonical v1 coach-athlete relationship acceptance boundary.

It is subordinate to the active v1 release boundary, account model boundary, coach registration/provisioning boundary, athlete registration/invitation boundary, and app-engine boundary.

It is enforced by:

- `src/coachAthleteRelationshipAcceptance.mjs`
- `test/s_v1_14_coach_athlete_relationship_acceptance.test.mjs`
- `ci/guards/s_v1_14_coach_athlete_relationship_acceptance_guard.mjs`

Authority order for coach-athlete relationship scope:

1. `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`
2. `docs/v1/V1_RELEASE_BOUNDARY.md`
3. `docs/v1/V1_ACCOUNT_MODEL_BOUNDARY.md`
4. `docs/v1/V1_COACH_REGISTRATION_PROVISIONING.md`
5. `docs/v1/V1_ATHLETE_REGISTRATION_INVITATION.md`
6. `docs/v1/V1_COACH_ATHLETE_RELATIONSHIP_ACCEPTANCE.md`
7. `docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md`
8. `docs/v1/V1_ACCEPTANCE_GATE.md`
9. `docs/v1/V1_NOT_IN_SCOPE.md`
10. executable tests and CI guards

No lower-authority document, route, schema, fixture, copy surface, billing state, support state, dormant future role, or implementation note may widen coach-athlete relationship scope beyond explicit individual assigned-only permission state.
<!-- S-V1-14:COACH-ATHLETE-RELATIONSHIP-AUTHORITY:END -->
