<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# AGENT SCOPE CLASSIFICATION

Status: v0 build-support document
Scope: Kolosseum agent governance

## 1. Scope Verdicts

allowed:
The slice is inside active v0 and may be planned.

blocked:
The slice conflicts with v0 or canonical law and must not proceed.

dormant:
The slice may belong to v1 or later, but must not be implemented for v0.

lookup_required:
The slice cannot be classified without consulting canonical docs or repo files.

## 2. Active v0 Work

The following work may be active when implemented narrowly:

- Phase 1 declaration and acceptance
- compile admission gates
- Phase 1 through Phase 6 engine surfaces
- deterministic canonicalisation
- registry load and FK validation
- session execution runtime
- split and return
- partial completion
- factual runtime events
- individual user surfaces
- coach assignment
- accepted coach-athlete link requirements
- coach factual artefact viewing
- non-binding coach notes
- factual history counts
- neutral copy and blocked states
- CI gates and negative tests

## 3. Dormant Work

The following is dormant for v0:

- Phase 7 truth projection
- Phase 8 evidence sealing
- evidence envelopes
- exportable audit/proof packs
- org-managed runtime
- team runtime
- unit runtime
- gym runtime
- aggregate dashboards
- analytics dashboards
- rankings
- messaging
- proof-complete release language

## 4. Blocked Work

The following must be blocked:

- optimisation
- readiness scoring
- medical claims
- safety claims
- injury prevention claims
- rehabilitation language
- suitability language
- recommendations
- coaching advice
- outcome prediction
- adaptive progression
- runtime behaviour changing future engine output
- coach override
- registry mutation
- Phase 1 accepted declaration editing
- fallback behaviour
- heuristic matching
- closest-match behaviour
- warnings where hard failure is required

## 5. Classification Rule

If a feature is not explicitly inside active v0, classify it as blocked or dormant.

Silence is not permission.
