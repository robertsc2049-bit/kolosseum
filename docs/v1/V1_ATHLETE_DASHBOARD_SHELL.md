# S-V1-U-01 Athlete Dashboard Shell

## Purpose

This slice creates the athlete dashboard shell read model for a controlled v1 athlete surface.

The shell renders the athlete's own assignments, own sessions, and factual history sections from already-authorised product read records.

## Boundary

Included:

- athlete dashboard shell read model
- factual dashboard copy
- own-data permission checks
- render tests
- permission tests
- copy lint
- CI guard
- generated index and checksum refresh

Excluded:

- social feed
- friends
- rankings
- marketplace
- coach dashboard
- organisation dashboard
- real route wiring
- database migration
- runtime event append
- engine mutation
- proof or replay mutation

## Invariants

The athlete sees own data only.

Dashboard copy is factual.

The shell does not alter engine truth.

The shell does not alter compile output.

The shell does not alter runtime events.

The shell does not alter replay, proof, substitution, factual history, relationship authority, or programme assignment legality.

## Sections

The v1 shell may render these sections only:

- own_assignments
- own_sessions
- factual_history

## Accepted copy

- Your dashboard
- Assignments
- Sessions
- Factual history
- No recorded items for this section.
- Recorded facts only.

## Required proof

Target proof:

- node --test test/s_v1_u_01_athlete_dashboard_shell.test.mjs
- node ci/guards/s_v1_u_01_athlete_dashboard_shell_guard.mjs

Related proof:

- relationship permission proof
- assignment visibility proof
- session readback proof
- athlete factual history proof
- mobile session shell proof

Standard generated-file proof:

- node ci/scripts/run_failure_token_index_guard.mjs --write
- node ci/scripts/run_failure_token_index_guard.mjs
- npm.cmd run guard:index
- node ci/guards/guards_index_guard.mjs
- node ci/guards/s_v1_09_failure_token_closure_guard.mjs
- npm.cmd run hash:write
- node ci/scripts/sha256_guard.mjs