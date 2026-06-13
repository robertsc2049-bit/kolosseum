<!-- DEV NOTE: Developer command-guide surface. This document gives future developers the supported local command path. It does not create product, engine, registry, runtime, commercial, workflow, or CI token authority. -->

# Command Guide

Status: developer handover command guide.
Slice: S-V1-07.

## Purpose

This guide lists the supported setup commands and check commands a future developer needs after opening the repo.

It is a developer handover surface only. It does not create engine law, registry law, product law, runtime behaviour, CI token meaning, workflow authority, commercial authority, legal authority, or release approval.

## Authority rule

Docs define law.
Tests prove behaviour.
Comments explain boundaries.
CI blocks drift.

Commands prove only what they execute. Passing commands do not activate out-of-scope product behaviour.

## Local PowerShell rule

Use `npm.cmd` in local Windows PowerShell.

Use `npm run ...` inside GitHub workflow files.

Do not mix the two rules.

## First setup command

From repo root:

    npm.cmd ci

## Primary local check command

From a clean tree:

    npm.cmd run lint:fast

## Common targeted proof commands

Guard index generation:

    npm.cmd run guard:index

Guard index check:

    node ci/guards/guards_index_guard.mjs

Failure token index generation:

    node ci/scripts/run_failure_token_index_guard.mjs --write

Failure token index check:

    node ci/scripts/run_failure_token_index_guard.mjs

Checksum generation:

    npm.cmd run hash:write

Checksum check:

    node ci/scripts/sha256_guard.mjs

Encoding checks:

    node ci/guards/no_bom_guard.mjs
    node ci/guards/no_crlf_guard.mjs
    node ci/guards/no_mojibake_guard.mjs

Developer convention checks:

    node ci/guards/developer_operating_conventions_guard.mjs
    node ci/guards/s_v1_05_slice_template_enforcement_guard.mjs
    node ci/guards/s_v1_06_adr_system_start_guard.mjs
    node ci/guards/s_v1_07_developer_entry_pack_guard.mjs

## Broader checks

Build fast:

    npm.cmd run build:fast

V0 suite:

    npm.cmd run test:v0

Change-focused suite:

    npm.cmd run test:change

Full suite:

    npm.cmd run test:full

## Generated-file order

When a slice touches a guard or generated documentation surface, use this order:

1. Run the target guard or test first.
2. Refresh generated guard index if guards changed:

       npm.cmd run guard:index

3. Refresh failure token index if tokens changed:

       node ci/scripts/run_failure_token_index_guard.mjs --write

4. Refresh checksums if checksum-governed files changed:

       npm.cmd run hash:write

5. Re-run the target guard or test.
6. Run index/checksum/encoding checks.
7. Run `npm.cmd run lint:fast` from a clean tree after commit.

## What not to touch with commands

Do not use commands to silently change runtime behaviour, engine behaviour, app implementation, registry content, payment/auth/UI implementation, workflows, package version, release tags, or generated files outside the owning generator.

Do not fix command failures by weakening guards, editing generated files manually, changing tests to fit broken behaviour, or turning documentation into product law.

## CI failure handoff

When CI fails, use:

    docs/dev/CI_FAILURE_GUIDE.md

Read the failing guard or script before editing.

Failure-token lookup:

    docs/dev/FAILURE_TOKEN_INDEX.md

Guard lookup:

    docs/GUARDS_INDEX.md
