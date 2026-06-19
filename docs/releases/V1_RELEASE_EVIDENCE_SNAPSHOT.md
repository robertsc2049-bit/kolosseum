<!-- DEV NOTE: S-V1-F-08 release evidence snapshot. This file records the post-tag release state only. It does not create product law, engine law, registry law, acceptance law, commercial authority, or feature implementation authority. -->

# v1 release evidence snapshot

Slice: S-V1-F-08
Record type: controlled v1 release evidence snapshot
Status: recorded
Created at UTC: 2026-06-19T13:19:21.6411444Z

## Purpose

This snapshot records the exact controlled v1 release state after the release tag exists.

## Release identity

Tag: v1-controlled-launch
Tag object type: tag
Tag object SHA: f604363aeabe67257bf6157efa2e0dc32d8d9287
Verified main commit: 43510e4c4d791effda647e80dc74d8452dc61f1f
Main HEAD at snapshot: 43510e4c4d791effda647e80dc74d8452dc61f1f
Origin main at snapshot: 43510e4c4d791effda647e80dc74d8452dc61f1f
Local tag commit: 43510e4c4d791effda647e80dc74d8452dc61f1f
Remote tag commit: 43510e4c4d791effda647e80dc74d8452dc61f1f
Tag points to verified main commit: true

Tag reference summary:
v1-controlled-launch|tag|f604363aeabe67257bf6157efa2e0dc32d8d9287|2026-06-19T14:04:17+01:00|Kolosseum controlled v1 release tag. Source: S-V1-F-06 verified mainline. Commit: 43510e4c4d791effda647e80dc74d8452dc61f1f.

## Ship decision reference

Ship decision slice: S-V1-F-05
Ship decision: SHIP
Ship decision markdown: docs/releases/V1_FINAL_SHIP_DECISION.md
Ship decision JSON: docs/releases/V1_FINAL_SHIP_DECISION.json
Required proof command: npm.cmd run proof:s-v1-f-05
Required success marker: S-V1-F-05 V1_FINAL_SHIP_DECISION_CHECK_PASS

## Required proof commands

1. npm.cmd run proof:s-v1-f-05
2. node ci/guards/postv1_packaging_surface_registry_guard.mjs
3. git rev-list -n 1 v1-controlled-launch
4. git ls-remote --tags origin refs/tags/v1-controlled-launch refs/tags/v1-controlled-launch^{}
5. npm.cmd run lint:fast

Any failed required proof command blocks this evidence snapshot from closing.

## Release boundaries

This evidence is factual only.

It does not touch product code.
It does not change engine behaviour.
It does not create feature implementation.
It does not change acceptance gate law.
It does not change the release tag.
It does not create commercial claims.

This snapshot makes no athlete condition claim, programme effect claim, automated selection claim, ranking claim, recommendation claim, or training advice claim.

## Required evidence files

docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.md
docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json
docs/releases/V1_FINAL_SHIP_DECISION.md
docs/releases/V1_FINAL_SHIP_DECISION.json
docs/releases/V1_RELEASE_TAG_PREPARATION.md
docs/releases/V1_RELEASE_TAG_PREPARATION.json
docs/v1/V1_ACCEPTANCE_GATE_MANIFEST.json

## PR references

PR references are recorded in docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json from GitHub CLI lookup where available at snapshot creation time.
