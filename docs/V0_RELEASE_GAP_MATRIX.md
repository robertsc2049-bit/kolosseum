# V0 Release Gap Matrix

Purpose: convert the v0 release spine into an operational board so each future slice maps to a specific release gate, proof requirement, and remaining gap.

Source of truth:
- docs/V0_RELEASE_SPINE.md

Rules:
- Every new slice must map to exactly one primary v0 gate.
- If a slice does not close a listed gap, harden a listed proof, or unblock a listed gate, it is not v0 work.
- A gate is only DONE when its required proof exists in code, tests, docs, and CI evidence where applicable.
- Scope expansion is forbidden. Missing work must be written as a gap inside this matrix, not smuggled in as a â€œsmall extraâ€.

## Status key

- DONE = implemented and already proven
- HARDEN = exists but proof / CI / docs are not yet strong enough
- BUILD = capability still needs implementation
- BLOCKED = depends on another gate first
- DEFER = explicitly outside v0

## Release gate matrix

| Gate ID | Gate | Why it exists | Required proof | Current state | Next blocking slice | Notes |
|---|---|---|---|---|---|---|
| V0-G01 | Compile path is deterministic and contract-pinned | v0 dies if compile results drift | stable request/response contract, golden stability, contract guard coverage, explicit docs | HARDEN | assign next compile-proof slice here | |
| V0-G02 | Session creation and persistence are authoritative | sessions must be replayable and non-ambiguous | create-session persistence tests, state/events parity, terminal-state invariants | HARDEN | assign next session-proof slice here | |
| V0-G03 | Runtime event append/read path is append-only and replay-safe | no resurrection, no hidden mutation | repeated /state -> /events -> /state proof, restart parity, idempotency coverage | HARDEN | test(v0): prove repeated mixed /state -> /events -> /state reads after rejected split-decision replay preserve terminal-state shape and no-resurrection invariants | Audit-backed target pinned |
| V0-G04 | Split + RETURN gate path is safe and deterministic | this is one of the core sovereign behaviors | continue/skip decision proofs, dropped-work handling, terminal shape stability | HARDEN | test(v0): prove repeated mixed /state -> /events -> /state reads after rejected split-decision replay preserve terminal-state shape and no-resurrection invariants | Primary next release-critical proof seam |
| V0-G05 | Registry bundle is law-bound and pinned | bad registry data must fail hard | registry schema presence, FK law, bundle guard, law negatives/positives | DONE | none | Keep changes small and law-backed only |
| V0-G06 | API boundary does not trust caller-owned engine truth | authority stays server-side | canonical-hash proof, handler delegation proof, explicit allowlists | HARDEN | assign next API-boundary slice here | |
| V0-G07 | CI/green path is single-owner and trustworthy | a dirty pipeline destroys release trust | green parity, guard coverage, no-footgun, no-CRLF/BOM, clean-tree discipline | DONE | none | Preserve existing standards |
| V0-G08 | Evidence and sha sealing remain valid | release evidence must be auditable | evidence seal, sha256 guard, schema guard, spine guard | DONE | none | Recompute only through approved paths |
| V0-G09 | Docs define exact v0 path and done criteria | prevents scope creep and confusion | release spine, gap matrix, slice-to-gate traceability | BUILD | this slice | This file closes the operational-doc gap |

## Immediate v0 backlog

These are the only kinds of slices allowed next.

| Priority | Slice type | Must close which gate | Expected output |
|---|---|---|---|
| P0 | Missing proof on compile/session/runtime determinism | V0-G01 / V0-G02 / V0-G03 | new or migrated tests proving deterministic replay and parity |
| P0 | Missing proof on split/RETURN edge cases | V0-G04 | new tests proving skip/continue terminal and no-resurrection behavior |
| P1 | Missing API authority proof | V0-G06 | handler/service contract tests or boundary hardening |
| P1 | Documentation that tightens release evidence only | V0-G09 | docs that improve gate traceability without expanding scope |
| P2 | Nice-to-have feature work | DEFER | reject for v0 unless reclassified into a listed gate |

## Slice intake checklist

Before starting any new branch, answer all of these with â€œyesâ€:

1. Does the slice map to one primary gate above?
2. Does it close a real gap or strengthen required proof?
3. Can the result be proven by tests, guards, docs, or CI evidence?
4. Would failing to do this meaningfully weaken the v0 release?
5. Is this work already implied by the release spine rather than being a new idea?

If any answer is â€œnoâ€, it is not a v0 slice.

## Current recommendation

Default next engineering target:
- strengthen V0-G04 and V0-G03 first

Reason:
- split/RETURN and replay safety are the most sovereign runtime behaviors in the current v0 path
- they are the easiest place for hidden drift, resurrection, or terminal-shape breakage to slip through
- proving them harder improves real release confidence more than adding new surface area

## How to update this file

After each merged slice:
1. update the affected gate row
2. name the exact slice that closed or hardened the gate
3. move the next unresolved item into Next blocking slice
4. do not add new gates unless the spine itself changes on purpose