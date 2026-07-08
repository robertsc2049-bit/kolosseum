<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# v1 Coach-Athlete Journey Map

## Status

Accepted as a planning target.

Recorded at UTC: 2026-06-04T16:20:02Z

## Context

The v0 release lane is closed.

The v1 entry lane is open.

The v1 supported activities decision is locked.

The v1 registry expansion target is accepted.

v0 release tag: v0.1.24

Immutable v0 release commit: 40cc391fcc92027dbcee8313dc571ea6557b8dec

v1 registry expansion target commit: 814a8b902a5266a0997515ab975d5067cce38ae5

The v0.1.24 tag must not be moved, deleted, overwritten, or force-pushed.

This document defines the v1 coach-athlete journey only. It does not add implementation code, registry content, templates, UI, auth, billing, proof, export, or commercial surfaces.

## Product definition

v1 is a complete coach-athlete product for the locked supported activities:

1. powerlifting
2. general_strength
3. rugby_union

v1 must allow a coach to create an account, connect with an athlete, assign a programme, view factual execution artefacts, and add coach notes that remain outside engine truth.

v1 must allow an athlete to create an account, accept a coach relationship, complete lawful Phase 1 onboarding/declaration, receive an assigned programme, execute sessions on mobile, split and return, partially complete, substitute where allowed, and view factual history.

## Primary roles

v1 has two primary user roles:

1. coach
2. athlete

The coach and athlete relationship is explicit. No coach may view or act on an athlete without an accepted relationship.

## Secondary system actors

v1 may include internal/system actors only where needed for product operation:

- deterministic engine
- registry store
- copy/legal registry
- proof/replay service where explicitly scoped
- auth/permission guard
- notification/event system where factual and explicitly scoped

These actors must not infer, optimise, diagnose, recommend, rank, or mutate engine truth outside allowed deterministic inputs.

## Coach journey

### Coach step 1: account creation

The coach creates an account.

Required outcome:

- coach identity exists
- coach account can authenticate
- coach has no athlete access by default
- coach cannot create engine-visible athlete declarations
- coach cannot see athlete data before relationship acceptance

### Coach step 2: coach profile setup

The coach completes minimal profile setup.

Required outcome:

- display name exists
- contact/invite identity exists
- account state is usable
- no unsupported qualification, medical, federation, organisation, or team claims are required for v1

### Coach step 3: athlete invite

The coach invites an athlete.

Required outcome:

- invitation exists
- invitation is tied to the coach
- athlete receives or can access invitation
- invitation does not create active coach access until accepted
- invitation does not create engine truth

### Coach step 4: accepted relationship

The athlete accepts the relationship.

Required outcome:

- explicit coach-athlete relationship exists
- coach can see only assigned/accepted athlete records
- athlete can see connected coach
- relationship status is auditable
- declined, revoked, expired, or pending relationships do not grant access

### Coach step 5: programme template selection

The coach selects a programme template from the locked v1 template set.

Required outcome:

- template targets only powerlifting, general_strength, or rugby_union
- template references only known registry items
- template does not claim optimisation, rehabilitation, injury prevention, readiness, diagnosis, or universal sport completeness
- template can be previewed factually before assignment

### Coach step 6: programme assignment

The coach assigns a programme to an athlete.

Required outcome:

- assignment records coach id
- assignment records athlete id
- assignment records template/programme id
- assignment records activity id
- assignment records start point
- assignment records deterministic compile inputs
- assignment does not override athlete declaration requirements
- assignment does not bypass engine constraints

### Coach step 7: factual programme view

The coach views assigned programme structure.

Required outcome:

- coach sees factual planned sessions
- coach sees exercises, sets, reps, loads, timing, or declared fields where applicable
- coach sees source and status
- coach does not see hidden engine internals unless explicitly exposed as factual artefacts
- coach cannot mutate completed engine outputs

### Coach step 8: live session status view

