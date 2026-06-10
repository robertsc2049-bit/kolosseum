# KOLOSSEUM AGENT OPERATING SYSTEM

Status: v0 build-support document
Scope: Kolosseum v0 Deterministic Execution Alpha
Authority: subordinate to canonical law, BUILD_TARGET_v0, CI gates, and repository checks
Rewrite policy: rewrite-only for semantic changes

## 1. Purpose

This document defines the controlled agent system used to plan, implement, review, and commercialise Kolosseum v0 work.

The system is not a runtime agent framework.
The system is not an autonomous builder.
The system is not engine authority.

It is a disciplined prompt and review operating model for producing narrow, CI-first, repo-ready Kolosseum implementation slices.

## 2. v0 Boundary

Kolosseum v0 supports only:

- actors: individual_user and coach
- execution scopes: individual and coach_managed
- activities: powerlifting, rugby_union, general_strength
- engine phases: Phase 1-6 only
- product surfaces: onboarding forms, session execution UI, history counts, coach assignment, factual artefact viewing, non-binding coach notes, split/return, partial completion
- runtime model: deterministic engine library boundary

Kolosseum v0 excludes:

- Phase 7 truth projection
- Phase 8 evidence sealing
- evidence envelopes
- export/proof packs
- org, team, unit, gym, or state-managed runtime
- dashboards
- analytics
- rankings
- messaging
- readiness scoring
- outcome evaluation
- medical, safety, rehabilitation, or suitability claims
- optimisation claims
- advisory or recommendation behaviour
- fallback, heuristic, or best-effort behaviour

## 3. Operating Principle

Every slice must pass through this sequence:

1. Scope Governor Agent
2. Canonical Law Reader Agent
3. Product Slice Planner Agent
4. Required specialist agents only
5. CI Gate Agent
6. Test Vector Agent
7. Repo Implementation Agent
8. PR Review Agent
9. Release Readiness Agent where relevant

Do not run every agent on every request.
Use the smallest lawful chain that blocks drift and produces a shippable slice.

## 4. Agent Classes

### Active v0 Agents

- Scope Governor Agent
- Canonical Law Reader Agent
- Product Slice Planner Agent
- Engine Phase Agent
- Phase 1 Declaration Agent
- Schema Closure Agent
- Registry Integrity Agent
- CI Gate Agent
- Test Vector Agent
- Runtime Session Agent
- Coach Surface Agent
- Non-Binding Notes Agent
- Copy & Claims Guard Agent
- API Contract Agent
- Database Schema Agent
- UI Surface Agent
- Security/Auth Boundary Agent
- Pricing/Entitlement Boundary Agent
- Repo Implementation Agent
- PR Review Agent
- Release Readiness Agent
- Commercial Trust Agent
- Investor/Founder Narrative Agent
- Documentation Consolidation Agent
- Slice Orchestrator Agent

### Dormant Agents

Dormant agents may be documented as future capability only. They must not generate active v0 implementation work.

- Evidence Envelope Agent
- Truth Projection Agent
- Export/Audit Pack Agent
- Organisation Runtime Agent
- Team Runtime Agent
- Gym Runtime Agent
- Analytics Dashboard Agent
- Replay Proof Packaging Agent

### Dangerous Agents

Dangerous agents must not be created because they conflict with Kolosseum law.

- Optimisation Agent
- Readiness Agent
- Safety/Medical Agent
- Coaching Advice Agent
- Outcome Prediction Agent
- Adaptive Progression Agent
- Heuristic Recovery Agent
- Auto-Fallback Agent
- Recommendation Agent
- UX Sentiment Agent
- Make It Work Agent

## 5. Agent Rules

All agents must obey:

- No inference
- No defaults
- No extension
- No fallback
- No soft failure
- No v1 feature activation
- No illegal copy
- No implementation without negative tests
- No scaffolding excluded features for later
- No user-facing copy outside factual, neutral, allowlist-safe language
- No engine behaviour from payment, product tier, coach notes, presentation state, UI state, or commercial state

## 6. Daily Operating Chain

For most implementation work use:

1. Scope Governor Agent
2. Product Slice Planner Agent
3. CI Gate Agent
4. Repo Implementation Agent
5. PR Review Agent
6. Copy & Claims Guard Agent if user-facing text exists

Specialist agents are added only when the slice touches their domain.

## 7. Final Rule

Agents are build discipline, not authority.

If an agent output conflicts with canonical law, BUILD_TARGET_v0, CI gates, or the repo checks, the agent output is invalid.