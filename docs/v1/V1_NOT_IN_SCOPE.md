<!-- DEV NOTE: V1 exclusion-control surface. This document prevents accidental feature creep. It does not create product authority or change engine, registry, commercial, or CI law. -->

# V1 Not In Scope

Status: active v1 exclusion-control document.
Release name: First Lawful Run.
Slice: S-V1-00.

## Purpose

This document lists features, behaviours, claims, and surfaces that must not be implemented as v1 unless a deliberate boundary-change slice rewrites the v1 release boundary, acceptance gate, authority map, and relevant guards.

Silence is not permission.

## Excluded roles and execution scopes

The following are not active v1 runtime scope unless a later boundary rewrite explicitly activates them:

- organisation runtime
- team runtime
- unit runtime
- gym runtime
- federation runtime
- state runtime
- PTI runtime
- team-admin runtime
- unit-admin runtime
- organisation-admin runtime

Documentation may mention dormant future roles only as dormant, not active.

## Excluded product capabilities

V1 must not include:

- marketplace
- coach marketplace
- athlete marketplace
- programme marketplace
- programme royalties engine
- messaging or chat
- in-app social feed
- friends or train-together flows
- broad analytics dashboards
- team dashboards
- organisation dashboards
- unit dashboards
- federation dashboards
- gym dashboards
- gym access control
- door access
- code scanner access
- EPOS
- stock or retail flows
- education platform
- media platform
- event ticketing
- workshop ticketing
- supplement sales
- apparel sales
- enterprise account management
- enterprise billing
- HR integrations
- medical integrations

## Excluded engine behaviours

V1 must not include:

- optimisation
- recommendations
- coaching advice
- automatic coaching decisions
- behavioural judgement
- user ranking
- athlete comparison ranking
- programme quality scoring
- adherence scoring
- fatigue scoring
- readiness scoring
- risk scoring
- safety scoring
- suitability scoring
- capability inference
- predictive modelling
- causal inference
- automatic progression based on inferred success
- automatic return-to-play decision
- automatic return-to-run decision
- automatic fitness-for-duty decision
- automatic operational-readiness decision

## Excluded language

V1 user-facing copy, docs, UI, marketing, support, and release notes must not claim or imply:

- safe
- safer
- safety
- suitable
- suitability
- ready
- readiness
- cleared
- can run
- return to play
- return to run
- fit for duty
- deployment ready
- operationally ready
- recommended
- optimal
- best
- proven
- prevents injury
- reduces risk
- protects
- fixes
- corrects
- resolves pain
- rehabilitation
- treatment
- diagnosis
- medical assessment

These terms may appear only inside tests, guards, claim-ban fixtures, or boundary documents where they are explicitly listed as forbidden language.

## Metric Threshold Marker exclusion

The Metric Threshold Marker Engine is not v1 core scope.

Metric foundation may be built in v1 only if deliberately sliced and kept factual.

Forbidden metric outputs include:

- ability conclusions
- readiness conclusions
- suitability conclusions
- safety conclusions
- return-to-play conclusions
- return-to-run conclusions
- fitness-for-duty conclusions
- operational-readiness conclusions
- deployment-readiness conclusions
- recommended interventions

Permitted future marker statuses are factual statuses only:

- recorded_met
- recorded_not_met
- not_recorded
- invalid_source
- insufficient_recorded_data

## Commercial exclusions

V1 must not include:

- multi-entity billing
- enterprise procurement flows
- organisation governance dashboards
- coach revenue share automation
- royalty calculation
- pack similarity enforcement
- protected formula visibility
- sales dashboards
- broad commercial analytics
- automated upsell logic that changes engine access mid-session

A payment path may exist for controlled launch, but payment state must never alter engine truth.

## Proof and export exclusions

V1 must not represent proof as:

- correctness
- coaching validity
- athlete ability
- training effectiveness
- medical clearance
- safety clearance
- suitability clearance
- operational approval
- external certification

