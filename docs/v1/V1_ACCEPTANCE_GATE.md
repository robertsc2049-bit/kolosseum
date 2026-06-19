<!-- DEV NOTE: V1 acceptance-control surface. This document states completion checks for v1. It does not create engine law, registry law, CI token meanings, copy authority, or commercial authority. -->

# V1 Acceptance Gate

Status: active v1 acceptance-control document.
Release name: First Lawful Run.
Slice: S-V1-00.

## Purpose

This document defines the checks that must pass before v1 can be called complete.

It is a release gate, not a behaviour specification.

## Gate rule

V1 is incomplete if any required gate item is missing, untested, manually assumed, or implemented outside its declared authority boundary.

No partial completion language is permitted for v1 acceptance.

## Required product acceptance

V1 must prove:

- coach registration or provisioning exists
- athlete registration or invitation exists
- coach-athlete relationship acceptance exists
- assigned-only coach visibility exists
- athlete self-visibility exists
- lawful Phase 1 declaration exists
- programme assignment exists
- deterministic compile path exists
- session execution exists
- split and return exists
- stop, skip, substitution, and partial completion are factual runtime events
- factual history exists
- coach factual artefact view exists
- coach notes exist and remain engine-invisible
- live session status exists as read-only factual visibility where included
- payment path exists for controlled launch
- support and onboarding docs exist

## Required engine and registry acceptance

V1 must prove:

- engine remains a deterministic library boundary
- app layer owns auth, persistence, UI, payments, and notes
- engine does not read payment state
- engine does not read coach notes
- engine does not read presentation copy
- engine does not branch on UI density or ND presentation fields
- registry load order is enforced
- registry FK closure is enforced
- registry content is complete for locked v1 supported activities
- substitution has no undeclared fallback
- missing registry entries fail closed
- supported activities are locked
- unsupported activities are rejected or dormant according to release boundary
- replay and proof surfaces are honest about their active scope

## Required auth and relationship acceptance

V1 must prove:

- coaches can only view assigned athletes
- coaches cannot view unassigned athletes
- athletes can only view their own data unless explicitly permitted
- coach notes are scoped to relationship authority
- relationship changes do not mutate engine truth
- permission failures are transport or product failures, not engine decisions

## Required copy and claim acceptance

V1 must prove no user-facing copy claims:

- medical advice
- safety
- suitability
- readiness
- optimisation
- guaranteed outcome
- injury prevention
- return to play
- return to run
- fitness for duty
- operational readiness
- deployment readiness
- capability inference
- recommended intervention
- automatic correction
- programme effectiveness

Permitted language must remain factual, recorded, declared, selected, completed, skipped, stopped, substituted, available, unavailable, assigned, viewed, exported where lawful, and source-bound.

## Required commercial acceptance

V1 must prove:

- payment state can control access, plan visibility, seats, or billing surfaces only
- payment state cannot alter engine legality
- payment state cannot alter deterministic compile output
- payment state cannot alter substitution legality
- payment state cannot alter replay or proof truth
- controlled launch path exists
- commercial copy remains claim-safe

## Required proof and export acceptance

Where v1 activates proof or export surfaces, V1 must prove:

- proof artefacts are generated only through permitted flow
- evidence wording proves process integrity only
- exports are immutable where required
- exports do not imply coaching correctness, training value, user ability, safety, suitability, readiness, or external approval
- absence of proof is not represented as proof
- failed replay does not produce accepted proof

## Required developer handover acceptance

V1 must prove:

- active release boundary is documented
- v1 not-in-scope list is documented
- authority map is documented
- slice template exists
- PR template requires boundary, proof, and non-scope
- failure token index is generated
- guard index is generated
- checksums are regenerated
- future developer can find current boundary without founder memory

## Required CI acceptance

Before v1 completion, from a clean tree, these must pass unless replaced by a stricter v1 command:

    npm run verify
    npm run lint:fast
    npm run test:ci
    npm run test:ci:integration

Targeted v1 release gates must also pass where present:

    node ci/scripts/run_v1_release_gate.mjs

If a command is renamed, the replacement must be documented in the active release boundary and README/commands surfaces.

## Final acceptance statement

V1 may be called complete only when the coach-athlete product works end to end and CI proves that product, UI, auth, billing, notes, copy, metrics, proof, and commercial surfaces do not alter engine truth.

