<!-- DEV NOTE: S-V1-F-05 final ship decision record. This is a release decision and evidence surface only. It does not create product law, engine law, registry law, commercial authority, tag authority, or feature implementation authority. -->

# V1 Final Ship Decision

Slice: S-V1-F-05

Status: final decision record

Decision: SHIP

Scope: controlled v1

## Boundary

This record may decide whether the controlled v1 release may proceed from clean main evidence.

This record does not change product code, engine behaviour, registry content, package version, release tags, acceptance-gate law, legal meaning, commercial authority, or post-v1 scope.

## Decision rule

V1 may be marked as shipping only when all required acceptance evidence is green and main is clean.

Any failed required acceptance item blocks v1.

No incomplete v1 completion wording is permitted.

## Evidence summary

Main HEAD: 455ea0cb5bdc640de6a405fd443e667b0fae57e4

Origin main: 455ea0cb5bdc640de6a405fd443e667b0fae57e4

Main clean before decision: True

HEAD equals origin/main: True

Required checks green: True

| Evidence item | Exit code | Passed |
| --- | ---: | --- |
| npm.cmd run acceptance:v1:check | 0 | True |
| npm.cmd run proof:s-v1-f-04 | 0 | True |
| npm.cmd run lint:fast | 0 | True |

## Required commands

    npm.cmd run acceptance:v1:check
    npm.cmd run proof:s-v1-f-04
    npm.cmd run lint:fast

## Decision outcome

Decision: SHIP

Permitted next action: prepare_controlled_v1_tag_from_clean_main_only

Blocked reason:

## Non-scope

This decision record must not create a tag, push a tag, change package version, implement features, touch product code, alter engine truth, alter registry content, alter acceptance-gate law, or activate post-v1 scope.
