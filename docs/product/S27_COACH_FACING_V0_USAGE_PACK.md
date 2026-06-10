# S27 — Coach-facing v0 usage pack

## Target

Give the coach one exact operating pack for what they can do in v0.

## Invariant

Coach behaviour stays inside assign, view, and note boundaries.

A coach may assign permitted sessions, view factual execution artefacts, and write non-binding notes only.

A coach must not declare, decide, override, infer, edit Phase 1 declarations, alter legality, or influence engine output.

## v0 boundary

This pack applies only to Kolosseum v0 Deterministic Execution Alpha.

v0 includes:

- individual_user and coach only
- individual and coach_managed execution only
- powerlifting, rugby_union, and general_strength only
- Phase 1 through Phase 6 only
- coach assignment
- factual artefact viewing
- non-binding coach notes

v0 excludes:

- Phase 7 truth projection
- Phase 8 evidence sealing
- evidence export
- organisation, team, unit, or gym runtime
- dashboards
- analytics
- rankings
- messaging
- status scoring
- outcome evaluation
- claim language outside factual v0 boundaries

## Operating rule

Coaches may comment, never decide.

## 1. Coach quickstart

### Step 1 — Confirm coach-managed link

The coach may operate only where an explicit coach-managed athlete link exists and is accepted.

If no accepted link exists, the coach must not assign, view, or note against that athlete.

### Step 2 — Assign a session

The coach may assign a session that already exists within the lawful v0 system boundary.

The assignment action may expose the session to the linked athlete.

The assignment action must not:

- alter Phase 1 declarations
- alter engine legality
- alter constraint resolution
- alter selection
- alter runtime truth
- create evidence

### Step 3 — Athlete executes the session

The athlete executes the session.

The coach does not execute the session on the athlete's behalf.

Runtime events are factual records only.

### Step 4 — View factual artefacts

The coach may view factual artefacts for linked athletes within granted scope.

Allowed artefact views are limited to:

- assigned session status
- completed session structure
- factual runtime events
- split and return records
- partial completion records
- neutral history counts

The coach view must remain factual and must not become judgement, instruction, or authority.

### Step 5 — Write a non-binding note

The coach may write a note against the athlete, session, or viewed artefact where the product surface permits it.

Coach notes are:

- non-binding
- non-authoritative
- non-executable
- outside engine truth
- not read by the engine
- not used for replay
- not used for evidence
- not used for future session generation

### Step 6 — Repeat within scope

The coach may continue assigning, viewing, and noting only while the coach-managed link remains valid.

If the link is revoked, inactive, missing, or outside granted scope, coach access must stop.

## 2. Allowed / not allowed sheet

### Allowed

| Area | Coach may do | Boundary |
|---|---|---|
| Assign | Assign lawful v0 sessions to linked athletes | Assignment exposes a session; it does not change engine truth |
| View | View factual execution artefacts for linked athletes | View only within granted scope |
| Note | Write non-binding coach notes | Notes are commentary only |
| Manage list | Manage linked athletes within tier cap | Seat cap controls access only, not engine legality |

### Not allowed

| Area | Coach must not do |
|---|---|
| Phase 1 | Edit, replace, or complete athlete declarations |
| Legality | Override or alter engine legality |
| Selection | Influence exercise, structure, or session selection |
| Runtime | Modify, delete, reinterpret, or reclassify runtime events |
| Registries | Edit, mutate, or bypass registries |
| Evidence | Create, export, seal, or imply evidence in v0 |
| Analytics | Present dashboards, scores, rankings, or outcome evaluation |
| Messaging | Use v0 as a messaging surface |
| Claims | State or imply authority beyond assign, view, and note |
| Authority | Act as decision-maker over engine truth |

## 3. Example workflow

### Scenario

A coach has one linked athlete in v0.

### Preconditions

- Coach account exists
- Athlete account exists
- Coach-managed link is accepted
- v0 scope is locked
- Athlete Phase 1 declaration is accepted
- A lawful executable session exists

### Workflow

1. Coach opens the linked athlete record.
2. Coach selects an available lawful session.
3. Coach assigns the session.
4. Athlete executes the session.
5. System records factual runtime events.
6. Coach views the completed session artefact.
7. Coach writes a non-binding note.
8. System stores the note outside engine truth.
9. Future engine output remains unaffected by the note.

### Lawful example note

Observed completed session artefact. Coach note added for human review only.

### Illegal note pattern

Any note that attempts to create engine authority, athlete status, outcome judgement, or future execution change is outside v0.

## 4. Coach cannot declare or decide

A coach cannot declare:

- athlete consent
- athlete jurisdiction acknowledgement
- athlete age declaration
- athlete Phase 1 inputs
- athlete constraints
- athlete state
- athlete performance status
- registry values
- evidence status

A coach cannot decide:

- engine legality
- programme validity
- runtime truth
- replay truth
- evidence truth
- future engine output
- athlete continuation status
- system authority status

## 5. UI contract for this pack

Coach-facing v0 UI should use only these action labels:

- Assign session
- View artefact
- Add note
- View history
- Remove assignment
- Close

Coach-facing v0 UI must not use labels that imply decision authority, engine authority, athlete status judgement, outcome judgement, or future execution control.

## 6. Support response lock

If a coach asks for authority outside v0, the response is:

This action is not available in v0. Coaches may assign sessions, view factual artefacts, and write non-binding notes only.

If a coach asks to change an athlete declaration, the response is:

Phase 1 declarations cannot be edited by the coach. A new athlete declaration is required where the product surface permits it.

If a coach asks to override the engine, the response is:

Engine decisions cannot be overridden by the coach.

If a coach asks for athlete status judgement, the response is:

v0 does not provide athlete status judgement.

## 7. Proof checklist

This pack is complete only if the repo contains:

- one coach quickstart
- one allowed / not allowed sheet
- one example workflow
- explicit assign session boundary
- explicit view artefacts boundary
- explicit non-binding note boundary
- explicit list of what coach cannot declare
- explicit list of what coach cannot decide
- no analytics language
- no advisory language
- no Phase 7 or Phase 8 capability claim
- no organisation, team, unit, or gym runtime claim

## Final lock

Coach-facing v0 usage is limited to:

- assign
- view
- note

Anything outside that boundary does not exist in v0.