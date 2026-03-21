# v1 Coach Session Decision Summary Payload Contract

## Status
Authoritative contract document

## Purpose
Freeze the concrete payload/schema shape for the first coach session decision summary read-model.

## Top-Level Shape

{
  "schema": {},
  "identity": {},
  "currentness": {},
  "outcome": {},
  "drivers": [],
  "timeline": {},
  "audit": {},
  "issues": []
}

## Required Groups

schema:
- name
- version

identity:
- athlete_id
- session_id
- run_id

currentness:
- status
- freshness

outcome:
- decision_class
- session_outcome
- summary_text

drivers:
- ordered list

timeline:
- created_at

audit:
- source_truth_refs

issues:
- array (may be empty)

## Core Rules

- All fields must be derived from persisted runtime truth
- No UI-inferred or synthetic data allowed
- Currentness must be explicit (never inferred)
- Ordering must be deterministic
- Missing truth must be exposed, not hidden

## Exit Criteria

- Payload shape frozen
- Required vs optional fields explicit
- Enum/state meanings locked
- Downstream implementation can proceed without ambiguity