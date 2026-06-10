<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# v1 Data Model Freeze Point

## Status

Accepted as a planning target.

Recorded at UTC: 2026-06-04T16:31:54Z

## Context

The v0 release lane is closed.

The v1 entry lane is open.

The v1 supported activities decision is locked.

The v1 registry expansion target is accepted.

The v1 coach-athlete journey map is accepted.

v0 release tag: v0.1.24

Immutable v0 release commit: 40cc391fcc92027dbcee8313dc571ea6557b8dec

v1 coach-athlete journey commit: 3df286591f507a637a943d08a3e6036f714c923d

The v0.1.24 tag must not be moved, deleted, overwritten, or force-pushed.

This document defines the v1 product data model freeze point only. It does not add implementation code, database migrations, registry content, templates, UI, auth, billing, proof, export, or commercial surfaces.

## Purpose

The v1 data model must support the complete coach-athlete product journey without allowing app data, commercial data, UI state, notes, analytics, or future organisation/gym/marketplace surfaces to enter deterministic engine truth.

The purpose of this freeze point is to define:

- required v1 data groups
- ownership boundaries
- engine-visible data
- engine-invisible data
- relationship and permission boundaries
- session/runtime boundaries
- proof/replay boundaries
- future migration limits
- post-v1 exclusions

No implementation should start until this freeze point is accepted.

## Locked supported activities

The data model supports only the locked v1 activity set:

1. powerlifting
2. general_strength
3. rugby_union

No v1 data model field, enum, table, fixture, seed, copy entry, or relationship may imply support for excluded activities.

## Core data groups

v1 requires these data groups:

1. user_identity
2. coach_profile
3. athlete_profile
4. coach_athlete_relationship
5. athlete_invitation
6. phase1_declaration
7. registry_reference
8. programme_template
9. programme_assignment
10. deterministic_compile_record
11. session_runtime_state
12. runtime_event
13. substitution_event
14. factual_session_artefact
15. factual_history_record
16. coach_review_state
17. coach_note
18. proof_replay_reference
19. copy_legal_reference
20. audit_record

These are product data groups, not necessarily one table each.

## User identity

Purpose:

- represent authenticated product users
- support coach and athlete access
- avoid duplicating auth truth inside engine data

Required fields conceptually:

- user id
- auth provider id or auth reference
- email or login identity where applicable
- account status
- created timestamp
- updated timestamp

Engine boundary:

- user identity may be referenced by product records
- user identity must not alter deterministic compile output
- auth provider state must not enter engine truth

## Coach profile

Purpose:

- represent coach-facing account information
- support invitations, roster, assignment, and review

Required fields conceptually:

- coach id
- user id
- display name
- account status
- created timestamp
- updated timestamp

Excluded from v1:

- organisation ownership
- team ownership
- gym ownership
- federation authority
- marketplace seller state
- qualification verification claims
- medical/rehabilitation authority claims

Engine boundary:

- coach profile must not enter deterministic engine truth
- coach profile must not affect compile output
- coach profile must not alter registry selection

## Athlete profile

Purpose:

- represent athlete-facing account information
- support declarations, assignments, execution, and history

Required fields conceptually:

- athlete id
- user id
- display name
- account status
- created timestamp
- updated timestamp

Engine boundary:

- athlete profile may identify ownership of records
- athlete profile must not itself alter engine output
- only explicit engine-visible declaration/programme/session inputs may affect deterministic output

## Coach-athlete relationship

Purpose:

- grant scoped coach access to athlete records after explicit acceptance

Required states:

- no_relationship
- invite_pending
- invite_expired
- invite_declined
- relationship_active
- relationship_revoked

Required fields conceptually:

- relationship id
- coach id
- athlete id
- relationship state
- invited timestamp
- accepted timestamp where applicable
- revoked timestamp where applicable
- created timestamp
- updated timestamp

Permission boundary:

- coach can view only accepted assigned athletes
- pending, declined, expired, or revoked relationships must not grant active access
- revoked relationships may preserve lawful historical artefact access only where explicitly scoped
- relationship state must be auditable

Engine boundary:

- relationship state may gate product access
- relationship state must not alter deterministic compile output
- relationship state must not enter canonical engine hash unless explicitly defined as product reference metadata outside engine truth

## Athlete invitation

Purpose:

- allow coach to invite athlete without prematurely granting access

Required states:

- pending
- accepted
- declined
- expired
- revoked

Required fields conceptually:

- invitation id
- coach id
- athlete user reference or invite target
- invitation state
- created timestamp
- expiry timestamp where applicable
- accepted timestamp where applicable

Boundary:

- invitation does not create engine truth
- invitation does not grant coach access until accepted relationship exists
- invitation does not create declarations or programme assignments by itself

## Phase 1 declaration

Purpose:

- capture explicit athlete declaration required before compile where scoped

Required states:

- not_started
- started
- accepted
- superseded
- rejected
- expired_where_applicable

Required fields conceptually:

