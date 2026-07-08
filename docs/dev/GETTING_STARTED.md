<!-- DEV NOTE: Developer documentation surface. This document points to current source-of-truth files and local commands. It does not create product, engine, registry, release, or CI law. -->

# Getting Started

Status: developer handover entry point.

Purpose: help a competent developer open the repo, understand the active boundaries, run the current gates, and make a bounded slice without the founder present.

This file is a pointer map. If this file conflicts with executable checks, tracked contracts, release records, or guard output, the executable source wins.

## First read

Read in this order:

1. `docs/dev/NEW_DEVELOPER_START_HERE.md`
2. `docs/dev/REPO_MAP.md`
3. `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`
4. `REPO_BOUNDARY_MAP.md`
5. `docs/release/V0_COMPLETION_GATE_MANIFEST.md`
6. `docs/release/V0_ENGINE_PUBLIC_CONTRACT_FREEZE.md`
7. `docs/COMMANDS.md`
8. `docs/dev/CI_FAILURE_GUIDE.md`
9. `docs/dev/SLICE_TEMPLATE.md`

## Local setup

Use PowerShell from repo root.

    $RepoRoot = "C:\Users\Chris\Github\kolosseum"
    Set-Location $RepoRoot
    git status --short
    node --version
    npm.cmd --version

Expected repo rule: work from a clean tree before starting a slice.

Do not use PowerShell `Set-Content -Encoding utf8` for repo files. It can write a UTF-8 BOM in Windows PowerShell. Use a UTF-8-no-BOM writer and LF line endings.

## Main commands

Use the current scripts from `package.json`.

Primary local gate for current v0 closure slices:

    npm.cmd run lint:fast

Engine public contract gate:

    npm.cmd run test:v0:engine-contract

Larger CI composition entry points exist in `package.json`, but do not assume they replace the current slice acceptance criteria. Check the slice prompt and the current release record.

## Release boundary

The current v0 handover boundary is not defined by memory or by this file.

Use:

- `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`
- `docs/release/V0_COMPLETION_GATE_MANIFEST.md`
- `docs/release/V0_FINAL_RELEASE_READINESS_GATE.md`
- `docs/release/V0_ENGINE_PUBLIC_CONTRACT_FREEZE.md`
- `REPO_BOUNDARY_MAP.md`

For current v0 closure work, do not add v1 product implementation, billing, dashboards, sales surfaces, UI screens, database migrations, registry content records, or package version changes unless the slice explicitly requires them and the boundary docs permit them.

## Slice workflow

1. Start with a clean tree.
2. Inspect the relevant files before editing.
3. Make the smallest bounded change.
4. Preserve file encoding: UTF-8 without BOM, LF only.
5. Run targeted gates.
6. Commit.
7. Run `npm.cmd run lint:fast` from a clean tree.
8. Run any slice-specific gate.
9. Finish with a clean tree.

## Authority rule

Canonical docs define law.

Developer docs explain where to look.

Tests prove behaviour.

CI blocks drift.

Comments explain critical boundaries only where useful.

## Do not do this

Do not fix gate failures by:

- deleting guards
- weakening regex checks
- widening public engine exports casually
- adding hidden defaults
- changing copy to imply advice or product claims
- allowing coach notes, UI state, payment state, or dashboard data into engine truth
- changing locked release tags
- treating this handover file as product authority

## Completion check for a normal handover-doc slice

A documentation handover slice is complete only when:

- the relevant handover docs are present
- docs point to current source-of-truth files
- no canonical source is duplicated unnecessarily
- `npm.cmd run lint:fast` passes from a clean tree
- final `git status --short` is empty

<!-- S-V1-07:GETTING-STARTED-ENTRY-PACK:START -->
## S-V1-07 developer entry pack

Status: minimum handover path for a future developer.

Purpose: a future developer can open the repo, understand the current release boundary, run setup commands, run check commands, and know what not to touch.

### Required reading order

1. `README.md`
2. `docs/dev/GETTING_STARTED.md`
3. `docs/dev/COMMAND_GUIDE.md`
4. `docs/dev/REPO_MAP.md`
5. `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`
6. `docs/v1/V1_RELEASE_BOUNDARY.md`
7. `docs/v1/V1_NOT_IN_SCOPE.md`
8. `docs/v1/V1_DOC_AUTHORITY_MAP.md`
9. `docs/dev/NAMING_CONVENTIONS.md`
10. `docs/dev/SLICE_TEMPLATE.md`
11. `docs/dev/CI_FAILURE_GUIDE.md`
12. `docs/adr/README.md`

### Setup commands

Use Windows-safe npm commands in local PowerShell:

    npm.cmd ci

Do not replace GitHub workflow `npm run ...` syntax with local `npm.cmd ...` syntax. Local PowerShell uses `npm.cmd`; workflows use `npm run`.

### Check commands

Primary local check:

    npm.cmd run lint:fast

Common targeted documentation and generated-surface checks:

    npm.cmd run guard:index
    node ci/guards/guards_index_guard.mjs
    node ci/scripts/run_failure_token_index_guard.mjs
    node ci/scripts/sha256_guard.mjs
    node ci/guards/no_bom_guard.mjs
    node ci/guards/no_crlf_guard.mjs
    node ci/guards/no_mojibake_guard.mjs

### Current release boundary

Current release boundary starts at:

    docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md

V1 scope is controlled by:

    docs/v1/V1_RELEASE_BOUNDARY.md
    docs/v1/V1_ACCEPTANCE_GATE.md
    docs/v1/V1_NOT_IN_SCOPE.md
    docs/v1/V1_DOC_AUTHORITY_MAP.md

### What not to touch without a named slice

Do not touch runtime behaviour, engine behaviour, app implementation, registry content, payment/auth/UI implementation, workflows, generated files, package version, release tags, database migrations, or commercial capability unless the slice explicitly permits it.

### Authority rule

Docs define law.
Tests prove behaviour.
Comments explain boundaries.
CI blocks drift.

This file explains developer entry. It does not create new product law, engine law, registry law, runtime law, commercial authority, CI token meaning, or release approval.
<!-- S-V1-07:GETTING-STARTED-ENTRY-PACK:END -->
