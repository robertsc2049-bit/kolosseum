# S-V1-R-03 Retention and Access Window Policy

## Purpose

This slice defines the controlled-launch retention and access-window policy contract.

It is product policy only. It evaluates whether a controlled-launch user can access product surfaces, whether an assigned coach can view an assigned athlete surface, and whether a source-bound own-data export request can be represented by the product layer.

## Boundary

Included:

- product access-window contract
- source-bound own-data export policy check
- assigned coach product-view window check
- docs, tests, and CI guard
- generated index and checksum refresh

Excluded:

- enterprise retention
- organisation export
- team, unit, federation, or bulk export
- broad legal rewrite
- database migration
- provider integration
- changes to GDPR export/delete implementation
- engine, runtime, replay, proof, or substitution mutation

## Invariants

Access windows are product policy only.

Export remains source-bound and own-data scoped.

The policy does not alter engine truth.

The policy does not change compile output.

The policy does not alter runtime events.

The policy does not alter replay, proof, substitution, factual history, or coach-athlete relationship authority.

## Controlled-launch policy surfaces

Permitted request surfaces:

- product_access
- coach_assigned_view
- source_bound_export

Permitted export scope:

- own_user_data

## Required proof

Target proof:

- node --test test/s_v1_r_03_retention_access_window_policy.test.mjs
- node ci/guards/s_v1_r_03_retention_access_window_policy_guard.mjs

Generated-file proof:

- node ci/scripts/run_failure_token_index_guard.mjs --write
- node ci/scripts/run_failure_token_index_guard.mjs
- npm.cmd run guard:index
- node ci/guards/guards_index_guard.mjs
- node ci/guards/s_v1_09_failure_token_closure_guard.mjs
- npm.cmd run hash:write
- node ci/scripts/sha256_guard.mjs

Full proof:

- npm.cmd run lint:fast