# Kolosseum Comprehensive Test Suite

Status: desktop-current reusable local gate  
Runner: ci/scripts/kolosseum_full_test_suite.mjs

## Commands

Normal change gate:

npm.cmd run test:change

Full clean-tree gate:

npm.cmd run test:full

Failed-output-only direct commands:

node ci/scripts/kolosseum_full_test_suite.mjs --failed-only
node ci/scripts/kolosseum_full_test_suite.mjs --full --failed-only

## Desktop policy

This suite uses the Node version currently active on the desktop. It records the Node version but does not hard-fail Node 25.

## Required gates

Normal change gate:

- Git repository check
- package.json parse
- required test-suite file presence
- JSON validity
- Node syntax on non-test JS/MJS/CJS files
- replay vector envelope presence
- v0 deterministic boundary suite
- build

Full gate adds:

- lint:fast

## Not included by default

This suite deliberately does not call raw npm run test.

Raw npm run test currently includes DB-bound, Vitest-bound, and experimental module-mock-sensitive tests. Those need separate setup and should not be part of the universal local change gate until their environment is normalised.

## Output policy

Default runner output is concise. Failed gates are printed with stdout/stderr. Successful gate output can be hidden by using --failed-only.