## Required controlled-launch operational acceptance

V1 must prove operational readiness for a controlled commercial launch without creating new product scope or engine authority.

V1 controlled-launch operations may include public status, factual error-reporting, backup, restore, and incident-record surfaces only where deliberately activated.

Operational monitoring must remain factual. It must not create readiness, safety, suitability, effectiveness, coaching-quality, medical, operational, or external-approval claims.

Implementation-specific thresholds, alert timings, incident response targets, and service-level targets belong in operational readiness records, not engine law or release-boundary law.

## Required legal acceptance

V1 must prove controlled-launch legal surfaces exist where activated.

Required legal surfaces may include:

- terms surface
- privacy surface
- DPA surface where required
- GDPR export handling
- GDPR deletion-request handling

Legal surfaces must not imply medical, safety, suitability, readiness, coaching-quality, training-effectiveness, operational, or external-approval claims.

## Required billing acceptance

V1 must prove controlled-launch billing surfaces exist where activated.

Required billing acceptance may include:

- Stripe Checkout or equivalent payment entry flow
- customer portal or equivalent billing-management flow
- upgrade and downgrade event handling for access, seats, or billing records only
- non-payment access handling as a product-access rule only

Billing state must not alter engine legality, deterministic compile output, substitution legality, replay truth, proof truth, factual history, or coach-athlete relationship truth.

<!-- S-V1-08:CI-MASTER-GATE-ACCEPTANCE-POINTER:START -->
## CI master gate pointer

V1 completion is blocked unless the v1 CI master gate definition is satisfied.

Gate definition:

- `docs/v1/V1_CI_MASTER_GATE.md`
- `docs/v1/V1_CI_MASTER_GATE.json`
- `ci/guards/s_v1_08_ci_master_gate_definition_guard.mjs`

The v1 CI master gate must distinguish:

- v0 closure
- v1 boundary
- registry
- copy and claims
- auth and permissions
- proof, replay, and export
- no-coupling and engine truth

This pointer does not add product law, engine law, registry law, copy authority, workflow authority, or release approval.
<!-- S-V1-08:CI-MASTER-GATE-ACCEPTANCE-POINTER:END -->

<!-- S-V1-10:ACCEPTANCE-GATE-CLOSURE:START -->
## S-V1-10 Acceptance Gate Closure

V1 equals a complete coach-athlete product with proof layer and full supported registry/template/substitution coverage.

For S-V1-10, full supported registry/template/substitution coverage means full v1 coverage for the locked supported activities only. It does not unlock unsupported activities or post-v1 markets.

Controlled launch support is allowed only where separately sliced and only where it cannot alter engine truth.

Controlled launch support may control access, billing records, legal presentation, public status, error reporting, backup and restore evidence, or factual notifications where later slices explicitly permit it. It must not alter deterministic engine truth, programme assignment legality, compile output, substitution legality, replay truth, proof truth, factual history, or coach-athlete relationship authority.

The following remain excluded from v1 unless a later post-v1 boundary rewrite explicitly reopens them: organisations, organizations, teams, gyms, units, federations, marketplace, messaging, chat, EPOS, gym access, full dashboards, enterprise.

S-V1-10 does not create product implementation, engine implementation, registry content, payment implementation, auth implementation, UI implementation, database migrations, workflow authority, commercial authority, legal authority, proof authority, or release approval.

V1 may be accepted only when this closure agrees with the release boundary, not-in-scope list, authority map, CI master gate, and executable guards.

Acceptance cannot be inferred from partial surfaces, placeholder screens, copy, commercial readiness, payment state, founder memory, or hidden manual approval.
<!-- S-V1-10:ACCEPTANCE-GATE-CLOSURE:END -->

<!-- S-V1-11:ACCOUNT-MODEL-ACCEPTANCE:START -->
## S-V1-11 Account Model Acceptance

V1 acceptance requires the account model to remain coach and athlete only.

Account state must not alter engine truth.

Dormant future roles may be documented only as dormant.

Acceptance is blocked if account implementation introduces active organisation, organization, team, gym, unit, federation, enterprise, marketplace, messaging, chat, EPOS, gym access, full dashboard, auth-provider implementation, payment implementation, database migration, UI implementation, or engine behaviour under S-V1-11.
<!-- S-V1-11:ACCOUNT-MODEL-ACCEPTANCE:END -->

