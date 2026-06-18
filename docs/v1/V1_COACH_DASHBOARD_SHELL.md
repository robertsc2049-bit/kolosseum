<!-- DEV NOTE: Product UI contract surface. This document defines the bounded S-V1-U-02 coach dashboard shell contract and does not create engine, registry, proof, payment, organisation, team, gym, federation, marketplace, messaging, or commercial dashboard authority. -->

# V1 Coach Dashboard Shell

Status: active v1 coach dashboard shell boundary document.

Slice: S-V1-U-02.

## Purpose

S-V1-U-02 creates a coach dashboard shell for assigned athletes only.

The shell is a product UI and read-model surface. It displays factual assigned-athlete rows and links to existing factual review surfaces.

## Boundary

Allowed:

- coach UI shell contract
- coach API adapter contract
- coach read model
- assigned and unassigned permission tests
- copy registry entries for neutral labels
- local guard proof

Forbidden:

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
- engine mutation
- registry mutation
- payment-state branching

## Visibility rule

Coach dashboard shell visibility is assigned-only.

A coach may see an athlete row only when an accepted individual coach-athlete relationship exists for that coach and athlete.

Unassigned athlete rows must not appear.

Revoked, expired, missing, or non-individual relationships must not create coach visibility.

## Factual review rule

The dashboard shell may surface only recorded facts:

- athlete user id
- relationship id
- assignment ids
- assignment count
- recorded session count
- last recorded event timestamp
- last recorded session status
- factual surface links

The shell must not evaluate the athlete, compare athletes, label behaviour, or provide advisory wording.

## Engine boundary

The coach dashboard shell is engine-inert.

It must not:

- call engine phase entrypoints
- alter Phase 1 declarations
- alter compile input
- alter compile output
- trigger substitutions
- alter session state
- alter replay, evidence, export, or proof artefacts

The product permission state is outside engine truth.

## Copy rule

User-facing text must resolve through `copy/coach_dashboard_shell_copy.json`.

The shell projection must expose copy ids and parameters. It must not create new user-facing prose inline.

Allowed wording is neutral and factual.

## API rule

The API adapter may assemble a product response from supplied relationship, assignment, athlete, and session records.

It must not read engine internals or product-tier/payment state.


## Executable read-model entrypoints

The bounded executable entrypoints are:

- buildCoachDashboardShell
- buildCoachAssignedAthleteRows
- listAssignedCoachAthleteIds
- projectCoachAssignedShell

These entrypoints build or render product read-model state only. They do not create engine truth.

## Completion proof

Required local proof:

- node --test test/s_v1_u_02_coach_dashboard_shell.test.mjs
- node ci/guards/s_v1_u_02_coach_dashboard_shell_guard.mjs
- node ci/scripts/run_failure_token_index_guard.mjs
- node ci/guards/guards_index_guard.mjs
- node ci/scripts/sha256_guard.mjs
- npm.cmd run lint:fast

## Final rule

If a coach is not assigned to an athlete through an accepted individual coach-athlete relationship, that athlete must not appear in the coach dashboard shell.