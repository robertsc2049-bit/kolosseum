# V1 Release Tag Preparation

Slice: S-V1-F-04
Status: preparation_only_not_tagged
Document type: release tag preparation record
Record version: 1.0.0

## Purpose

This record prepares the v1 controlled-launch tag step after the v1 acceptance gate has passed.

It is a factual release-operations record. It is not a feature implementation record, product expansion record, marketing record, broad rollout record, enterprise launch record, certification, external approval record, training approval record, or outcome statement.

## Boundary

This slice may prepare release notes, version/tag evidence, package entrypoints, and guard coverage for the tag step.

This slice must not create a git tag, push a git tag, change product scope, change package version, implement features, change engine behaviour, change registry content, change legal meaning, alter acceptance-gate law, or activate post-v1 surfaces.

## Existing command surface

The current repository already exposes release/tag commands:

- release preparation command: npm.cmd run release:prepare
- release tag command: npm.cmd run release:tag
- v1 acceptance check command: npm.cmd run acceptance:v1:check
- full fast gate command: npm.cmd run lint:fast

This record binds the order only. It does not execute the tag command.

## Candidate tag

Candidate tag: v1-controlled-launch

The candidate tag may be created only by a later operator action after all preconditions below are recorded as passing.

## Required order before creating the tag

The tag command must not be run unless all of the following have passed in this order:

1. clean repository state checked
2. v1 acceptance check passed
3. release notes and version/tag docs checked
4. full fast gate passed
5. current commit confirmed on main
6. operator confirms the candidate tag name

## Required proof commands

The proof commands for this preparation record are:

- npm.cmd run acceptance:v1:check
- node --test test/s_v1_f_04_v1_release_tag_preparation.test.mjs
- node ci/guards/s_v1_f_04_v1_release_tag_preparation_guard.mjs
- node ci/guards/s_v1_09_failure_token_closure_guard.mjs
- node ci/guards/guards_entrypoint_coverage_guard.mjs
- npm.cmd run lint:fast

## Tag block conditions

The tag command remains blocked if any of the following are true:

- acceptance check has not passed
- full fast gate has not passed
- working tree is dirty
- current commit is not the intended main commit
- candidate tag already exists
- release notes or version/tag documents are missing
- operator has not confirmed the candidate tag name

## Forbidden interpretations

This record must not be used to state or imply:

- safety
- suitability
- effectiveness
- external approval
- certification
- athlete clearance
- coach clearance
- training approval
- outcome guarantee
- broad rollout permission
- enterprise launch permission
- marketplace activation
- organisation runtime activation
- team runtime activation
- gym runtime activation
- messaging activation
- broad analytics activation

## Non-scope

This slice does not add features, does not change deterministic engine truth, does not alter registry law, does not alter legal surfaces, does not change the acceptance manifest, does not create a tag, and does not release the product by itself.

## Completion statement

S-V1-F-04 is complete when this preparation record exists, the guard and test pass, generated indexes are refreshed by their owning generators, acceptance check passes, full fast gate passes, and the PR is merged.
