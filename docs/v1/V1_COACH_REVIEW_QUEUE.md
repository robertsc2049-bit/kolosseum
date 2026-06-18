<!-- DEV NOTE: S-V1-U-03 coach review queue boundary. This document permits a narrow factual read model only; it does not create engine law, intervention authority, or coach interpretation inside Kolosseum. -->

# V1 Coach Review Queue

Status: active v1 slice boundary.
Slice: S-V1-U-03.
Surface: coach_review_queue.

## Purpose

S-V1-U-03 creates a factual coach review queue for assigned athletes.

The queue exists so a coach can see recorded session facts and the recorded review status for those facts.

## Allowed

The slice may add:

- a factual read model
- an API adapter
- a copy-id-backed projection
- factual copy entries
- tests and guard
- release-boundary, acceptance, and authority-map markers
- package proof wiring

The queue may show:

- assigned athlete identity token
- relationship id
- session id
- assignment id
- recorded session status
- recorded event counts
- last recorded event timestamp
- review status
- review recorded timestamp
- review recorded-by coach id
- deferred-until timestamp where explicitly recorded

## Required boundaries

The queue must show recorded facts and review status only.

The coach interprets the queue. Kolosseum does not.

The queue must be assigned-athlete scoped.

The queue must be engine-inert.

The queue must not mutate session state, factual history, compile input, compile output, replay truth, proof truth, substitution legality, programme assignment legality, or coach-athlete relationship authority.

## Not active in this slice

This slice does not activate:

- advisory output
- escalation semantics
- coach-action instruction
- physiological-state labels
- interpretive labels
- numeric ordering labels
- broad analytics dashboard
- team dashboard
- organisation dashboard
- commercial dashboard
- messaging or chat
- outbound delivery
- live coach override
- engine mutation
- database migration
- persistence implementation

## Proof

Required local proof:

- node --test test/s_v1_u_03_coach_review_queue.test.mjs
- node ci/guards/s_v1_u_03_coach_review_queue_guard.mjs
- standard generated-surface and checksum proof
- npm run lint:fast