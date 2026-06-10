# AGENT HANDOFF PROTOCOL

Status: v0 build-support document
Scope: Kolosseum agent workflow

## 1. Purpose

This document defines the required handoff format between Kolosseum build agents.

No agent may proceed from an incomplete handoff.

## 2. Required Handoff Pack

HANDOFF PACK

Slice ID:
[ID]

Slice title:
[TITLE]

Current agent:
[AGENT]

Next agent:
[AGENT]

Scope verdict:
allowed / blocked / dormant / lookup_required

Canonical basis:
[DOCUMENTS / RULES]

Inputs provided:
[LIST]

Outputs produced:
[LIST]

Open blockers:
[LIST]

Forbidden areas:
[LIST]

Required next action:
[ONE ACTION]

Acceptance criteria:
[LIST]

Failure conditions:
[LIST]

## 3. Rejection Rules

Reject the handoff if:

- scope verdict is missing
- canonical basis is missing
- blocked or dormant material is treated as active
- acceptance criteria are missing
- negative tests are missing for implementation work
- user-facing copy has not passed Copy & Claims Guard
- the next action is vague
- the slice includes Phase 7, Phase 8, evidence, export, org runtime, analytics, readiness, safety, optimisation, or advice as active v0 work

## 4. Blocker Rules

Uncertainty must become one of:

- blocked
- dormant
- canonical lookup required
- user decision required

Uncertainty must not become:

- assumption
- fallback
- best effort
- inferred support
- TODO for later

## 5. Final Rule

A handoff is valid only if the next agent can act without widening scope.