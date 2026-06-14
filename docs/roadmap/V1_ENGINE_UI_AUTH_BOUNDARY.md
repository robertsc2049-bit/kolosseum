<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# v1 Engine UI Auth Boundary

## Status

Accepted as a planning target.

Recorded at UTC: 2026-06-04T16:36:10Z

## Context

The v0 release lane is closed.

The v1 entry lane is open.

The v1 supported activities decision is locked.

The v1 registry expansion target is accepted.

The v1 coach-athlete journey map is accepted.

The v1 data model freeze point is accepted.

v0 release tag: v0.1.24

Immutable v0 release commit: 40cc391fcc92027dbcee8313dc571ea6557b8dec

v1 data model freeze commit: 778b85952e307104b2f691b7c503599731f94fe4

The v0.1.24 tag must not be moved, deleted, overwritten, or force-pushed.

This document defines the v1 engine/UI/auth boundary only. It does not add implementation code, database migrations, registry content, templates, UI, auth, billing, proof, export, or commercial surfaces.

## Purpose

The purpose of this boundary is to ensure that product UI, authentication, permissions, relationships, coach notes, billing, commercial state, copy, and future surfaces cannot influence deterministic engine truth.

The deterministic engine remains the authority for deterministic compile/session execution outputs.

The product app may gate access, present facts, collect explicit declarations, and store factual records, but it must not infer, optimise, diagnose, recommend, rank, or mutate engine output outside defined deterministic inputs.

## Boundary principle

Engine truth and product state are separate.

Engine truth may only be affected by explicit, schema-validated, deterministic inputs.

Product state may control:

- authentication
- permissions
- relationship access
- UI visibility
- coach review workflow
- factual note storage
- factual artefact viewing
- payment access where scoped later
- copy/legal presentation

Product state must not control:

- canonical engine hashes
- deterministic compile output
- replay output
- registry law
- substitution truth
- runtime event truth
- proof/evidence truth

## Engine-visible inputs

Only these categories may enter deterministic engine input where explicitly required:

- accepted current Phase 1 declaration fields
- locked supported activity id
- known registry ids
- known registry versions
- programme/template deterministic structure
- explicit session runtime events
- explicit allowed substitution selections
- canonical compile/session input references

Every engine-visible input must be:

- explicit
- schema-validated
- canonicalised
- reproducible
- hashable where scoped
- independent from UI state
- independent from coach notes
- independent from auth provider state
- independent from billing or commercial state

## Engine-invisible product state

The following must remain engine-invisible:

- user email
- auth provider id
- auth session state
- coach profile display state
- athlete profile display state
- invitation state
- coach-athlete relationship state except as access gate outside engine truth
- coach notes
- coach review state
- UI display state
- selected tab, drawer, filter, or sort state
- notification state
- payment state
- billing state
- subscription state
- commercial dashboard state
- marketplace state
- messaging state
- organisation/team/gym state
- analytics interpretation state
- support/admin handling state

These may exist in the product where scoped, but they must not enter engine input, canonical hashes, replay truth, proof truth, or deterministic output.

## Authentication boundary

Auth proves who the user is.

Auth may gate access to product records.

Auth must not alter deterministic engine output.

Auth must not:

- change compile output
- change session replay
- change registry selection
- change substitution result
- change proof/evidence hashes
- create declarations automatically
- create coach-athlete relationships automatically
- create programme assignments automatically

Auth implementation later must prove:

- unauthenticated users cannot access private coach or athlete data
- authenticated users only access records they are permitted to access
- auth state does not enter engine input
- auth state does not change canonical engine hash

## Permission boundary

Permissions decide who may view or act on product records.

Permissions must be checked before product actions.

Permissions must not become engine truth.

Minimum v1 permission rules:

- coach can view only athletes with active accepted relationships
- coach can assign only to athletes with active accepted relationships
- coach cannot view pending invite athlete data
- coach cannot mutate athlete Phase 1 declarations
- coach cannot mutate completed deterministic outputs
- coach cannot trigger live substitution
- coach cannot alter live session state by watching
- athlete can view own programmes and history
- athlete controls own Phase 1 declaration
- athlete can accept, decline, or revoke coach relationship where scoped
- revoked relationship removes active coach access
- lawful historical retention must be explicit and scoped

