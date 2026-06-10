<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# New Developer Start Here

This file gives a new developer the shortest safe path into Kolosseum.

Kolosseum is not a generic fitness app. It is a deterministic coach-athlete execution product with strict boundaries around engine truth, proof, registry behaviour, coach review, and claim language.

## First Rule

Do not guess product rules from code shape, UI ideas, or commercial assumptions.

Find the relevant boundary document, contract, registry rule, or test first.

## Read In This Order

1. `docs/INDEX.md`
2. `docs/dev/AUTHORITY_CHAIN.md`
3. `docs/dev/REPO_MAP.md`
4. `docs/dev/DOC_SEARCH_GUIDE.md`
5. Current release boundary document
6. Current active slice contract
7. Relevant module README or contract
8. Relevant tests

## What Must Stay True

Kolosseum v1 must remain a deterministic coach-athlete product.

The engine must remain separate from:

- Coach notes
- UI state
- Dashboard convenience data
- Billing
- Auth implementation details
- Marketing copy
- AI or RAG layers
- Recommendation language
- Medical, fatigue, readiness, risk, or safety inference

## Safe Developer Behaviour

Before changing code:

1. Identify the active slice.
2. Identify the invariant being protected.
3. Identify the files that are allowed to change.
4. Identify the proof command.
5. Run the relevant checks.
6. Keep the change narrow.

## Unsafe Developer Behaviour

Do not:

- Add product features outside the active slice.
- Add recommendation language.
- Add AI output to engine truth.
- Let coach notes affect deterministic execution.
- Let UI state affect proof or replay.
- Replace tests with explanation.
- Rewrite canonical docs while trying to tidy them.
- Delete historical docs because they look old.
- Add fallback behaviour without an explicit contract.
- Add broad dashboards before the data boundary is locked.

## If Something Conflicts

Use `docs/dev/AUTHORITY_CHAIN.md`.

If a navigation doc conflicts with a canonical contract, the canonical contract wins.

If a comment conflicts with a test, the test and canonical contract win.

If a historical note conflicts with the active release boundary, the active release boundary wins.