Proof may show process integrity only.

## Final exclusion rule

If a feature is listed here, it must remain absent, dormant, or explicitly blocked until a later release-boundary rewrite activates it.

## Controlled-launch exceptions

The following surfaces may exist in v1 only as controlled-launch support surfaces, subject to copy and claim bans and zero impact on engine truth:

- Stripe self-serve purchase and seat management
- public status and factual error-reporting surfaces
- legal document surfaces for Terms, Privacy, DPA, GDPR export, and GDPR deletion-request handling
- backup and restore readiness records
- factual email notifications only where deliberately sliced

Controlled-launch exceptions do not activate marketplace, messaging, chat, social, broad analytics, gym access, EPOS, enterprise, organisation, team, unit, federation, or dashboard scope.

Factual email notifications must not contain coaching advice, recommendations, readiness claims, safety claims, suitability claims, optimisation claims, medical claims, or any content that changes engine input, output, legality, replay, proof, substitution, or factual history.

<!-- S-V1-10:NOT-IN-SCOPE-CLOSURE:START -->
## S-V1-10 Not-In-Scope Closure

V1 equals a complete coach-athlete product with proof layer and full supported registry/template/substitution coverage.

For S-V1-10, full supported registry/template/substitution coverage means full v1 coverage for the locked supported activities only. It does not unlock unsupported activities or post-v1 markets.

Controlled launch support is allowed only where separately sliced and only where it cannot alter engine truth.

Controlled launch support may control access, billing records, legal presentation, public status, error reporting, backup and restore evidence, or factual notifications where later slices explicitly permit it. It must not alter deterministic engine truth, programme assignment legality, compile output, substitution legality, replay truth, proof truth, factual history, or coach-athlete relationship authority.

The following remain excluded from v1 unless a later post-v1 boundary rewrite explicitly reopens them: organisations, organizations, teams, gyms, units, federations, marketplace, messaging, chat, EPOS, gym access, full dashboards, enterprise.

S-V1-10 does not create product implementation, engine implementation, registry content, payment implementation, auth implementation, UI implementation, database migrations, workflow authority, commercial authority, legal authority, proof authority, or release approval.

Silence is not permission.

Excluded surfaces must not be implemented under alternative names, hidden routes, placeholder dashboards, dormant UI, seeded data, inactive feature flags, private admin screens, fixtures that become active paths, or controlled-launch wording.

Controlled-launch exceptions do not activate organisations, organizations, teams, gyms, units, federations, marketplace, messaging, chat, EPOS, gym access, full dashboards, enterprise, broad analytics, social features, or live intervention surfaces.
<!-- S-V1-10:NOT-IN-SCOPE-CLOSURE:END -->

<!-- S-V1-11:ACCOUNT-MODEL-NON-SCOPE:START -->
## S-V1-11 Account Model Non-Scope

The only active v1 account roles are coach and athlete.

The following are not active v1 account roles:

- organisation_admin
- organization_admin
- team_admin
- gym_admin
- unit_admin
- federation_admin
- enterprise_admin
- marketplace_seller
- marketplace_buyer
- support_operator
- auditor

These roles may be documented only as dormant.

S-V1-11 must not activate organisation, organization, team, gym, unit, federation, enterprise, marketplace, messaging, chat, EPOS, gym access, full dashboards, enterprise billing, marketplace billing, auth-provider implementation, payment implementation, database migrations, product UI, or engine behaviour.
<!-- S-V1-11:ACCOUNT-MODEL-NON-SCOPE:END -->

<!-- S-V1-12:COACH-REGISTRATION-NON-SCOPE:START -->
## S-V1-12 Coach Registration Non-Scope

S-V1-12 may register or provision a coach platform identity only.

S-V1-12 must not activate:

- auth provider implementation
- password implementation
- session implementation
- database migrations
- product UI
- payment implementation
- enterprise billing
- enterprise account management
- organisation admin
- organization admin
- team admin
- gym admin
- unit admin
- federation admin
- marketplace
- coach discovery
- coach directory
- messaging
- chat
- EPOS
- gym access
- full dashboards
- registry content
- engine behaviour
- proof implementation
- relationship implementation
- assignment implementation
<!-- S-V1-12:COACH-REGISTRATION-NON-SCOPE:END -->

<!-- S-V1-13:ATHLETE-REGISTRATION-NON-SCOPE:START -->
## S-V1-13 Athlete Registration Non-Scope

S-V1-13 may register an athlete platform identity or create an athlete account invitation only.

S-V1-13 must not activate:

- friends
- social
- social feed
- team invites
- organisation invites
- organization invites
- gym invites
- unit invites
- federation invites
- enterprise invites
- marketplace
- coach discovery
- coach directory
- messaging
- chat
- auth provider implementation
- password implementation
- session implementation
- database migrations
- product UI
- payment implementation
- enterprise billing
- enterprise account management
- registry content
- engine behaviour
- proof implementation
- relationship implementation
- assignment implementation
<!-- S-V1-13:ATHLETE-REGISTRATION-NON-SCOPE:END -->

<!-- S-V1-14:COACH-ATHLETE-RELATIONSHIP-NON-SCOPE:START -->
## S-V1-14 Coach-Athlete Relationship Non-Scope

S-V1-14 may create explicit individual coach-athlete relationship permission state only.

S-V1-14 must not activate:

- teams
- organisations
- organizations
- gyms
- units
- federations
- enterprise relationships
- friends
- social connections
- social graph
- messaging
- chat
- marketplace
- coach discovery
- coach directory
- auth provider implementation
- password implementation
- session implementation
- database migrations
- product UI
- payment implementation
- enterprise billing
- assignment implementation
- programme assignment authority
- registry content
- engine behaviour
- proof implementation
<!-- S-V1-14:COACH-ATHLETE-RELATIONSHIP-NON-SCOPE:END -->

<!-- S-V1-15:RELATIONSHIP-PERMISSION-GUARDS-NON-SCOPE:START -->
## S-V1-15 Relationship Permission Guards Non-Scope

S-V1-15 may create reusable product/auth relationship permission guard functions only.

S-V1-15 must not activate:

- engine behaviour
- registry content
- broad RBAC
- organisation roles
- organization roles
- team roles
- gym roles
- unit roles
- federation roles
- enterprise roles
- friends
- social connections
- social graph
- messaging
- chat
- marketplace
- coach discovery
- coach directory
- auth provider implementation
- password implementation
- session implementation
- database migrations
- product UI
- payment implementation
- enterprise billing
- assignment implementation
- programme assignment authority
- proof implementation
- server surface rewiring
<!-- S-V1-15:RELATIONSHIP-PERMISSION-GUARDS-NON-SCOPE:END -->

<!-- S-V1-16:PHASE-1-DECLARATION-SURFACE-NON-SCOPE:START -->
## S-V1-16 Phase 1 Declaration Surface Non-Scope

S-V1-16 may create a factual user-declared Phase 1 declaration surface only.

S-V1-16 must not activate:

- medical assessment
- diagnosis
- medical advice
- clinical advice
- safety clearance
- suitability clearance
- readiness scoring
- readiness labels
- risk scoring
- risk labels
- return-to-play decision
- fit-for-duty decision
- recommendation
- engine behaviour
- registry content
- programme assignment
- substitution
- proof implementation
- database migrations
- auth provider implementation
- product UI
- payment implementation
- broad RBAC
- organisation roles
- organization roles
- team roles
- gym roles
- unit roles
- federation roles
- enterprise roles
<!-- S-V1-16:PHASE-1-DECLARATION-SURFACE-NON-SCOPE:END -->

<!-- S-V1-17:DECLARATION-ACCEPTANCE-RECORD-NON-SCOPE:START -->
## S-V1-17 Declaration Acceptance Record Non-Scope