Implementation later must prove permissions with tests before UI surfaces depend on them.

## Relationship boundary

Coach-athlete relationship state gates access.

Relationship state must not alter deterministic engine output.

Allowed relationship states:

- no_relationship
- invite_pending
- invite_expired
- invite_declined
- relationship_active
- relationship_revoked

Rules:

- pending invite grants no active coach access
- declined invite grants no active coach access
- expired invite grants no active coach access
- revoked relationship removes active coach access
- active relationship may allow scoped coach access
- relationship state is auditable
- relationship state cannot mutate engine output

## UI boundary

UI displays facts and collects explicit user actions.

UI must not become engine authority.

UI may:

- render assigned programmes
- render session execution screens
- render factual artefacts
- render history
- render coach notes
- render status/error states
- collect explicit declarations
- collect explicit session events
- collect explicit substitution selections where allowed

UI must not:

- infer readiness
- infer fatigue
- infer injury risk
- recommend substitutions
- optimise programmes
- diagnose issues
- change engine output through display state
- hide deterministic failures as successful outcomes
- convert coach notes into engine input
- convert billing/commercial state into engine input

UI state such as selected tabs, filters, sorting, drawer state, modal state, theme, device width, or presentation state must remain engine-invisible.

## Coach notes boundary

Coach notes are product records.

Coach notes are engine-invisible.

Coach notes must not alter:

- Phase 1 declaration truth
- compile input
- compile output
- canonical hash
- runtime event history
- replay output
- proof/evidence output
- substitution truth
- factual artefact truth

Coach notes may reference:

- coach
- athlete
- session
- artefact
- assignment
- history record

Coach notes must remain outside deterministic input and replay.

Implementation later must include tests proving coach notes cannot enter engine input.

## Billing and commercial boundary

Billing and commercial state are not v1 engine inputs.

Payment or billing state may later gate product access where explicitly scoped, but must not alter deterministic engine truth.

Billing/commercial state must not:

- change compile output
- change registry selection
- change substitution result
- change session runtime truth
- change replay output
- change proof/evidence output
- create activity support claims
- create coach authority claims
- create organisation/team/gym product scope

v1 does not include enterprise billing, full commercial dashboards, marketplace, gym access, or EPOS.

## Copy/legal boundary

Copy is product presentation, not engine truth.

Copy/legal registry may define approved wording for product surfaces.

Copy must remain factual.

Allowed copy language includes:

- recorded
- declared
- selected
- assigned
- accepted
- completed
- skipped
- not reached
- substituted
- split
- returned
- stopped
- available
- reviewed by coach

Forbidden copy language includes:

- optimal
- recommended
- safe
- injury risk
- readiness
- fatigue
- diagnosis
- rehabilitation
- predicts
- prevents
- improves performance
- guarantees
- good adherence
- bad adherence
- poor adherence
- programme worked
- programme failed

Copy must not widen v1 beyond:

- powerlifting
- general_strength
- rugby_union

## Registry boundary

The registry is deterministic product input.

Registry ids may enter engine input only where known, locked, validated, and versioned.

Registry content must not be selected based on:

- coach note text
- UI display state
- auth provider state
- payment/billing status
- commercial dashboard state
- marketplace state
- organisation/team/gym state
- analytics interpretation state

Registry implementation later must prove:

- unknown ids are rejected
- excluded activities are rejected
- copy claims are controlled
- substitution edges are deterministic
- templates target only locked supported activities

## Substitution boundary

Substitution must remain deterministic and registry-backed.

Substitution may use:

- source exercise id
- allowed target exercise ids
- movement pattern
- stimulus intent
- equipment context where explicit
- explicit athlete/session constraints where scoped
- deterministic ordering key

Substitution must not use:

