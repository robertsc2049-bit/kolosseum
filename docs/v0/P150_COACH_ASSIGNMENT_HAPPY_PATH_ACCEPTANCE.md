# P150 — Coach Assignment Happy-Path Acceptance

Status: Proposed
Scope: v0 only
Mode: BUILD
Rewrite Policy: rewrite-only

## Target

Prove the active v0 coach-managed session flow works end-to-end across the repo’s live happy-path surfaces:

- assignment anchor
- compile
- execute
- factual artefact readback

## Invariant

Any v0 coach-operable claim must be backed by one executable happy path that remains entirely inside the active v0 boundary:

- athlete and coach actors only
- coach_managed and individual execution only
- Phase 1–6 only
- factual execution artefacts only
- no org, team, unit, gym, dashboard, export, or proof-layer surfaces involved

## Proof

One automated acceptance test cluster must prove all of the following:

1. the founder/demo happy-path contract remains coach-managed and single-athlete
2. block compile surfaces exist for compile/create-session entry
3. session execution surfaces exist for start/apply/get/list runtime path
4. factual session-state readback exists through the neutral read model
5. no org/team/unit vocabulary is introduced into the happy-path acceptance surfaces
6. no evidence/export/dashboard dependency is required for the v0 coach-managed path
7. failure handling remains neutral and factual, not advisory

## Explicit Exclusions

- org_managed
- team
- unit
- gym
- attendance
- rankings
- messaging
- dashboard claims
- export
- Phase 7 truth projection
- Phase 8 evidence sealing

## Completion Rule

This slice is complete only when the active repo surfaces can honestly support one coach-managed v0 path from contract anchor through compile, runtime execution, and factual state readback without crossing into excluded runtime or proof-layer surfaces.