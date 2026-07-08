<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# Kolosseum Documentation Index

This index is the main navigation layer for Kolosseum documentation.

It does not replace canonical product, engine, registry, proof, release, or slice documents. It helps developers find the correct document and understand which source has authority.

## Start Here

New developers should begin with:

1. `docs/dev/NEW_DEVELOPER_START_HERE.md`
2. `docs/dev/AUTHORITY_CHAIN.md`
3. `docs/dev/REPO_MAP.md`
4. `docs/dev/DOC_SEARCH_GUIDE.md`
5. `docs/dev/DOC_MAINTENANCE_RULES.md`

## Authority Model

Kolosseum uses layered authority.

The strongest sources are:

1. Active release boundary documents
2. Engine contracts and executable tests
3. Registry contracts and validation rules
4. Runtime proof, replay, hash, and evidence rules
5. Current slice contracts
6. Module README files and developer notes
7. Historical documents

Navigation documents explain where to look. They do not create product law.

See:

- `docs/dev/AUTHORITY_CHAIN.md`

## Developer Navigation

Use these files when working in the repo:

- `docs/dev/NEW_DEVELOPER_START_HERE.md` â€” first reading path for a new developer.
- `docs/dev/REPO_MAP.md` â€” repo area guide and ownership boundaries.
- `docs/dev/DOC_SEARCH_GUIDE.md` â€” deterministic search commands.
- `docs/dev/DOC_MAINTENANCE_RULES.md` â€” rules for adding, editing, and preserving docs.
- `docs/dev/AUTHORITY_CHAIN.md` â€” what wins when documents appear to conflict.

## Search First, Then Decide

Do not rely on memory for product, engine, registry, safety, proof, or release boundary decisions.

Use deterministic repo search first.

Recommended searches:

- `git grep -ni "release boundary"`
- `git grep -ni "v1"`
- `git grep -ni "not-v1"`
- `git grep -ni "post-v1"`
- `git grep -ni "deterministic"`
- `git grep -ni "canonical"`
- `git grep -ni "replay"`
- `git grep -ni "proof"`
- `git grep -ni "substitution"`
- `git grep -ni "fallback"`
- `git grep -ni "coach notes"`
- `git grep -ni "engine-invisible"`
- `git grep -ni "recommend"`
- `git grep -ni "fatigue"`
- `git grep -ni "readiness"`
- `git grep -ni "risk"`

## Documentation Principle

Docs should make the system easier to understand without creating a second source of truth.

When in doubt:

1. Find the authoritative document.
2. Add a pointer to it.
3. Do not duplicate its rules.
4. Do not soften its boundaries.
5. Do not add implied product behaviour.

<!-- S-V1-00-SCOPE-LOCK -->

## V1 scope-lock documents

The active v1 scope-lock documents are:

- `docs/v1/V1_RELEASE_BOUNDARY.md`
- `docs/v1/V1_ACCEPTANCE_GATE.md`
- `docs/v1/V1_NOT_IN_SCOPE.md`
- `docs/v1/V1_DOC_AUTHORITY_MAP.md`

These documents control v1 planning and slice admission. They do not redefine engine law, registry law, CI token meanings, copy authority, or commercial authority.
