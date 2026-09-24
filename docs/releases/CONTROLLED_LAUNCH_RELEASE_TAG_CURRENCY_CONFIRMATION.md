<!-- DEV NOTE: S-V1-G-03 controlled launch release tag currency confirmation. This file confirms the currently tagged release against already re-verified S-V1-F-05/F-08/F-09/F-10 evidence. It does not reissue a GO/NO-GO decision, does not change the S-V1-F-12 historical record, and does not create product law, engine law, registry law, acceptance law, commercial authority, release-tag authority, or feature implementation authority. -->

# Controlled Launch Release Tag Currency Confirmation

Slice: S-V1-G-03
Record type: release tag currency confirmation
Token: CI_V1_RELEASE_TAG_CURRENCY_CONFIRMATION
Status: CONFIRMED
Decision scope: controlled launch only
Created at UTC: 2026-09-17T17:20:37.631Z

## Purpose

The S-V1-F-12 go/no-go record is permanent history for the `v1-controlled-launch` tag and is protected by the LAUNCH-00 boundary (`docs/releases/PUBLIC_LAUNCH_RELEASE_BOUNDARY.json`), which requires that historical records are never rewritten.

Since that record was created, a new release tag (`v1.0.0`) was cut from current `main`, and S-V1-F-05, S-V1-F-08, S-V1-F-09, and S-V1-F-10 were each independently re-run and re-recorded against it, all passing.

This record confirms that the current release tag is covered by fresh, real, passing evidence, without rewriting or superseding the historical S-V1-F-12 decision.

## Relationship to S-V1-F-12

The S-V1-F-12 go/no-go record remains historically valid and unchanged. Its decision (GO, controlled launch only, named founder group) is the operative authority for controlled launch.

This record does not reissue a new GO decision. It confirms that the release tag currently on `main` has independently passed the same evidence chain S-V1-F-12 depends on.

| Field | Historical record (S-V1-F-12) | Current tag (this record) |
| --- | --- | --- |
| Release tag | v1-controlled-launch | v1.0.0 |
| Release tag commit | 43510e4c4d791effda647e80dc74d8452dc61f1f | fb32206e3a178954ed7fbeda5b67e68159618a46 |

## Current release identity

Tag: v1.0.0
Tag commit: fb32206e3a178954ed7fbeda5b67e68159618a46
Tag object SHA: 2d3f6fd561241b4574cdcc442cf66fe1ae980e00
Local tag verified: true
Remote tag verified: true

## Main state observed

Main HEAD: 9909ccd7dae43543531b59a31872054591ae0939
Origin main: 9909ccd7dae43543531b59a31872054591ae0939
HEAD equals origin/main: true
Working tree clean: true

## Current evidence chain

| ID | Slice | Result | Reference |
| --- | --- | --- | --- |
| CE-001 | S-V1-F-05 final ship decision | SHIP | docs/releases/V1_FINAL_SHIP_DECISION.md |
| CE-002 | S-V1-F-08 release evidence snapshot | verified_main_commit matches current tag | docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.md |
| CE-003 | S-V1-F-09 controlled launch execution pack | prepared | docs/releases/CONTROLLED_LAUNCH_EXECUTION_PACK.md |
| CE-004 | S-V1-F-10 controlled launch smoke run | pass, 0 failed required commands, no launch blocker | docs/releases/CONTROLLED_LAUNCH_SMOKE_RUN.md |

## Currency findings

| Finding | Value |
| --- | --- |
| Current tag independently re-verified | true |
| All upstream evidence re-verified against current tag | true |
| Historical GO/NO-GO decision remains valid authority | true |
| This record reissues a new GO decision | false |
| This record changes the historical GO/NO-GO record | false |
| This record changes the release tag | false |

## Boundary

This record is a currency confirmation and evidence reference only.

It does not reissue a GO/NO-GO decision.
It does not change the S-V1-F-12 historical record.
It does not change the release tag.
It does not touch product code.
It does not change engine behaviour.
It does not create feature implementation.
It does not change acceptance gate law.
It does not activate post-v1 scope.
It does not create open sign-up.
It does not create marketplace scope.
It does not create organisation scope.
It does not create gym scope.
It does not create team scope.
It does not create federation scope.
It does not create enterprise dashboard scope.
It does not create messaging scope.
It does not create commercial claims.

## Claim boundary

This record makes no coaching advice claim, athlete condition claim, safety claim, readiness claim, optimisation claim, training effect claim, automated selection claim, automated recommendation claim, programme outcome claim, or external endorsement claim.

## Action

Permitted next action: start_controlled_launch_for_named_founder_group_only_under_current_tag

Controlled launch may proceed under the current tag using the S-V1-F-12 GO decision as its authority.

Do not expand launch scope from this record.

## Required proof

    npm.cmd run proof:s-v1-g-03
    npm.cmd run proof:s-v1-f-05
    npm.cmd run proof:s-v1-f-08
    npm.cmd run proof:s-v1-f-09
    npm.cmd run proof:s-v1-f-10
    npm.cmd run proof:s-v1-f-12
    npm.cmd run lint:fast