- coach notes
- inferred readiness
- inferred fatigue
- injury risk score
- diagnosis
- optimisation model
- commercial priority
- UI display state
- billing state
- marketplace state

Substitution output must be explainable as factual rule application, not recommendation.

## Live session boundary

Live session status is read-only for coaches.

Coach live viewing may show:

- not_started
- in_progress
- split
- returned
- partially_completed
- completed
- stopped
- started_at
- last_event_at
- completed count
- skipped count
- substitution count
- current or last work item
- event timeline where scoped

Coach live viewing must not:

- mutate session state
- mutate runtime events
- trigger substitution
- edit programme
- alter engine output
- message athlete
- apply readiness/fatigue/risk labels
- create intervention recommendations

## Proof and replay boundary

Proof/replay surfaces must reflect deterministic facts.

Proof/replay must not include:

- coach notes
- payment state
- billing state
- UI presentation state
- messaging state
- marketplace state
- commercial dashboard state
- organisation/team/gym state
- analytics interpretation state

Proof/replay references may include:

- canonical input hash
- canonical output hash
- registry version/reference
- evidence envelope reference
- replay status
- factual event references where scoped

Coach review and coach notes must not mutate proof/replay.

## Analytics and interpretation boundary

v1 may show factual counts, states, and history where scoped.

v1 must not include broad analytics or inferential interpretation.

Allowed factual outputs:

- counts
- rates
- percentages
- sums
- averages
- ranges
- rolling averages where explicitly scoped
- absolute change
- percentage change
- trend direction where purely descriptive
- data completeness
- source classification
- plan versus execution deltas

Forbidden interpretation outputs:

- recommended action
- optimal load
- readiness score
- fatigue score
- injury risk score
- causal conclusion
- programme worked
- programme failed
- athlete is improving because of X
- coach should do Y
- predicted outcome

## Post-v1 excluded surfaces

The boundary excludes:

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

## Required guard functions later

Implementation later should introduce explicit boundary guards where appropriate:

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

These guards are future implementation targets, not code in this slice.

## CI proof target

Future implementation slices must prove:

- auth state does not enter engine input
- relationship state gates access but does not alter engine output
- coach notes cannot enter engine input
- billing/commercial state cannot enter engine input
- UI state cannot enter engine input
- coach live viewing cannot mutate session state
- coach cannot trigger substitution from live view
- substitution cannot use inferred readiness/fatigue/risk
- proof/replay output is unchanged by coach notes
- proof/replay output is unchanged by billing/commercial state
- copy guard rejects forbidden claim language
- unsupported activities remain excluded
- templates remain inside locked supported activities
- registry references reject unknown ids
- no post-v1 surface enters active v1 flows

## Acceptance criteria

S16 is accepted when:

- this document exists
- engine-visible inputs are defined
- engine-invisible product state is defined
- auth boundary is defined
- permission boundary is defined
- relationship boundary is defined
- UI boundary is defined
- coach notes boundary is defined
- billing/commercial boundary is defined
- copy/legal boundary is defined
- registry boundary is defined
- substitution boundary is defined
- live session boundary is defined
- proof/replay boundary is defined
- analytics/interpretation boundary is defined
- post-v1 excluded surfaces are listed
- future guard functions are listed
- CI proof target is listed
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

The next lane is v1 implementation readiness checklist.

That lane must define what must exist before the first implementation slice begins.

<!-- S-V1-04:APP-ENGINE-BOUNDARY-CONTRACT:START -->
## S-V1-04 App-Engine Boundary Contract

Status: active app-engine isolation contract.

This section binds app, UI, API, billing, auth, notes, copy, legal, marketing, and commercial state outside the deterministic engine.

This section does not add implementation code, product routes, payment flows, auth flows, UI screens, registry content, database migrations, proof surfaces, or commercial capability.

### Required isolation invariants

- Engine must not read auth state.
- Engine must not read billing state.
- Engine must not read payment state.
- Engine must not read coach notes.
- Engine must not read UI density state.
- Engine must not read ND presentation state.
- Engine must not read presentation copy.
- Engine must not read legal state.
- Engine must not read marketing state.
- Engine must not read commercial state.
- Engine output must depend only on declared engine inputs and registries.

