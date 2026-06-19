<!-- DEV NOTE: S-V1-F-01 founder testing pack. This is a manual controlled-launch test surface only. It does not create product law, engine law, registry law, payment authority, legal authority, or production-data handling authority. -->

# V1 Founder Test Pack

Status: active v1 controlled-launch manual test pack.

Slice: S-V1-F-01.

## Purpose

S-V1-F-01 creates the founder test pack for controlled v1 launch.

The pack gives the founder a repeatable manual test script over the v1 coach-athlete product journey.

The pack is evidence for founder testing only. It does not create product law.

The pack does not authorise production data access.

The pack does not add post-v1 product scope.

## Boundary

S-V1-F-01 may add:

- manual founder test scripts
- fixture-only account records
- fixture-only coach and athlete identities
- fixture-only relationship records
- fixture-only declaration, assignment, session, artefact, payment, legal, and support references
- test pack documentation
- tests and guard proof that the pack exists and stays inside controlled-launch scope

S-V1-F-01 must not add:

- production data access
- production account creation
- production database connection
- live payment provider calls
- live email sending
- live notification sending
- legal advice
- support ticket automation
- engine behaviour
- registry law
- runtime reducer behaviour
- substitution law
- new product routes
- marketplace
- messaging
- team, organisation, unit, gym, federation, or enterprise runtime

## Authority

This manual test pack is subordinate to the canonical v1 product, engine, registry, proof, payment, legal, and support documents.

If a manual test step and a canonical implementation document disagree, the canonical implementation document wins.

Manual test observations are recorded as founder QA evidence only.

Manual test observations must not be treated as product law, engine law, registry law, CI law, commercial authority, legal authority, or launch approval by themselves.

## Fixture account rule

All S-V1-F-01 accounts are fixture-only.

Fixture accounts must use non-production identifiers and non-routable example domains.

Fixture accounts must not contain real user personal data.

Fixture accounts must not connect to production systems.

Fixture accounts must not create coach-athlete relationship authority outside the fixture pack.

## Required coverage

The founder test pack must cover these v1 areas:

1. Coach registration or provisioning.
2. Athlete registration or invitation.
3. Coach-athlete relationship acceptance.
4. Phase 1 declaration.
5. Programme assignment.
6. Deterministic compile path.
7. Mobile session execution.
8. Split and return.
9. Stop, skip, and partial completion.
10. Factual history.
11. Coach factual artefact view.
12. Coach notes as engine-invisible records.
13. Live session status as read-only factual visibility.
14. Proof artefact view and export boundary.
15. Controlled-launch payment path.
16. Legal document surfaces.
17. Support, status, error reporting, backup/restore evidence, and runbook checks.

## Manual script

### F01-001 Coach registration or provisioning

Actor: founder using fixture coach account.

Fixture reference: `fixture_coach_founder_01`.

Steps:

1. Open the coach registration or provisioning surface.
2. Enter fixture coach identity data only.
3. Confirm the account is represented as coach product/auth state.
4. Confirm no deterministic compile output is created by registration alone.

Expected record:

- coach account fixture exists
- product/auth state recorded
- no engine input created
- no production data touched

### F01-002 Athlete registration or invitation

Actor: founder using fixture athlete account.

Fixture reference: `fixture_athlete_founder_01`.

Steps:

1. Open the athlete registration or invitation surface.
2. Enter fixture athlete identity data only.
3. Confirm the athlete account is product/auth state.
4. Confirm no relationship is created until explicit relationship acceptance.

Expected record:

- athlete account fixture exists
- invitation or registration state recorded
- no coach visibility before relationship acceptance
- no production data touched

### F01-003 Coach-athlete relationship acceptance

Actor: founder using fixture coach and athlete accounts.

Fixture references:

- `fixture_coach_founder_01`
- `fixture_athlete_founder_01`
- `fixture_relationship_founder_01`

Steps:

1. Confirm relationship starts in fixture pending state.
2. Accept the relationship as the fixture athlete.
3. Confirm assigned coach visibility is scoped to the fixture athlete.
4. Confirm unassigned coach visibility is refused.

Expected record:

- accepted fixture relationship exists
- assigned-only visibility confirmed
- unassigned visibility refused
- relationship state does not alter engine truth

### F01-004 Phase 1 declaration

Actor: fixture athlete.

Fixture reference: `fixture_declaration_founder_01`.

Steps:

1. Open the Phase 1 declaration surface.
2. Enter fixture declaration values only.
3. Accept the declaration.
4. Confirm missing, superseded, or hash-mismatched declaration states block compile admission.

Expected record:

- accepted declaration record exists
- declaration hash exists
- invalid declaration state is refused
- coach cannot override athlete declaration inside engine path

### F01-005 Programme assignment

Actor: assigned fixture coach.

Fixture reference: `fixture_assignment_founder_01`.

Steps:

1. Open the programme assignment surface.
2. Select the fixture athlete.
3. Select the fixture template.
4. Create an assignment record.
5. Confirm hidden formula or progression internals are not exposed.

Expected record:

- assignment exists for assigned fixture athlete only
- protected template internals remain hidden
- assignment does not alter engine truth until declared compile path consumes declared inputs

### F01-006 Deterministic compile path

Actor: founder using fixture assignment and accepted declaration.

Fixture reference: `fixture_compile_founder_01`.

Steps:

1. Submit fixture compile input.
2. Confirm canonical input and output identifiers are recorded.
3. Repeat the same compile input.
4. Confirm the same explicit input gives stable compile output.

Expected record:

- compile path accepts only declared fixture input
- compile output is deterministic
- payment, notes, UI, legal, and support state do not alter compile output

### F01-007 Mobile session execution

Actor: fixture athlete.

