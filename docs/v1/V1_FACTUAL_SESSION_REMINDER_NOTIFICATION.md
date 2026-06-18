# S-V1-R-01 Factual Session Reminder Notification

## Purpose

This slice defines a deliberately activated factual session reminder notification.

It is a controlled-launch support surface only. It may create a product-layer reminder schedule record and a factual notification payload.

## Boundary

Included:

- notification copy
- product-layer schedule record creation
- product-layer handler projection
- tests and CI guard

Excluded:

- social communication surfaces
- coach action prompts
- coach-authored discussion
- training-effect wording
- clinical wording
- any change to deterministic engine truth

## Invariants

The reminder is factual only.

The reminder requires deliberate activation.

The reminder cannot alter engine input, engine output, runtime events, replay, proof, substitution, factual history, or coach-athlete relationship authority.

The reminder copy must remain copy-registry-backed and factual.

## Accepted copy

- Session reminder
- A session is recorded for {scheduled_start_at}.
- This notification is factual only.

## Proof

Required proof for this slice:

- notification copy lint
- no-coupling test
- S-V1-R-01 guard
- standard generated index and checksum refresh