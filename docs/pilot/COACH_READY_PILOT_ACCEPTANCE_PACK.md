<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# COACH-READY PILOT ACCEPTANCE PACK

Document status: v0 acceptance artefact  
Slice: S45 — Coach-Ready Pilot Acceptance Pack  
Scope: Kolosseum v0 Deterministic Execution Alpha  
Audience: founder, operator, coach pilot lead, support operator  
Rewrite policy: rewrite-only  
Acceptance mode: fail closed

## 1. Purpose

This pack defines the acceptance boundary for declaring a paid coach pilot operationally coach-ready inside Kolosseum v0.

Coach Ready means the paid pilot has enough verified platform, declaration, compile, execution, coach-view, support, and claim-control evidence to operate a first coach-managed v0 pilot without widening into post-v0 capability.

This pack does not prove evidence-complete execution. It does not prove v1 readiness. It does not activate organisational, team, unit, gym, export, proof, replay-envelope, or analytics capability.

## 2. v0 boundary

The acceptance boundary is limited to:

- individual_user and coach actors only
- individual and coach_managed execution scopes only
- powerlifting, rugby_union, and general_strength only
- Phase 1 through Phase 6 only
- paid access confirmation as platform access only
- workspace, coach account, athlete account, accepted coach-athlete link, locked scope, accepted Phase 1 declaration, first compile admission, first executable session, factual execution, factual artefact viewing, non-binding coach note, and factual history counts

The following are outside this acceptance boundary and must remain absent or negatively checked:

- Phase 7
- Phase 8
- evidence envelope
- export proof
- organisation runtime
- team runtime
- gym runtime
- analytics or dashboard claims
- messaging
- readiness
- safety or medical language
- optimisation
- coach override

## 3. Pass definition

Coach Ready passes only when every required readiness item is passed.

There is no partial pass. There is no warning-state pass. There is no manual override. If a required item is missing, blocked, unproven, or mapped to an out-of-scope artefact, Coach Ready fails.

Payment confirms access only. Payment does not change engine legality, compile admission, deterministic output, substitution behaviour, runtime state, evidence, replay, or user authority.

## 4. Evidence-of-readiness matrix

| ID | Acceptance item | Required proof | Source artefact class | Pass condition | Fail condition |
|---|---|---|---|---|---|
| CRP-001 | payment/access confirmed | Paid pilot access state exists | commercial/platform state | Payment/access status is confirmed before pilot operation | Payment missing, ambiguous, disputed, or treated as engine authority |
| CRP-002 | workspace exists | Workspace record exists | pilot/operator state | Workspace is provisioned and addressable by operator | Workspace missing or inferred |
| CRP-003 | coach account active | Coach account exists and is active | account/platform state | Coach can authenticate or is marked active by platform control | Coach invited only, inactive, missing, or inferred |
| CRP-004 | athlete account active | Athlete account exists and is active | account/platform state | Athlete can authenticate or is marked active by platform control | Athlete invited only, inactive, missing, or inferred |
| CRP-005 | coach-athlete link accepted | Explicit accepted link exists | link truth model | Link status is accepted and not revoked, rejected, expired, or inferred | Link missing, pending, revoked, rejected, expired, or inferred |
| CRP-006 | scope locked | v0 pilot scope is locked | scope/operator state | Supported actor, execution scope, activity, and Phase 1-6 boundary are confirmed | Scope missing, broad, org/team/gym-based, or undefined |
| CRP-007 | Phase 1 accepted | Accepted immutable declaration exists | Phase 1 acceptance record | Declaration is accepted, current, version-pinned, and hash-valid | Missing, unaccepted, superseded, mutable, mismatched, or inferred declaration |
| CRP-008 | first compile admitted | Compile admission gate passed | compile gate record | Compile is admitted only after accepted Phase 1 and valid scope/link preconditions | Compile admitted without required preconditions |
| CRP-009 | first executable session exists | Session compile output exists | session execution artefact | First executable session exists and is tied to lawful compile output | Session missing, unbound, generated outside v0, or proof-layer dependent |
| CRP-010 | session can be executed factually | Runtime event path works | Phase 6 runtime state | Start, work event, and terminal/factual state path are available | Execution requires coaching judgement, readiness, safety, optimisation, or messaging |
| CRP-011 | split/return works if included | Split/return runtime path works | Phase 6 runtime tests | If pilot includes split/return, RETURN_CONTINUE and/or RETURN_SKIP behaviour is factual and deterministic | Split/return claims exist without tested path |
| CRP-012 | partial completion works if included | Partial completion runtime path works | Phase 6 runtime tests | If pilot includes partial completion, factual amount is recorded without altering planned truth | Partial completion changes engine legality or future decisions |
| CRP-013 | coach can view factual artefact | Coach artefact viewer exists | coach surface | Coach can view factual execution artefact for linked athlete | Coach sees unlinked athlete, aggregate org data, evidence, export, or advisory data |
| CRP-014 | coach can write non-binding note | Coach note surface exists | coach notes surface | Coach note is stored/displayed as non-binding comment only | Note changes engine truth, legality, substitution, progression, or runtime state |
| CRP-015 | history counts show factual data only | Counts-only history surface exists | history read model | History shows counts/factual summaries only | History includes scoring, ranking, analytics, readiness, safety, or optimisation |
| CRP-016 | support boundaries exist | Support templates and escalation boundary exist | support boundary pack | Support copy refuses out-of-scope asks safely and factually | Support implies future delivery, hidden capability, or unsupported operation |
| CRP-017 | sales/public claims are guarded | Sales/public claim guard exists | claim registry/guard | Public claims are exact-match, proof-linked, and fail closed | Claims mention outcome, safety, readiness, optimisation, evidence, org runtime, or coach override |
| CRP-018 | no illegal v0 surface exposed | Negative boundary checklist passes | boundary guard | Every excluded surface has a negative check and no exposed route/copy/surface contradicts v0 | Any forbidden surface is reachable, claimed, or treated as current v0 |

