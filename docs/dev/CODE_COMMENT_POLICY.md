# Code Comment Policy

## Status

Accepted.

## Purpose

This policy defines how Kolosseum uses comments for developer handover without turning comments into stale pseudo-law.

The policy applies to critical code only.

## Core rule

Canonical docs define law.

DEV NOTE comments explain boundaries.

Tests prove behaviour.

CI blocks drift.

## What a DEV NOTE is for

A DEV NOTE exists to explain why a critical function, module, or guard exists.

A good DEV NOTE explains:

- Purpose
- Boundary
- Determinism
- Failure

A DEV NOTE must help a competent developer avoid accidental product drift, engine coupling, registry drift, claim drift, or handover confusion.

## Required DEV NOTE shape

Use this shape:

DEV NOTE:
Purpose: Explain what this file or function protects.
Boundary: Explain what this file or function must not allow.
Determinism: Explain whether output must be stable from explicit input.
Failure: Explain what is rejected or how failure is surfaced.

## Good example

/**
 * DEV NOTE:
 * Purpose: Refuses product-only state before engine-bound input is accepted.
 * Boundary: Coach notes, UI state, and commercial access state must not enter deterministic input.
 * Determinism: The same explicit payload must always produce the same pass or failure token.
 * Failure: Throws a stable boundary token when forbidden fields are present.
 */

## Bad examples

Do not write comments like:

- Checks if this is safe.
- Helps the coach make better decisions.
- Optimises the programme.
- Predicts what the athlete needs.
- This should probably work.
- TODO fix later.

These are vague, claim-loaded, or operationally useless.

## Where DEV NOTE blocks are required

DEV NOTE blocks are required on critical boundary files first:

- v1 boundary guard scaffold
- v1 registry domain scaffold
- coach notes service
- session artefact viewer
- history access and query boundary files
- pilot lifecycle gate/state files
- ND mode presentation surface
- future auth and relationship permission guards
- future registry loader and FK validators
- future substitution engine
- future runtime event reducer
- future replay/evidence/export layer
- future free-tool import path

## What comments must not do

Comments must not:

- create product law
- contradict canonical docs
- repeat obvious code
- widen scope
- include unsupported activity claims
- include marketing language
- include broad medical, diagnostic, optimisation, or guarantee language
- describe product-only state as engine truth
- hide weak implementation with prose

## Forbidden language in DEV NOTE blocks

DEV NOTE blocks must not use claim-loaded wording such as:

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

If a future change touches a critical boundary file, the developer must check whether the existing DEV NOTE still matches the behaviour.

If the note is wrong, fix the code or the note in the same slice.