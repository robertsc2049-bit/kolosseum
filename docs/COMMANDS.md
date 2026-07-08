<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# Commands

This repo intentionally keeps the normal human workflow narrow.

Use the public commands first. Use lower-level commands only when diagnosing a specific failing layer.

## Public command

Use this when you want one authoritative local signal that your change is acceptable:

    npm run verify

This is the default command for normal development.

## CI entrypoint

CI uses this entrypoint:

    npm run ci

Humans generally should not run this unless checking CI parity or debugging CI behaviour.

## Common diagnostic commands

Use these only when you need to isolate a failure:

    npm run lint:fast
    npm run test:unit
    npm run test:one -- test/some_test_file.test.mjs
    npm run build:fast
    npm run dev:status
    npm run diff:summary
    gh run list --limit 10

## Script groups

`green`, `green:fast`, and `green:dev` are verification runners used by hooks and CI wiring.

`lint:fast`, `test:unit`, and `build:fast` are composed steps used by the verification runner.

`guard:*` scripts are guard maintenance and deterministic index utilities.

`diff:*` scripts are contract and golden inspection utilities.

## Rule

If you are unsure which command to use, run:

    npm run verify

Do not bypass failing guards. Fix the failing layer.

## Wrapper and CI entrypoints

Use `npm.cmd` on Windows local PowerShell.

Direct and wrapper gates for v0 closure:

    npm.cmd run lint:fast
    npm.cmd run test:ci
    npm.cmd run test:v0
    npm.cmd run test:change
    npm.cmd run test:full
    npm.cmd run build
    npm.cmd run build:fast
    npm.cmd run green:ci

Entrypoint contract:

- `lint` wraps `lint:fast` and `test:ci`.
- `ci` wraps `green:ci`.
- `green:ci` owns the CI-safe green path.
- `test:change` and `test:full` are wrappers around `ci/scripts/kolosseum_full_test_suite.mjs`.
- `test:v0` remains owned by `ci/scripts/kolosseum_v0_test_suite.mjs`.
- Clean-tree gates must run after intended changes are committed or reverted.
- Wrapper failures must preserve the underlying command failure; do not hide or reinterpret failures in wrapper code.
