<!-- DEV NOTE: S-V1-F-10 controlled launch smoke run. This file records smoke evidence only. It does not create product law, engine law, registry law, acceptance law, commercial authority, feature implementation authority, or release-tag authority. -->

# Controlled Launch Smoke Run

Slice: S-V1-F-10
Record type: controlled launch smoke evidence
Status: pass
Scope: controlled launch only
Created at UTC: 2026-06-19T13:59:18.6784951Z

## Purpose

This record captures the final controlled-launch smoke path after release tagging.

The smoke run used the release-ready main state after the controlled v1 tag was created.

## Release state used

Main HEAD: cb0e618f0be00d21d8ca8f7afb0be69dc94ecec8
Origin main: cb0e618f0be00d21d8ca8f7afb0be69dc94ecec8
Release tag: v1-controlled-launch
Release tag commit: 43510e4c4d791effda647e80dc74d8452dc61f1f
Release evidence snapshot: docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.md
Final ship decision: docs/releases/V1_FINAL_SHIP_DECISION.md
Controlled launch execution pack: docs/releases/CONTROLLED_LAUNCH_EXECUTION_PACK.md

The release tag was not changed by this smoke run.

## Smoke result

Overall result: pass
Required smoke command count: 12
Failed required smoke command count: 0
Launch blocker recorded: false

## Smoke commands

| ID | Label | Command | Result |
| --- | --- | --- | --- |
| SMK-001 | S-V1-F-05 final ship decision proof | npm.cmd run proof:s-v1-f-05 | pass |
| SMK-002 | S-V1-F-08 release evidence snapshot proof | npm.cmd run proof:s-v1-f-08 | pass |
| SMK-003 | S-V1-F-09 controlled launch execution pack proof | npm.cmd run proof:s-v1-f-09 | pass |
| SMK-004 | S-V1-F-01 founder test pack proof | npm.cmd run proof:s-v1-f-01 | pass |
| SMK-005 | S-V1 acceptance gate check | npm.cmd run acceptance:v1:check | pass |
| SMK-006 | Legal document surface test | node --test test/s_v1_l_01_legal_document_surfaces.test.mjs | pass |
| SMK-007 | Legal document surface guard | node ci/guards/s_v1_l_01_legal_document_surfaces_guard.mjs | pass |
| SMK-008 | Stripe checkout controlled launch test | node --test test/s_v1_p_02_stripe_checkout_controlled_launch.test.mjs | pass |
| SMK-009 | Stripe checkout controlled launch guard | node ci/guards/s_v1_p_02_stripe_checkout_controlled_launch_guard.mjs | pass |
| SMK-010 | Status page test | node --test test/s_v1_o_01_status_page.test.mjs | pass |
| SMK-011 | Status page guard | node ci/guards/s_v1_o_01_status_page_guard.mjs | pass |
| SMK-012 | Runbook proof | npm.cmd run proof:s-v1-o-04 | pass |

## Minimum controlled-launch path evidence

| ID | Path | Status | Evidence | Note |
| --- | --- | --- | --- | --- |
| CLSM-001 | release_identity | pass | SMK-001, SMK-002, SMK-003 | Release tag, release evidence snapshot, final ship decision, and controlled launch execution pack were checked. |
| CLSM-002 | coach_account_path | pass | SMK-004 | Founder test pack proof covers the fixture coach account path as controlled-launch evidence. |
| CLSM-003 | athlete_account_path | pass | SMK-004 | Founder test pack proof covers the fixture athlete account path as controlled-launch evidence. |
| CLSM-004 | coach_athlete_relationship_path | pass | SMK-004 | Founder test pack proof covers the coach-athlete relationship path as controlled-launch evidence. |
| CLSM-005 | assignment_session_and_factual_execution_path | pass | SMK-004, SMK-005 | Founder test and acceptance gate checks cover assignment, compile, session start, event recording, factual history, coach view, and proof-path surfaces. |
| CLSM-006 | legal_surface_path | pass | SMK-006, SMK-007 | Legal document surfaces rendered and remained claim-neutral. |
| CLSM-007 | payment_access_surface_path | pass | SMK-008, SMK-009 | Controlled-launch checkout path recorded access state only and did not mutate engine truth. |
| CLSM-008 | status_and_support_path | pass | SMK-010, SMK-011, SMK-012 | Status page and runbook surfaces passed factual support-path checks. |
| CLSM-009 | launch_blocker_path | pass | SMK-003, SMK-012 | If a launch-blocking defect appears, launch must stop for affected starts and move to a separate fix slice. |

## Boundary

This smoke run is evidence only.

It does not touch product code.
It does not touch engine code.
It does not change acceptance gate law.
It does not change registry content.
It does not change the release tag.
It does not create feature implementation.
It does not activate marketplace scope.
It does not activate organisation scope.
It does not activate gym scope.
It does not activate team scope.
It does not activate federation scope.
It does not activate enterprise dashboard scope.
It does not activate messaging.
It does not activate post-v1 scope.
It does not store named founding users in the repo.
It does not create commercial claims.

## Claim boundary

This smoke run records command results and factual path coverage only.

It does not give coaching advice.
It does not assess athlete condition.
It does not claim a training effect.
It does not select, rank, score, or recommend a user, coach, programme, session, or outcome.
It does not claim external endorsement.

## Blocker rule

Any failed required smoke command blocks controlled launch for the affected path.

A blocker must be recorded as a separate defect and resolved in a separate fix slice. The smoke slice must not be used to change product code, engine code, registry content, acceptance gate law, the release tag, or post-v1 scope.

## Required proof

    npm.cmd run proof:s-v1-f-10
    npm.cmd run proof:s-v1-f-05
    npm.cmd run proof:s-v1-f-08
    npm.cmd run proof:s-v1-f-09
    npm.cmd run proof:s-v1-f-01
    npm.cmd run acceptance:v1:check
    node --test test/s_v1_l_01_legal_document_surfaces.test.mjs
    node ci/guards/s_v1_l_01_legal_document_surfaces_guard.mjs
    node --test test/s_v1_p_02_stripe_checkout_controlled_launch.test.mjs
    node ci/guards/s_v1_p_02_stripe_checkout_controlled_launch_guard.mjs
    node --test test/s_v1_o_01_status_page.test.mjs
    node ci/guards/s_v1_o_01_status_page_guard.mjs
    npm.cmd run proof:s-v1-o-04
    npm.cmd run lint:fast