- declaration id
- athlete id
- activity id
- declaration schema version
- engine compatibility version
- enum bundle version
- declaration payload
- declaration hash
- acceptance state
- accepted timestamp
- superseded by reference where applicable
- created timestamp
- updated timestamp

Engine boundary:

- accepted current declaration may be engine-visible
- superseded declaration must not be used for compile
- unaccepted declaration must not be used for compile
- rejected declaration must not be used for compile
- coach notes, payment, billing, UI state, and presentation state must not mutate declaration truth

## Registry reference

Purpose:

- bind product records to deterministic registry ids

Required registry reference types:

- activity id
- movement pattern id
- exercise id
- equipment id
- substitution edge id
- programme template id
- copy/legal id

Boundary:

- records must reference known registry ids
- unknown registry ids must be rejected
- excluded activities must not enter active v1 registry references
- registry references must be deterministic and auditable

## Programme template

Purpose:

- represent approved v1 template structures for locked supported activities

Required fields conceptually:

- template id
- activity id
- template version
- programme length
- session frequency
- movement pattern coverage
- exercise eligibility
- equipment requirements
- substitution compatibility
- copy/legal reference
- status

Required statuses:

- draft
- active
- deprecated
- archived

Boundary:

- templates must only target powerlifting, general_strength, or rugby_union
- templates must not target excluded activities
- templates must not include unsupported claims
- templates must not alter engine law
- templates must compile only through deterministic inputs

## Programme assignment

Purpose:

- bind a coach-selected programme/template to an athlete

Required states:

- draft
- assigned
- active
- completed
- stopped
- superseded
- archived

Required fields conceptually:

- assignment id
- coach id
- athlete id
- relationship id
- template id or programme id
- activity id
- assignment state
- start date or start marker
- deterministic compile input reference
- created timestamp
- updated timestamp

Boundary:

- assignment requires active coach-athlete relationship
- assignment must not bypass Phase 1 declaration requirements
- assignment must not bypass engine constraints
- assignment must not mutate completed engine outputs
- assignment must not imply team, gym, organisation, marketplace, or billing scope

## Deterministic compile record

Purpose:

- store product reference to deterministic compile input and output

Required fields conceptually:

- compile record id
- assignment id
- athlete id
- activity id
- declaration id
- registry version/reference
- compile input hash
- compile output hash
- compile status
- created timestamp

Boundary:

- compile input must be canonical
- compile output must be reproducible
- coach notes must not enter compile input
- payment/billing must not enter compile input
- UI state must not enter compile input
- auth/relationship state gates access but must not alter compile output
- commercial state must not enter compile input

## Session runtime state

Purpose:

- represent current factual session status

Required states:

- not_started
- in_progress
- split
- returned
- partially_completed
- completed
- stopped

Required fields conceptually:

- session id
- assignment id
- athlete id
- activity id
- current state
- started timestamp
- last event timestamp
- terminal timestamp where applicable
- current or last work item reference
- created timestamp
- updated timestamp

Boundary:

- session state is factual
- session state must be reducible from runtime events where scoped
- session state must not infer readiness, fatigue, safety, injury risk, or medical state
- coach live viewing must not mutate session state

## Runtime event

Purpose:

- preserve factual execution events

Required event categories:

- session_started
- item_completed
- item_skipped
- item_not_reached
- substitution_selected
- session_split
- session_returned
- session_partially_completed
- session_completed
- session_stopped

Required fields conceptually:

- event id
- session id
- athlete id
- event sequence
- event type
- event payload
- event timestamp
- source classification

Boundary:

- events must be append-only where scoped
- replay must remain deterministic
- duplicate completed events must be rejected or normalised according to engine/runtime law
- coach notes must not mutate runtime events
- UI presentation state must not mutate runtime events

## Substitution event

Purpose:

- record factual substitution use

Required fields conceptually:

- substitution event id
- session id
- source exercise id
- target exercise id
- substitution edge id
- reason category where explicitly declared or deterministic
- equipment context where scoped
- timestamp

Boundary:

- substitution must be registry-backed
- substitution must preserve movement pattern and activity applicability
- substitution must not cross into excluded activities
- substitution must not imply recommendation, optimisation, diagnosis, injury risk, readiness, or medical safety
- substitution event must be visible in factual history and coach artefact review

## Factual session artefact

Purpose:

- provide coach and athlete factual review after execution

Required fields conceptually:

- artefact id
- session id
- assignment id
- athlete id
- activity id
- plan reference
- execution summary
- completion counts
- skipped counts
- not reached counts
- substitution counts
- split/return status
- source/completeness metadata
- created timestamp

Boundary:

- artefact is factual
- artefact must not claim good/bad adherence
- artefact must not infer fatigue, readiness, safety, risk, effectiveness, or causation
- artefact must not mutate engine output

## Factual history record

Purpose:

- preserve factual training history

Required fields conceptually:

- history record id
- athlete id
- session id or assignment id
- activity id
- recorded facts
- declared facts
- source metadata
- completeness metadata
- timestamp

Boundary:

- history is factual
- history may include completed, skipped, substituted, not reached, changed, increased, decreased, selected period, and coach review language
- history must not use judgement, optimisation, diagnosis, or recommendation language

## Coach review state

Purpose:

- track coach review workflow for factual artefacts

Required states:

- not_reviewed
- reviewed
- flagged_for_review
- archived

Required fields conceptually:

- review state id
- coach id
- athlete id
- artefact id or session id
- review state
- reviewed timestamp where applicable

Boundary:

- coach review state is product state
- coach review state must not alter engine truth
- coach review state must not infer athlete status

## Coach note

Purpose:

- allow coach notes while preserving deterministic engine boundary

Required fields conceptually:

- note id
- coach id
- athlete id
- related session, artefact, assignment, or history reference
- note body
- note state
- created timestamp
- updated timestamp

Boundary:

- coach note is engine-invisible
- coach note must not alter compile input
- coach note must not alter replay
- coach note must not alter proof
- coach note must not alter canonical hash
- coach note must not alter deterministic output

## Proof/replay reference

Purpose:

- reference proof/replay artefacts where explicitly scoped

Required fields conceptually:

- proof reference id
- session id or compile record id
- input hash
- output hash
- evidence envelope reference
- replay status
- created timestamp

Boundary:

- proof/replay references must not be mutated by coach notes
- proof/replay references must not include payment, billing, UI, messaging, marketplace, or commercial dashboard state
- proof/replay scope must remain lawful and explicitly defined

## Copy/legal reference

Purpose:

- bind product surfaces to approved factual wording

Required fields conceptually:

- copy id
- copy category
- allowed phrase
- forbidden phrase references
- supported surface
- activity applicability
- status

Boundary:

- copy must not claim unsupported activities
- copy must not use forbidden claim language
- copy must not imply medical, optimisation, prediction, or universal sport coverage
- copy must not widen v1 scope

## Audit record

Purpose:

- preserve factual record of important product actions

Required audit categories:

- relationship_created
- relationship_accepted
- relationship_revoked
- declaration_accepted
- declaration_superseded
- programme_assigned
- compile_created
- session_started
- session_terminal
- substitution_selected
- coach_note_created
- coach_note_updated
- coach_review_marked

Boundary:

- audit records are factual
- audit records must not alter engine truth
- audit records must not create recommendations or causal explanations

## Engine-visible data

Only these data categories may be engine-visible where explicitly required:

- accepted current Phase 1 declaration fields
- locked supported activity id
- registry ids and registry versions
- programme/template deterministic inputs
- session runtime events that are part of deterministic execution
- substitution selections where allowed
- canonical compile/session input references

Every engine-visible field must be explicit, deterministic, schema-validated, and reproducible.

## Engine-invisible data

These data categories must remain engine-invisible:

- user email
- coach profile display state
- athlete profile display state
- coach-athlete relationship status except as access gate outside engine truth
- invitation state
- coach notes
- coach review state
- payment state
- billing state
- UI presentation state
- messaging state
- marketplace state
- organisation/team/gym state
- commercial dashboard state
- analytics interpretation state
- notification state

## Permission freeze point

Minimum permission boundary:

- unauthenticated users cannot access private coach or athlete data
- coach can view only active accepted athlete relationships
- coach can assign only to active accepted athlete relationships
- coach cannot view pending invite athlete data
- coach cannot mutate athlete declarations
- coach cannot mutate completed deterministic outputs
- athlete can view their own assigned programmes and history
- athlete controls own Phase 1 declaration
- athlete can accept, decline, or revoke coach relationship where scoped
- revoked relationships remove active access
- lawful historical retention must be explicit and scoped

## Post-v1 excluded data

The v1 data model must not include active support for:

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

Placeholder references for future work must not create active functionality or product claims.

## CI proof target

Future implementation slices must prove:

- no engine input includes coach notes
- no engine input includes payment or billing state
- no engine input includes UI presentation state
- no engine input includes relationship state except allowed access gating outside engine truth
- every programme assignment references active accepted relationship
- every template references a locked supported activity
- every session references a known assignment
- every runtime event references a known session
- every substitution references known source and target exercises
- every factual artefact references known session and assignment
- every coach note references coach, athlete, and relevant object
- revoked or pending relationships do not grant active coach access
- copy/legal references reject forbidden claim language
- excluded post-v1 data groups cannot enter active v1 flows

## Acceptance criteria

S15 is accepted when:

- this document exists
- core data groups are defined
- engine-visible data is defined
- engine-invisible data is defined
- permission boundary is defined
- proof/replay boundary is defined
- coach notes are explicitly engine-invisible
- post-v1 excluded data is listed
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

The next lane is v1 engine UI auth boundary.

That lane must define how product UI, auth, relationships, notes, and commercial state are kept outside deterministic engine truth before implementation begins.
