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