# P152 — Coach Notes Boundary Proof

Status: Proposed
Scope: v0 only
Mode: BUILD
Rewrite Policy: rewrite-only

## Target

Prove coach notes stay completely outside engine truth.

## Invariant

Coach notes must never influence:

- compile
- execution
- session-state factual summary
- replay-relevant truth surfaces
- proof-facing surfaces

Coach notes remain non-authoritative commentary only.
They must stay physically, logically, and audit-separate from engine truth.

## Proof

One automated boundary-proof cluster must prove all of the following:

1. engine-facing compile surfaces do not read or expose coach-note inputs
2. runtime execution surfaces do not read or expose coach-note inputs
3. factual session-state summary surfaces do not include coach-note data
4. public/session trace contracts do not widen to include coach-note fields
5. any discovered coach-note source files do not import engine-truth write/query services
6. any coupling between coach-note vocabulary and engine truth files fails

## Explicit Exclusions

- coach-note product UX expansion
- org, team, unit, or gym note governance
- messaging
- dashboard interpretation
- replay or evidence augmentation
- advisory or recommendation language

## Completion Rule

This slice is complete only when coach-note data is demonstrably fenced away from compile, execution, session-state summary, replay-relevant truth surfaces, and proof-facing surfaces.