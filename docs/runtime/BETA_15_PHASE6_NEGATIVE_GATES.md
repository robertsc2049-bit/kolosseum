# BETA-15 Phase 6 Negative Gates

## Status

BETA-15 closes deterministic invalid-runtime failure coverage for the September controlled beta.

It hardens the BETA-13 event admission schema and BETA-14 factual runtime reducer. It does not introduce advice, interpretation, recommendation, readiness, safety, optimisation or future-engine effects.

## Required negative gates

The controlled Phase 6 runtime fails closed for:

- invalid event order;
- duplicate illegal events;
- unknown event types;
- unknown work items;
- session end without a required split return decision;
- work-item resolution or session end without required pain follow-up;
- runtime state that diverges from deterministic event replay;
- events crossing the materialised session boundary;
- canonical event mutation after append.

## Closed failure token surface

`engine/contracts/beta15_phase6_failure_tokens.json` is the machine-readable Phase 6 failure-token allowlist.

The BETA-15 guard extracts every quoted `phase6_*` failure token from:

- `engine/src/runtime/beta13_phase6_event_schema.js`;
- `engine/src/runtime/beta14_phase6_runtime_reducer.js`.

The extracted set must exactly equal the manifest. Missing, additional or unregistered tokens fail CI.

Each negative fixture records one expected token. Every negative test executes twice and must emit the same registered token on both runs.

## Append-only truth

Accepted canonical events remain deeply frozen.

Edited copies fail canonical validation before replay or reducer state changes. Rejected appends leave the prior event log and reducer state byte-stable.

## State divergence

Reducer state carries its deterministic hash.

BETA-15 additionally compares a supplied factual state against full deterministic replay of its event log. A validly hashed but stale or unrelated state fails with `phase6_runtime_reducer_state_divergence`.

## Split and pain closure

A session cannot end while a split is active. The required failure is explicit and stable.

A work item cannot resolve, and a session cannot end, while a required pain follow-up remains pending.

These are factual execution constraints only. They do not produce advice or change future engine behaviour.