## 5. Required checklist

The operator must complete the following in order.

1. Confirm paid access state exists for the pilot.
2. Confirm workspace exists.
3. Confirm coach account is active.
4. Confirm athlete account is active.
5. Confirm coach-athlete link is accepted.
6. Confirm pilot scope is locked to v0.
7. Confirm accepted Phase 1 declaration exists.
8. Confirm first compile admission passes.
9. Confirm first executable session exists.
10. Confirm factual session execution path works.
11. Confirm split/return path if included in the pilot.
12. Confirm partial completion path if included in the pilot.
13. Confirm coach can view factual artefact for linked athlete.
14. Confirm coach can write non-binding note.
15. Confirm history counts expose factual data only.
16. Confirm support boundaries exist.
17. Confirm sales/public claim guard passes.
18. Confirm no forbidden v0 surface is exposed.

## 6. Negative boundary checklist

The operator must verify each excluded surface remains absent, unreachable, or explicitly refused.

| ID | Excluded surface | Required negative check |
|---|---|---|
| CRP-N-001 | Phase 7 | No Phase 7 route, UI, acceptance requirement, pilot claim, or operator step is required for Coach Ready |
| CRP-N-002 | Phase 8 | No Phase 8 route, UI, acceptance requirement, pilot claim, or operator step is required for Coach Ready |
| CRP-N-003 | evidence envelope | No evidence envelope is required, generated, exported, or claimed as part of v0 Coach Ready |
| CRP-N-004 | export proof | No proof export, audit export, or downloadable proof artefact is required or claimed |
| CRP-N-005 | organisation runtime | No organisation-managed execution surface is exposed as current v0 |
| CRP-N-006 | team runtime | No team-managed execution surface is exposed as current v0 |
| CRP-N-007 | gym runtime | No gym/facility runtime surface is exposed as current v0 |
| CRP-N-008 | analytics/dashboard claims | No analytics, ranking, trend dashboard, or outcome dashboard is claimed as current v0 capability |
| CRP-N-009 | messaging | No coach-athlete messaging surface is required or claimed |
| CRP-N-010 | readiness | No readiness score, readiness state, return-to-play judgement, or competition-ready claim is present |
| CRP-N-011 | safety/medical | No medical, injury-prevention, safer-training, rehabilitation, or risk-reduction claim is present |
| CRP-N-012 | optimisation | No optimisation, performance improvement, auto-progression, or best-plan claim is present |
| CRP-N-013 | coach override | Coach cannot override engine decisions, legality, Phase 1 declarations, substitutions, progression, registries, or runtime truth |

A single failed negative check blocks Coach Ready.

## 7. Operator sign-off flow

The sign-off flow is factual and manual.

### Step 1 — Prepare pilot record

Operator records:

- pilot_id
- workspace_id
- coach_user_id
- athlete_user_id
- coach_athlete_link_id
- accepted_phase1_declaration_id
- first_compile_id
- first_session_id
- checklist_version
- signoff_operator_id
- signoff_timestamp_utc

### Step 2 — Verify required readiness items

Operator marks each CRP-001 through CRP-018 as one of:

- passed
- failed

No not-applicable state is allowed for required items.

For conditional behaviours:

- split/return may be marked passed because included and tested, or passed because excluded from this pilot and not claimed
- partial completion may be marked passed because included and tested, or passed because excluded from this pilot and not claimed

### Step 3 — Verify negative boundary items

Operator marks each CRP-N-001 through CRP-N-013 as one of:

- passed
- failed

No not-applicable state is allowed.

### Step 4 — Confirm source artefacts

Every required precondition must have at least one source artefact. A source artefact may be a contract, guard, test, operator record, platform record, or support/claim registry.

An item with no source artefact fails.

### Step 5 — Final decision

Coach Ready may be signed only if:

- every required readiness item is passed
- every negative boundary item is passed
- every required item has source artefact coverage
- no forbidden surface is exposed
- the pilot remains inside v0 boundaries

If any condition fails, final status is blocked.

### Step 6 — Sign-off record

The operator records one final status:

- coach_ready
- blocked

The status coach_ready means the paid coach pilot can be operated inside v0 boundaries. It does not mean evidence-complete, organisation-ready, team-ready, gym-ready, analytics-ready, medically validated, or outcome-proven.

## 8. Founder/operator use

This pack is usable as a founder/operator checklist for deciding whether a paid coach pilot can begin.

It must not be used as marketing copy. It must not be used to claim outcomes. It must not be used to imply current v1 proof-layer capability.

## 9. Fail-closed rules

Coach Ready fails if:

- a required item is missing
- a source artefact is missing
- a negative boundary check is missing
- any excluded surface is exposed or claimed
- payment is treated as engine authority
- coach authority is described as decision-making authority
- support copy implies unsupported capability
- public copy outruns the claim guard
- evidence/export/org/team/gym/analytics/messaging/readiness/safety/medical/optimisation capability is implied as current v0

## 10. Final lock

S45 accepts only a narrow v0 coach-ready pilot.

The acceptance pack proves operational readiness for a paid coach pilot inside v0 boundaries only.

It does not prove v1, evidence sealing, export, organisation runtime, team runtime, gym runtime, analytics, messaging, readiness, safety, medical suitability, optimisation, or coach override.