The coach may view read-only live session status for assigned athletes.

Required outcome:

- status is factual only
- allowed statuses include not_started, in_progress, split, returned, partially_completed, completed, stopped
- coach sees started_at, last_event_at, completed count, skipped count, substitution count, current or last work item, and event timeline where scoped
- coach cannot alter live session state
- coach cannot trigger substitution
- coach cannot edit the programme during live execution
- live viewing cannot affect engine output

### Coach step 9: factual artefact review

The coach reviews factual session artefacts after execution.

Required outcome:

- coach sees plan versus execution facts
- coach sees completed, skipped, not reached, substituted, split, returned, partially completed, and stopped states
- coach sees declared or recorded values only
- coach sees data completeness where relevant
- coach does not receive automated recommendations or causal conclusions

### Coach step 10: coach note

The coach adds notes for review.

Required outcome:

- note is tied to coach, athlete, and relevant artefact/session/programme context
- note is explicitly engine-invisible
- note cannot alter replay, proof, canonical hash, compile output, or deterministic truth
- note can be edited or deleted according to product rules without mutating engine truth

### Coach step 11: factual history review

The coach views athlete history.

Required outcome:

- history is factual
- history uses recorded, declared, completed, skipped, substituted, not reached, changed, increased, decreased, selected period, and coach review language
- history shows source and completeness where relevant
- history avoids good, bad, poor adherence, fatigue, readiness, risk, safe, better, optimal, effective, recommended, programme worked, and programme failed

## Athlete journey

### Athlete step 1: account creation

The athlete creates an account.

Required outcome:

- athlete identity exists
- athlete account can authenticate
- athlete has no coach relationship by default
- athlete owns their own onboarding/declaration actions

### Athlete step 2: accept coach relationship

The athlete accepts a coach invitation or relationship request.

Required outcome:

- athlete explicitly accepts
- accepted relationship grants scoped coach visibility
- pending, declined, expired, or revoked relationships do not grant coach visibility
- acceptance is auditable

### Athlete step 3: Phase 1 onboarding and declaration

The athlete completes lawful Phase 1 onboarding/declaration.

Required outcome:

- declaration is explicit
- required fields are present
- consent and jurisdiction gates are satisfied where required
- accepted declaration is hashable
- superseded declarations are not used for compile
- unaccepted declarations are not used for compile
- coach notes, payment state, UI state, and presentation state do not mutate declaration truth

### Athlete step 4: assigned programme access

The athlete views assigned programme.

Required outcome:

- athlete sees assigned sessions
- athlete sees factual planned work
- athlete sees current availability/access rules
- athlete cannot access unsupported future surfaces
- athlete cannot self-assign unsupported activity programmes unless explicitly scoped later

### Athlete step 5: session start

The athlete starts a session.

Required outcome:

- session state is created or activated through the deterministic path
- session is tied to assignment/programme context
- starting a session records factual event state
- start does not infer readiness, fatigue, safety, or medical state

### Athlete step 6: session execution

The athlete executes planned work.

Required outcome:

- athlete can mark items complete where allowed
- athlete can skip where allowed
- athlete can record declared/allowed values
- athlete can progress through the session with minimal taps
- execution remains factual and deterministic

### Athlete step 7: split and return

The athlete may split a session and return later where allowed.

Required outcome:

- split state is explicit
- return state is explicit
- split and return do not duplicate completed events
- replay remains deterministic
- coach can view factual split/return status

### Athlete step 8: partial completion

The athlete may partially complete a session.

Required outcome:

- partial completion is explicit
- completed, skipped, and not reached work are distinguishable
- factual history preserves partial completion state
- no judgement label is applied

### Athlete step 9: substitution

The athlete may use allowed substitution.

Required outcome:

- substitution uses deterministic registry-backed rules
- substitution preserves movement pattern and activity applicability
- substitution respects equipment and explicit constraints
- substitution does not imply recommendation, optimisation, diagnosis, injury risk, readiness, or medical safety
- substitution event is visible in factual history and coach artefact review