### App and product state boundary

App, UI, API, billing, auth, notes, copy, legal, marketing, and commercial state may exist outside the deterministic engine.

Those surfaces may control access, visibility, permissions, relationship views, copy presentation, billing surfaces, legal presentation, support workflows, and commercial packaging only where separately authorised by an active slice.

Those surfaces must not become canonical engine input, registry authority, substitution truth, runtime event truth, replay truth, proof truth, evidence truth, legality authority, or deterministic compile authority.

### Forbidden engine-visible state paths

The following must remain engine-invisible:

- `auth_state`
- `auth_session`
- `auth_provider_id`
- `billing_state`
- `payment_state`
- `subscription_state`
- `coach_notes`
- `coach_note_text`
- `ui_density`
- `nd_presentation`
- `presentation_copy`
- `legal_state`
- `marketing_state`
- `commercial_state`

Equivalent camelCase keys are also forbidden.

### Proof binding

This boundary is checked by:

- `ci/guards/s_v1_04_app_engine_boundary_contract_guard.mjs`
- `ci/fixtures/v1_app_engine_boundary_negative/s_v1_04_forbidden_engine_state_paths.json`
- the existing no-coupling guard family
- the standard generated index and checksum gates

Do not fix failures by weakening the guard, widening engine inputs, adding allow-list exceptions, or moving app/product state into shared engine-visible helpers.
<!-- S-V1-04:APP-ENGINE-BOUNDARY-CONTRACT:END -->

<!-- S-V1-11:ACCOUNT-MODEL-ENGINE-AUTH-BOUNDARY:START -->
## S-V1-11 Account Model Engine/Auth Boundary

V1 supports coach and athlete accounts only.

Account state is platform state only.

Engine output must not depend on account role, account status, invite status, verification status, billing status, entitlement status, support status, or dormant future role state.

Dormant future roles may be documented only as dormant and must not become active v1 product scope.

S-V1-11 does not implement auth provider code, account routes, product UI, database migrations, payment implementation, organisation scope, organization scope, team scope, gym scope, unit scope, federation scope, enterprise billing, marketplace, messaging, chat, EPOS, gym access, full dashboards, or engine behaviour.
<!-- S-V1-11:ACCOUNT-MODEL-ENGINE-AUTH-BOUNDARY:END -->

<!-- S-V1-12:COACH-REGISTRATION-ENGINE-AUTH-BOUNDARY:START -->
## S-V1-12 Coach Registration Engine/Auth Boundary

Coach registration/provisioning is product/auth state only.

Coach registration cannot affect deterministic compile output.

Engine output must not depend on coach identity, coach email, coach display name, coach account state, coach accepted terms version, coach registration source, coach onboarding state, coach billing state, coach entitlement state, or coach support state.

S-V1-12 does not implement auth provider code, account routes, product UI, database migrations, payment implementation, enterprise account management, organisation scope, organization scope, team scope, gym scope, unit scope, federation scope, marketplace, coach discovery, messaging, chat, EPOS, gym access, full dashboards, or engine behaviour.
<!-- S-V1-12:COACH-REGISTRATION-ENGINE-AUTH-BOUNDARY:END -->

<!-- S-V1-13:ATHLETE-REGISTRATION-ENGINE-AUTH-BOUNDARY:START -->
## S-V1-13 Athlete Registration Engine/Auth Boundary

Athlete registration/invitation is product/auth state only.

Athlete registration cannot affect engine truth.

Athlete invitation cannot affect engine truth.

Engine output must not depend on athlete identity, athlete email, athlete display name, athlete account state, athlete accepted terms version, athlete invitation state, athlete invitation source, athlete onboarding state, athlete billing state, athlete entitlement state, or athlete support state.

S-V1-13 does not implement friends, social, team invites, organisation invites, organization invites, gym invites, unit invites, federation invites, enterprise invites, marketplace, coach discovery, messaging, chat, auth provider code, account routes, product UI, database migrations, payment implementation, or engine behaviour.
<!-- S-V1-13:ATHLETE-REGISTRATION-ENGINE-AUTH-BOUNDARY:END -->