S-V1-17 may extend accepted declaration record metadata and proof only.

S-V1-17 must not activate:

- a second declaration system
- engine output changes
- registry content
- programme assignment
- substitution
- proof implementation
- database persistence
- auth provider implementation
- product UI
- payment implementation
- broad RBAC
- organisation roles
- organization roles
- team roles
- gym roles
- unit roles
- federation roles
- enterprise roles
<!-- S-V1-17:DECLARATION-ACCEPTANCE-RECORD-NON-SCOPE:END -->

<!-- S-V1-18:DECLARATION-COMPILE-GATE-NON-SCOPE:START -->
## S-V1-18 Declaration Compile Gate Non-Scope

S-V1-18 may bind declaration compile admission only.

S-V1-18 must not activate:

- real compile route mutation
- new engine phases
- database persistence
- UI
- coach notes
- billing implementation
- payment implementation
- subscription implementation
- registry content
- programme assignment
- substitution
- proof implementation
- broad RBAC
- organisation roles
- organization roles
- team roles
- gym roles
- unit roles
- federation roles
- enterprise roles
<!-- S-V1-18:DECLARATION-COMPILE-GATE-NON-SCOPE:END -->

<!-- S-V1-19:ONBOARDING-START-GATE-NON-SCOPE:START -->
## S-V1-19 Onboarding Start Gate Non-Scope

S-V1-19 may bind executable-session flow entry to factual account, relationship, and declaration state only.

S-V1-19 must not activate:

- recommendations
- coaching advice
- medical clearance
- medical assessment
- diagnosis
- safety judgement
- suitability judgement
- team onboarding
- organisation onboarding
- organization onboarding
- unit onboarding
- federation onboarding
- enterprise onboarding
- UI
- persistence
- assignment
- substitution
- proof implementation
- real compile route mutation
- engine phase mutation
<!-- S-V1-19:ONBOARDING-START-GATE-NON-SCOPE:END -->

<!-- S-V1-U-02:COACH-DASHBOARD-SHELL-NON-SCOPE:START -->
## S-V1-U-02 Coach Dashboard Shell Non-Scope

S-V1-U-02 does not add:

- broad analytics dashboard
- team dashboard
- organisation dashboard
- organization dashboard
- commercial dashboard
- marketplace
- messaging
- chat
- social feed
- rankings
- outcome labels
- payment-state branching
- engine mutation
- registry mutation
- proof mutation
- export mutation
<!-- S-V1-U-02:COACH-DASHBOARD-SHELL-NON-SCOPE:END -->

<!-- S-V1-U-03:COACH-REVIEW-QUEUE-NON-SCOPE:START -->
## S-V1-U-03 Coach Review Queue Non-Scope

S-V1-U-03 does not activate recommendation, alert escalation, intervention instruction, readiness labels, fatigue labels, risk labels, scoring, ranking, broad analytics dashboard, team dashboard, organisation dashboard, commercial dashboard, messaging, notification delivery, live coach override, engine mutation, database migration, or persistence implementation.

The coach interprets the recorded queue facts outside the deterministic engine.
<!-- S-V1-U-03:COACH-REVIEW-QUEUE-NON-SCOPE:END -->

<!-- S-V1-U-04:TEMPLATE-ASSIGNMENT-UI-NON-SCOPE:START -->
## S-V1-U-04 Template Assignment UI Non-Scope

S-V1-U-04 does not activate marketplace, coach-to-coach sharing, royalties, revenue-share logic, template publication, template authoring, template cloning, derivative programme checks, licence sale, commerce, database migration, persistence implementation, compile route mutation, engine mutation, or formula visibility.

The assignment surface records product-layer assignment intent only. It does not alter deterministic engine truth.
<!-- S-V1-U-04:TEMPLATE-ASSIGNMENT-UI-NON-SCOPE:END -->
