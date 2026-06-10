# COACH SESSION STATE DEMO CONTRACT

Document ID: coach_session_state_demo_contract  
Version: 1.0.0  
Status: Draft slice proof  
Scope: Active v0 only  
Rewrite policy: rewrite-only

## Purpose

This document locks the exact session-state artefacts that may be shown to coaches during session monitoring in active v0.

The contract exists to:
- support the "watch what happened" value story
- keep coach session visibility factual
- keep coach session visibility non-inferential
- prevent coach monitoring surfaces from drifting into readiness, safety, judgement, or prediction

## Active v0 scope lock

Coach session state in active v0 is locked to:
- factual session state only
- factual runtime event visibility only
- structural execution summaries only
- non-binding coach notes outside engine truth

Coach session state MUST NOT imply or include:
- readiness
- risk
- safety state
- compliance state
- performance judgement
- optimisation
- prediction
- correction
- diagnosis
- recommendation
- behavioural scoring
- progression steering
- substitution steering

## Coach session state value boundary

The coach session state demo MAY show only:
- canonical truth references
- execution status
- execution state
- append-only runtime event visibility
- factual block execution summary
- factual session execution summary

The coach session state demo MUST remain descriptive only.

## Allowed state fields

Only the fields pinned in the coach session state field registry may appear in the demo contract.

Those fields are limited to:
- canonical hashes
- execution status/state
- raw runtime events
- factual block-level counts
- factual session-level counts
- split / return factual markers
- pain flag counts as counts only

## Forbidden coach session state semantics

The demo contract MUST fail if it introduces:
- inferred meaning
- behavioural interpretation
- medical interpretation
- safety interpretation
- readiness interpretation
- likely-cause language
- trend language
- "good" or "bad" session labels
- intervention prompts
- coach action prompts
- scoring language
- compliance language

## Copy rule

Allowed copy must be literal and mechanical, for example:
- Session active.
- Session complete.
- Execution state: partial.
- Work items done: 4 of 6.
- Pain flags recorded: 1.
- Split entered: yes.
- Return decision: continue.

Forbidden copy includes:
- Athlete is struggling.
- High risk.
- Unsafe to continue.
- Poor adherence.
- Likely fatigued.
- Coach should intervene.
- Performance is declining.
- Needs correction.
- Behind plan.

## Field rule

If a state field is not explicitly pinned in the field registry, it must not appear in the coach session state demo.

## Final rule

If coach session state copy or fields imply anything beyond literal execution truth, the coach session state demo contract must fail.