<!-- S-V1-14:COACH-ATHLETE-RELATIONSHIP-ENGINE-AUTH-BOUNDARY:START -->
## S-V1-14 Coach-Athlete Relationship Engine/Auth Boundary

Coach-athlete relationship acceptance is product permission state only.

Coach can view assigned athletes only.

Athlete can view own data only unless explicitly permitted.

Relationship changes do not mutate engine truth.

Engine output must not depend on relationship_id, coach_user_id, athlete_user_id, relationship_state, relationship_scope, accepted_at_iso8601, revoked_at_iso8601, expires_at_iso8601, assigned-only visibility state, or access decision state.

S-V1-14 does not implement teams, organisations, organizations, gyms, units, federations, enterprise relationships, friends, social connections, messaging, chat, marketplace, coach discovery, auth provider code, account routes, product UI, database migrations, payment implementation, assignment implementation, or engine behaviour.
<!-- S-V1-14:COACH-ATHLETE-RELATIONSHIP-ENGINE-AUTH-BOUNDARY:END -->

<!-- S-V1-15:RELATIONSHIP-PERMISSION-GUARDS-ENGINE-AUTH-BOUNDARY:START -->
## S-V1-15 Relationship Permission Guards Engine/Auth Boundary

Relationship permission guard state is product/auth permission state only.

Permission failure is product/auth failure, not engine decision.

Permission guard decisions do not mutate engine truth.

Engine output must not depend on permission guard result, permission failure reason, actor identity, coach identity, athlete identity, relationship id, relationship state, relationship scope, assigned-only visibility state, surface id, or product/auth failure state.

S-V1-15 does not implement engine behaviour, registry content, broad RBAC, organisation roles, organization roles, team roles, gym roles, unit roles, federation roles, enterprise roles, friends, social connections, messaging, chat, marketplace, coach discovery, auth provider code, product UI, database migrations, payment implementation, assignment implementation, proof implementation, or server surface rewiring.
<!-- S-V1-15:RELATIONSHIP-PERMISSION-GUARDS-ENGINE-AUTH-BOUNDARY:END -->

<!-- S-V1-16:PHASE-1-DECLARATION-SURFACE-ENGINE-AUTH-BOUNDARY:START -->
## S-V1-16 Phase 1 Declaration Surface Engine/Auth Boundary

Phase 1 declaration surface state is factual product/app state until admitted through existing engine law.

The declaration surface records explicit user-declared facts and acknowledgements.

The declaration surface does not assess, diagnose, clear, score, recommend, rank, or infer.

Engine output must not depend on declaration form copy, copy acknowledgement id, product declaration state, account state, relationship state, permission guard result, payment state, support state, UI state, or presentation state.

S-V1-16 does not implement engine behaviour, registry content, database migrations, auth provider code, product UI, payment implementation, broad RBAC, organisation roles, organization roles, team roles, gym roles, unit roles, federation roles, enterprise roles, assignment implementation, or proof implementation.
<!-- S-V1-16:PHASE-1-DECLARATION-SURFACE-ENGINE-AUTH-BOUNDARY:END -->

<!-- S-V1-17:DECLARATION-ACCEPTANCE-RECORD-ENGINE-AUTH-BOUNDARY:START -->
## S-V1-17 Declaration Acceptance Record Engine/Auth Boundary

Accepted declaration record metadata is product/app validity metadata until admitted through existing engine law.

S-V1-17 may expose compile-admission precondition checks through the existing declaration-validity contract.

S-V1-17 must not run engine phases, mutate engine input, mutate engine output, create assignment authority, or create persistence authority.

Engine output must not depend on source metadata, copy metadata, product declaration state, account state, relationship state, payment state, support state, UI state, or presentation state.
<!-- S-V1-17:DECLARATION-ACCEPTANCE-RECORD-ENGINE-AUTH-BOUNDARY:END -->
