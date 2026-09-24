<!-- DEV NOTE: S-V1-F-08 release evidence snapshot. This file records the post-tag release state only. It does not create product law, engine law, registry law, acceptance law, commercial authority, or feature implementation authority. -->

# v1 release evidence snapshot

Slice: S-V1-F-08
Record type: controlled v1 release evidence snapshot
Status: recorded
Created at UTC: 2026-09-17T16:20:19.403Z

## Purpose

This snapshot records the exact controlled v1 release state after the release tag exists.

## Release identity

Tag: v1.0.0
Tag object type: tag
Tag object SHA: 2d3f6fd561241b4574cdcc442cf66fe1ae980e00
Verified main commit: fb32206e3a178954ed7fbeda5b67e68159618a46
Main HEAD at snapshot: fb32206e3a178954ed7fbeda5b67e68159618a46
Origin main at snapshot: fb32206e3a178954ed7fbeda5b67e68159618a46
Local tag commit: fb32206e3a178954ed7fbeda5b67e68159618a46
Remote tag commit: fb32206e3a178954ed7fbeda5b67e68159618a46
Tag points to verified main commit: true

Tag reference summary:
v1.0.0|tag|2d3f6fd561241b4574cdcc442cf66fe1ae980e00|2026-09-17T17:13:19+01:00|v1.0.0

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
3. git rev-list -n 1 v1.0.0
4. git ls-remote --tags origin refs/tags/v1.0.0 refs/tags/v1.0.0^{}
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