Fixture reference: `fixture_session_founder_01`.

Steps:

1. Open the assigned fixture session on mobile execution surface.
2. Start the session.
3. Record a normal work item completion.
4. Confirm the minimal-input UI presents factual actions only.

Expected record:

- session started event exists
- factual execution event exists
- presentation state does not alter engine truth
- copy remains factual

### F01-008 Split and return

Actor: fixture athlete.

Fixture reference: `fixture_split_return_founder_01`.

Steps:

1. Trigger split during the fixture session.
2. Confirm the session records a factual split event.
3. Return to the session.
4. Select return continue or return skip using declared fixture path.
5. Confirm prior truth is not mutated.

Expected record:

- split event exists
- return decision exists
- prior event truth is unchanged
- replay rejection remains in force for resolved decisions

### F01-009 Stop, skip, and partial completion

Actor: fixture athlete.

Fixture reference: `fixture_partial_completion_founder_01`.

Steps:

1. Record one skipped work item.
2. Record one partial completion.
3. Stop or complete the session according to fixture path.
4. Confirm history reflects recorded events only.

Expected record:

- skip event exists
- partial completion event exists
- terminal or stopped state is factual
- no good, bad, poor, readiness, safety, or advice wording appears

### F01-010 Factual history

Actor: fixture athlete and assigned fixture coach.

Fixture reference: `fixture_history_founder_01`.

Steps:

1. Open athlete factual history as fixture athlete.
2. Open the same athlete history as assigned fixture coach.
3. Attempt to open it as unassigned fixture coach.
4. Confirm only recorded fixture sessions and events are shown.

Expected record:

- athlete self-view allowed
- assigned coach view allowed
- unassigned coach view refused
- history is factual and source-bound

### F01-011 Coach factual artefact view

Actor: assigned fixture coach.

Fixture reference: `fixture_artefact_founder_01`.

Steps:

1. Open coach factual artefact view.
2. Confirm artefact rows are source-bound to the assigned fixture athlete.
3. Confirm an unassigned coach cannot view the artefact.
4. Confirm notes are not part of the factual artefact input.

Expected record:

- assigned coach artefact view allowed
- unassigned coach artefact view refused
- artefact view contains recorded facts only
- coach notes remain separate

### F01-012 Coach notes

Actor: assigned fixture coach.

Fixture reference: `fixture_note_founder_01`.

Steps:

1. Add a fixture coach note.
2. Confirm the note is stored as product-layer note state.
3. Compile or inspect deterministic probe using the same fixture facts.
4. Confirm the note does not alter engine input, engine output, replay, proof, or factual artefact truth.

Expected record:

- coach note exists
- note is relationship-scoped
- note is engine-invisible
- note does not alter deterministic surfaces

### F01-013 Live session status

Actor: assigned fixture coach.

Fixture reference: `fixture_live_status_founder_01`.

Steps:

1. Open live session status for assigned fixture athlete.
2. Confirm status is read-only factual visibility.
3. Confirm current or last work item and event timestamps are shown where fixture data provides them.
4. Confirm watching does not alter runtime events or session state.

Expected record:

- assigned-only live status view allowed
- read-only factual status shown
- no coach override exists
- no session mutation occurs from watching

### F01-014 Proof artefact view and export boundary

Actor: fixture athlete and assigned fixture coach.

Fixture reference: `fixture_proof_export_founder_01`.

Steps:

1. Open proof artefact view for the fixture session.
2. Confirm proof artefact view is source-bound.
3. Export the permitted proof artefact envelope reference where fixture path allows.
4. Confirm broad export scope is refused.

Expected record:

- proof artefact view available for permitted actor
- export is source-bound
- broad export is refused
- proof/export does not imply external attestation

### F01-015 Controlled-launch payment path

Actor: founder using fixture billing state.

Fixture reference: `fixture_payment_founder_01`.

Steps:

1. Open controlled-launch checkout or billing surface using fixture billing state.
2. Confirm billing access record is product access state only.
3. Confirm no live provider call is made.
4. Confirm payment state does not alter deterministic compile, execution, proof, or history.

Expected record:

- fixture billing/access record exists
- access is product access only
- no live provider call occurs
- engine truth is unchanged

### F01-016 Legal document surfaces

Actor: founder.

Fixture reference: `fixture_legal_founder_01`.

Steps:

1. Open legal index.
2. Open Terms.
3. Open Privacy.
4. Open DPA.
5. Confirm documents render as controlled-launch legal surfaces only.

Expected record:

- legal documents render
- legal copy remains factual and claim-neutral
- legal surfaces do not mutate engine, billing, relationship, proof, or history truth

### F01-017 Support, status, error reporting, backup and runbook

Actor: founder.

Fixture reference: `fixture_support_founder_01`.

Steps:

1. Open status page fixture state.
2. Trigger fixture-only error reporting event if the local test surface supports it.
3. Read fixture-only backup and restore dry-run evidence.
4. Read controlled-launch runbook sections.
5. Confirm no live production data, secret, provider, or support automation is used.

Expected record:

- status surface reports factual service state
- error reporting is local and sanitised
- backup/restore evidence is fixture-only
- runbook exists
- no production data is touched

## Founder evidence record

For each manual test, the founder must record:

- test id
- fixture ids used
- date tested
- tester initials
- observed pass, blocked, or not tested
- notes as founder QA evidence only
- linked screenshot or local artefact path where available
- statement that the observation does not create product law

## Completion rule

S-V1-F-01 is complete when:

- this document exists
- fixture-only accounts exist
- all required v1 areas are covered by manual test scripts
- automated tests prove the pack structure
- the guard proves docs, fixture, package scripts, and tests are wired
- standard proof sequence passes