<!-- S-V1-12:COACH-REGISTRATION-ACCEPTANCE:START -->
## S-V1-12 Coach Registration Acceptance

V1 acceptance requires the coach registration/provisioning path to remain product/auth state only.

Acceptance requires proof that:

- coach identity can be provisioned with account_role = coach
- non-coach account roles are refused
- unknown account fields are refused
- attempted engine-visible fields are refused
- coach registration cannot affect deterministic compile output
- copy remains factual

Acceptance is blocked if S-V1-12 introduces auth provider implementation, database migrations, product UI, payment implementation, enterprise account management, organisation admin, organization admin, team admin, gym admin, unit admin, federation admin, marketplace, coach discovery, messaging, chat, EPOS, gym access, full dashboard, registry content, engine behaviour, proof implementation, relationship implementation, or assignment implementation.
<!-- S-V1-12:COACH-REGISTRATION-ACCEPTANCE:END -->

<!-- S-V1-13:ATHLETE-REGISTRATION-ACCEPTANCE:START -->
## S-V1-13 Athlete Registration Acceptance

V1 acceptance requires the athlete registration/invitation path to remain product/auth state only.

Acceptance requires proof that:

- athlete identity can be provisioned with account_role = athlete
- athlete invitation can be created for invitation_target_role = athlete
- accepted athlete invitation is still not relationship creation
- non-athlete account roles are refused
- non-athlete invitation targets are refused
- friends, social, team, organisation, organization, gym, unit, federation, enterprise, marketplace, coach discovery, messaging, and chat scope are refused
- unknown account fields are refused
- attempted engine-visible fields are refused
- attempted relationship-created fields are refused
- athlete registration/invitation cannot affect engine truth
- invite copy remains factual and does not imply coaching outcome, safety, suitability, or readiness

Acceptance is blocked if S-V1-13 introduces friends, social, team invites, organisation invites, organization invites, gym invites, unit invites, federation invites, enterprise invites, marketplace, coach discovery, messaging, chat, auth provider implementation, database migrations, product UI, payment implementation, registry content, engine behaviour, proof implementation, relationship implementation, or assignment implementation.
<!-- S-V1-13:ATHLETE-REGISTRATION-ACCEPTANCE:END -->

<!-- S-V1-14:COACH-ATHLETE-RELATIONSHIP-ACCEPTANCE:START -->
## S-V1-14 Coach-Athlete Relationship Acceptance

V1 acceptance requires explicit individual coach-athlete relationship acceptance before coach visibility exists.

Acceptance requires proof that:

- accepted individual coach-athlete relationship allows assigned coach visibility
- unassigned coach access is refused
- invited, rejected, revoked, and expired relationship states do not grant coach visibility
- athlete can view own data
- athlete cannot view another athlete's data unless explicitly permitted
- relationship changes do not mutate engine truth
- relationship scope refuses team, organisation, organization, gym, unit, federation, enterprise, social, friend, marketplace, messaging, and chat scope
- copy remains factual and does not imply coaching outcome, safety, suitability, readiness, recommendation, optimisation, ranking, medical meaning, operational meaning, external approval, social connection, or team membership

Acceptance is blocked if S-V1-14 introduces teams, organisations, organizations, gyms, units, federations, enterprise relationships, friends, social connections, messaging, chat, marketplace, coach discovery, auth provider implementation, database migrations, product UI, payment implementation, assignment implementation, registry content, engine behaviour, or proof implementation.
<!-- S-V1-14:COACH-ATHLETE-RELATIONSHIP-ACCEPTANCE:END -->

<!-- S-V1-15:RELATIONSHIP-PERMISSION-GUARDS:START -->
## S-V1-15 Relationship Permission Guards Acceptance

V1 acceptance requires reusable relationship permission guards to fail closed and remain product/auth permission state only.

Acceptance requires proof that:

- assertCoachCanViewAthlete allows assigned coach access only
- assertCoachCanViewAthlete rejects unassigned coach access
- assertCoachCanViewAthlete rejects invited, rejected, revoked, expired, and non-individual relationship scope
- assertAthleteCanViewOwnData allows athlete own-data access
- assertAthleteCanViewOwnData rejects another athlete's data
- assertCoachAthleteAccess routes coach and athlete actors correctly
- permission failure is product/auth failure, not engine decision
- permission guard state does not mutate engine truth
- permission guard functions are reusable by coach notes, factual artefact viewing, live session status, and factual history surface ids
- broad RBAC, organisation roles, organization roles, team roles, gym roles, unit roles, federation roles, enterprise roles, social connections, messaging, chat, marketplace, and coach discovery are refused

Acceptance is blocked if S-V1-15 introduces engine behaviour, registry content, broad RBAC, organisation roles, organization roles, team roles, gym roles, unit roles, federation roles, enterprise roles, friends, social connections, messaging, chat, marketplace, coach discovery, auth provider implementation, database migrations, product UI, payment implementation, assignment implementation, proof implementation, or server surface rewiring.
<!-- S-V1-15:RELATIONSHIP-PERMISSION-GUARDS:END -->

<!-- S-V1-16:PHASE-1-DECLARATION-SURFACE:START -->
## S-V1-16 Phase 1 Declaration Surface Acceptance

V1 acceptance requires a factual user-declared Phase 1 declaration surface before compile admission.

Acceptance requires proof that:

- valid declaration input is accepted
- missing required top-level fields are rejected
- missing required payload fields are rejected
- unknown top-level fields are rejected
- unknown payload fields are rejected
- false required acknowledgements are rejected
- version mismatch is rejected
- copy remains factual and claim-safe
- declaration state does not mutate engine truth
- the existing Phase 1 acceptance record suite remains green

Acceptance is blocked if S-V1-16 implies medical advice, diagnosis, medical assessment, safety clearance, suitability clearance, readiness scoring, risk scoring, recommendation, training outcome, external approval, engine behaviour, registry content, database migrations, auth provider implementation, product UI, payment implementation, broad RBAC, organisation roles, organization roles, team roles, gym roles, unit roles, federation roles, enterprise roles, assignment implementation, or proof implementation.
<!-- S-V1-16:PHASE-1-DECLARATION-SURFACE:END -->

<!-- S-V1-17:DECLARATION-ACCEPTANCE-RECORD:START -->
## S-V1-17 Declaration Acceptance Record Acceptance

V1 acceptance requires accepted declaration records to prove deterministic hash metadata, factual source metadata, immutable field identity, and explicit supersession state.

Acceptance requires proof that:

- accepted records carry deterministic hash metadata
- accepted records carry factual source metadata
- immutable accepted fields cannot be changed
- supersession preserves payload, hash metadata, and source metadata
- superseded records fail compile-admission precondition
- hash mismatch fails closed
- S-V1-16 declaration surface tests remain green
- the existing Phase 1 acceptance record suite remains green
- v0 active scope remains green

Acceptance is blocked if S-V1-17 creates a second declaration system, mutates engine output, widens compile beyond declaration-validity contract checks, adds database persistence, adds UI, adds assignment authority, or weakens S-V1-16/S28 proof.
<!-- S-V1-17:DECLARATION-ACCEPTANCE-RECORD:END -->

<!-- S-V1-18:DECLARATION-COMPILE-GATE:START -->
## S-V1-18 Declaration Compile Gate Acceptance

V1 acceptance requires compile admission to depend on a current valid accepted declaration record.

Acceptance requires proof that:

- missing declaration fails closed
- unaccepted declaration fails closed
- superseded declaration fails closed
- hash mismatch fails closed
- invalid accepted declaration metadata fails closed
- current valid accepted declaration passes
- product state cannot mutate declaration truth
- product state cannot alter compile probe output
- S-V1-16, S-V1-17, Phase 1 acceptance record, no-coupling, and v0 active scope proof remain green

Acceptance is blocked if S-V1-18 makes coach notes, payment state, billing state, presentation state, UI state, account state, relationship state, or support state part of engine input.
<!-- S-V1-18:DECLARATION-COMPILE-GATE:END -->

<!-- S-V1-19:ONBOARDING-START-GATE:START -->
## S-V1-19 Onboarding Start Gate Acceptance

V1 acceptance requires executable session flow to be blocked unless required factual onboarding state exists.

Acceptance requires proof that:

- missing onboarding trigger blocks with factual reason
- missing athlete account blocks with factual reason
- inactive athlete account blocks with factual reason
- missing relationship blocks with factual reason
- non-accepted relationship blocks with factual reason
- missing declaration blocks with factual reason
- invalid declaration compile gate blocks with factual reason
- valid path is allowed
- onboarding state cannot mutate engine-facing probe output
- S-V1-13 through S-V1-18 proofs remain green

Acceptance is blocked if S-V1-19 emits advice, recommendation, medical clearance, safety judgement, suitability judgement, team onboarding, or engine mutation.
<!-- S-V1-19:ONBOARDING-START-GATE:END -->

<!-- S-V1-U-02:COACH-DASHBOARD-SHELL-ACCEPTANCE:START -->
## S-V1-U-02 Coach Dashboard Shell Acceptance

Acceptance checks:

- assigned coach sees assigned athlete row
- unassigned athlete row is absent
- revoked relationship row is absent
- coach dashboard shell emits copy ids
- shell projection emits factual fields only
- API adapter refuses non-coach actors without engine tokens
- shell data remains engine-inert

Proof:

- node --test test/s_v1_u_02_coach_dashboard_shell.test.mjs
- node ci/guards/s_v1_u_02_coach_dashboard_shell_guard.mjs
<!-- S-V1-U-02:COACH-DASHBOARD-SHELL-ACCEPTANCE:END -->

<!-- S-V1-U-03:COACH-REVIEW-QUEUE-ACCEPTANCE:START -->
## S-V1-U-03 Coach Review Queue Acceptance

Acceptance checks:

- assigned coach sees assigned athlete review rows only
- unassigned athlete rows are absent
- revoked relationship rows are absent
- queue rows show recorded facts and review status only
- projection emits copy ids
- API adapter refuses non-coach actors without engine tokens
- queue data remains engine-inert

Proof:

- node --test test/s_v1_u_03_coach_review_queue.test.mjs
- node ci/guards/s_v1_u_03_coach_review_queue_guard.mjs
<!-- S-V1-U-03:COACH-REVIEW-QUEUE-ACCEPTANCE:END -->

<!-- S-V1-U-04:TEMPLATE-ASSIGNMENT-UI-ACCEPTANCE:START -->
## S-V1-U-04 Template Assignment UI Acceptance

Acceptance checks:

- authorised coach sees assigned athletes only
- authorised coach sees assignable template metadata only
- non-coach actor is refused
- unassigned athlete submission is refused
- hidden template internals are refused before UI exposure
- assignment submission emits product-layer envelope only
- assignment submission requires declared compile path later
- assignment UI and submission remain engine-inert

Proof:

- node --test test/s_v1_u_04_template_assignment_ui.test.mjs
- node ci/guards/s_v1_u_04_template_assignment_ui_guard.mjs
<!-- S-V1-U-04:TEMPLATE-ASSIGNMENT-UI-ACCEPTANCE:END -->

<!-- S-V1-U-05:SESSION-EXECUTION-POLISH-ACCEPTANCE:START -->
## S-V1-U-05 Session Execution Polish Acceptance

Acceptance requires:

- mobile execution polish surface renders from existing session state;
- minimal-input actions are presentation descriptors only;
- accessibility contract metadata is present;
- ND presentation changes only presentation fields;
- copy IDs are emitted without inline user-facing copy;
- no engine import, compile call, registry mutation, or runtime reducer semantic change is introduced;
- `node --test test/s_v1_u_05_session_execution_polish.test.mjs` passes;
- `node ci/guards/s_v1_u_05_session_execution_polish_guard.mjs` passes.
<!-- S-V1-U-05:SESSION-EXECUTION-POLISH-ACCEPTANCE:END -->

## S-V1-F-01 Founder Test Pack Acceptance

V1 acceptance requires a founder-controlled manual test pack for controlled launch.

The founder test pack must cover coach registration, athlete registration, relationship acceptance, declaration, assignment, compile, execution, split/return, partial completion, history, artefacts, notes, live status, proof/export, payment, legal, and support surfaces.

The founder test pack is accepted only when:

- `docs/v1/V1_FOUNDER_TEST_PACK.md` exists.
- fixture-only accounts exist.
- manual test scripts cover the required v1 flow.
- the test pack states that it does not create product law.
- the test pack states that it does not authorise production data access.
- the target test and guard pass.