### Athlete step 10: session finish

The athlete finishes or stops a session.

Required outcome:

- terminal state is explicit
- completed, stopped, partially completed, skipped, not reached, and substituted facts are preserved
- replay/proof path remains deterministic where scoped
- coach can view factual artefacts after completion

### Athlete step 11: history view

The athlete views factual training history.

Required outcome:

- history shows recorded and declared facts
- history avoids judgement, inference, optimisation, diagnosis, or recommendation
- athlete can see completed/skipped/substituted/not reached states
- source and date/time are available where scoped

## Shared journey states

The shared product must support these relationship states:

- no_relationship
- invite_pending
- invite_expired
- invite_declined
- relationship_active
- relationship_revoked

The shared product must support these declaration states:

- not_started
- started
- accepted
- superseded
- rejected
- expired_where_applicable

The shared product must support these programme assignment states:

- draft
- assigned
- active
- completed
- stopped
- superseded
- archived

The shared product must support these session states:

- not_started
- in_progress
- split
- returned
- partially_completed
- completed
- stopped

## Permission rules

Permission rules must be explicit.

Minimum v1 permission rules:

- coach can view only accepted assigned athletes
- coach cannot view pending invite athlete data
- coach cannot view revoked athlete data except retained lawful historical artefacts where explicitly scoped
- athlete can view their own assigned programmes and history
- athlete can accept or reject coach relationship
- athlete controls their own Phase 1 declaration
- coach notes are visible according to product rules but remain engine-invisible
- engine inputs cannot include coach notes, payment, billing, UI presentation state, or commercial state

## Data boundaries

The journey requires these data groups:

- user identity
- coach profile
- athlete profile
- coach-athlete relationship
- invitation
- Phase 1 declaration
- programme template
- programme assignment
- deterministic compile input/output references
- session runtime state
- runtime events
- substitution events
- factual history
- coach artefact review state
- coach notes
- proof/replay artefacts where scoped
- copy/legal references

Data groups that must not enter engine truth:

- coach notes
- payment state
- billing state
- UI presentation state
- messaging state
- marketplace state
- organisation/team/gym state
- commercial dashboard state
- analytics interpretation state

## UI journey surfaces

v1 requires these product surfaces later:

Coach surfaces:

- coach account setup
- athlete invite
- athlete roster
- assigned athlete overview
- programme template selection
- programme assignment
- assigned programme view
- live session status view
- factual session artefact review
- coach notes
- factual athlete history

Athlete surfaces:

- athlete account setup
- coach invitation acceptance
- Phase 1 onboarding/declaration
- assigned programme view
- mobile session execution
- split/return session state
- substitution selection where allowed
- session completion
- factual history

Shared/internal surfaces:

- auth/permission guard surface
- unsupported activity refusal surface
- copy/legal explainer surface
- factual status/error surface

## Copy rules

Journey copy must use factual language.

Allowed wording includes:

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

Forbidden wording includes:

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

## Explicit exclusions

This journey does not include:

- organisations
- teams
- gyms
- units
- federations
- marketplace
- messaging
- chat
- video
- gym access
- EPOS
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

## Acceptance criteria

S14 is accepted when:

- this document exists
- the locked supported activities remain powerlifting, general_strength, and rugby_union
- coach journey is defined
- athlete journey is defined
- shared relationship, declaration, assignment, and session states are defined
- permissions are defined
- engine-invisible data groups are defined
- UI surfaces are listed as future required surfaces
- copy rules are stated
- exclusions are stated
- no implementation code is added
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

Do not add registry content in this slice.

Do not add templates in this slice.

Do not widen v1 beyond powerlifting, general_strength, and rugby_union.

## Next lane

The next lane is v1 data model freeze point.

That lane must define the product data model boundaries before implementation begins.
