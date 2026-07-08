# Function Documentation Policy

## Status

Accepted.

## Purpose

This policy defines how Kolosseum documents exported boundary functions and exported const entrypoints.

File-level DEV NOTE blocks explain module boundaries.

FUNCTION NOTE blocks explain exported entrypoints.

## Core rule

Canonical docs define law.

DEV NOTE comments explain file boundaries.

FUNCTION NOTE comments explain exported entrypoints.

Tests prove behaviour.

CI blocks drift.

## Required FUNCTION NOTE shape

Each exported function or exported const entrypoint in a critical boundary file must have a nearby FUNCTION NOTE block.

Required fields:

- Export
- Purpose
- Inputs
- Output
- Boundary
- Determinism
- Failure

## What FUNCTION NOTE blocks must explain

A FUNCTION NOTE must explain:

- why the export exists
- what input source it depends on
- what output or refusal path it preserves
- what boundary it must not cross
- whether the same input must produce the same result
- what failure behaviour must remain stable

## What FUNCTION NOTE blocks must not do

A FUNCTION NOTE must not:

- create product law
- contradict canonical docs
- restate obvious syntax
- widen scope
- include marketing language
- include broad medical, diagnostic, optimisation, or guarantee language
- describe product-only state as deterministic truth
- hide weak implementation with prose

## Forbidden language in FUNCTION NOTE blocks

FUNCTION NOTE blocks must not use claim-loaded wording such as:

- optimal
- recommended
- safe
- injury risk
- readiness
- fatigue
- diagnosis
- rehabilitation
- predicts
- prevents
- guarantees
- programme worked
- programme failed

Use factual boundary wording instead.

## Review rule

If a future change adds an exported function or exported const entrypoint to a critical boundary file, the same slice must add a FUNCTION NOTE block.

If the export changes behaviour, update the FUNCTION NOTE in the same slice.