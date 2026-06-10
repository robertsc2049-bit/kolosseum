# S29 — Founder go-live decision memo

## Target

One final decision document: ship or hold, based only on green proof.

## Invariant

The go-live decision is based on explicit criteria and verified proof only.

No decision is based on opinion, expectation, or incomplete state.

## Decision

GO-LIVE STATUS: SHIP

The system meets all required v0 criteria for pilot operation.

## Scope of decision

This decision applies only to:

- Kolosseum v0 Deterministic Execution Alpha
- Phase 1 through Phase 6 only
- individual_user and coach only
- individual and coach_managed execution only

This decision does not extend to any future capability.

## Required slices (cited)

The following slices are required and present:

- S1 — pilot lifecycle state machine
- S6 — first compile eligibility gate
- S7 — coach-managed link truth model
- S24 — live operator dashboard pack
- S25 — v0 support boundary pack
- S26 — pilot evidence pack
- S27 — coach-facing v0 usage pack
- S28 — athlete-facing v0 usage pack

## Required proofs (cited)

The following proofs are present and verified:

- lint:fast passes on clean tree
- all guards pass
- engine contract guard passes
- golden outputs guard passes
- registry law guard passes
- evidence seal guard passes
- targeted slice tests pass
- affected tests pass
- dev:status reports clean working tree
- CI runs on main show green status

Proof is derived from:

- repository state
- guard execution output
- test execution output
- CI run status

## Execution capability confirmed

The system can:

- accept Phase 1 declarations
- compile lawful sessions
- allow athlete execution
- record factual runtime events
- support split and return
- support partial completion
- allow coach assignment within boundary
- allow coach artefact viewing
- allow coach non-binding notes

## Boundary enforcement confirmed

The system enforces:

- Phase 1 as the only entry point
- no coach authority over engine decisions
- no mutation of runtime truth
- no registry mutation through UI
- no evidence export
- no analytics or advisory surfaces
- no messaging surface
- no organisation runtime

## Known limitations (explicit)

The following are known and accepted limitations:

- no messaging
- no dashboards
- no rankings
- no outcome evaluation
- no evidence export
- no Phase 7 truth projection
- no Phase 8 evidence sealing
- no organisation, team, unit, or gym runtime
- no athlete status judgement
- no coach decision authority
- no optimisation or progression claims

These are not defects. These are enforced v0 boundaries.

## Pilot constraints

Pilot operation is limited to:

- small controlled pilot group
- explicit coach-managed links only
- Phase 1 completed athletes only
- sessions that compile successfully
- factual execution only

## Pilot cap

Maximum pilot size:

- coaches: 1–3
- athletes per coach: within tier cap
- total athletes: controlled low double digits

No scale expansion until further slices are complete.

## Hold conditions

The system must be held (no go-live) if any of the following occur:

- lint:fast fails
- clean_tree_guard fails
- engine contract guard fails
- golden outputs guard fails
- registry law guard fails
- evidence seal guard fails
- any slice test fails
- CI on main is not green
- working tree is not clean
- any boundary violation is detected

## Operating rule

If proof is green, the system may run.

If proof is not green, the system must not run.

## Final lock

Decision basis is:

- explicit slices
- explicit proofs
- explicit boundaries
- explicit limitations

No other input is valid for go-live.

The system is authorised for controlled pilot operation within v0 scope only.