<!-- DEV NOTE: S-V1-F-09 controlled launch execution pack. This file is an operator-facing launch evidence surface only. It does not create product law, engine law, registry law, acceptance law, commercial authority, or feature implementation authority. -->

# Controlled Launch Execution Pack

Slice: S-V1-F-09
Record type: operational launch execution pack
Status: prepared
Scope: controlled launch only
Created at UTC: 2026-06-19T13:41:45.2302621Z

## Purpose

This pack gives the operator one launch-day checklist and one evidence path for starting controlled v1 with named founding users.

It is operational evidence only. It does not create product code, change engine behaviour, implement features, change onboarding logic, change pricing logic, create marketplace scope, create organisation scope, create gym scope, create team scope, create federation scope, create enterprise dashboard scope, create messaging scope, or activate post-v1 scope.

## Release identity required before launch operation

Required tag: v1-controlled-launch
Required tag commit: 43510e4c4d791effda647e80dc74d8452dc61f1f
Release evidence snapshot: docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.md
Final ship decision: docs/releases/V1_FINAL_SHIP_DECISION.md
Controlled launch readiness record: docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.md

This pack does not mark v1 live by itself.

Controlled launch operation may start only when the release tag exists locally and on origin, the release evidence snapshot exists, the final ship decision records SHIP, the controlled launch readiness record is completed by the operator, the named founder group is fixed outside the repo, the support route is recorded, and the evidence capture path is available.

## Operator-facing checklist

| Item ID | Phase | Operator check | Evidence | Blocks launch if missing |
| --- | --- | --- | --- | --- |
| CLX-001 | before_start | Confirm main is synced to the post-tag evidence state. | git rev-parse origin/main and docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.json | true |
| CLX-002 | before_start | Confirm v1-controlled-launch exists locally and on origin. | git rev-list -n 1 v1-controlled-launch and git ls-remote --tags origin refs/tags/v1-controlled-launch refs/tags/v1-controlled-launch^{} | true |
| CLX-003 | before_start | Confirm the S-V1-F-05 final ship decision still records SHIP. | npm.cmd run proof:s-v1-f-05 | true |
| CLX-004 | before_start | Confirm the S-V1-F-08 release evidence snapshot still passes. | npm.cmd run proof:s-v1-f-08 | true |
| CLX-005 | before_start | Complete the controlled launch readiness record for the named launch group. | docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.md | true |
| CLX-006 | before_start | Fix the named founder coach and athlete account list outside the repo. | operator-held named account record | true |
| CLX-007 | before_start | Record support route, defect intake route, and launch operator owner. | operator support record or runbook reference | true |
| CLX-008 | start | Create or verify founding user accounts using existing controlled-launch account flows. | account setup evidence reference | true |
| CLX-009 | start | Record coach-athlete relationship checks for each named pair. | relationship proof or controlled launch readiness item | true |
| CLX-010 | start | Run the founder test path for assignment, compile, session start, event recording, factual history, coach view, and support route. | proof:s-v1-f-01 or operator captured founder test evidence | true |
| CLX-011 | after_start | Capture evidence references for completed launch checks. | controlled launch evidence path entries | false |
| CLX-012 | after_start | Record any launch-blocking defect and stop new founding user starts until the defect is closed. | defect record with owner, timestamp, affected path, and closure evidence | true |

## Controlled launch evidence path

| Evidence ID | Evidence | Required reference |
| --- | --- | --- |
| CLE-001 | release_tag | v1-controlled-launch |
| CLE-002 | release_evidence_snapshot | docs/releases/V1_RELEASE_EVIDENCE_SNAPSHOT.md |
| CLE-003 | final_ship_decision | docs/releases/V1_FINAL_SHIP_DECISION.md |
| CLE-004 | controlled_launch_readiness_record | docs/releases/CONTROLLED_LAUNCH_READINESS_RECORD.md |
| CLE-005 | founder_test_pack | npm.cmd run proof:s-v1-f-01 |
| CLE-006 | acceptance_runner | npm.cmd run acceptance:v1:check |
| CLE-007 | claim_boundary_check | npm.cmd run lint:fast |
| CLE-008 | support_and_defect_route | operator support record |

## Founding user account setup instructions

1. Use named founding users only.
2. Keep the named participant list outside the repo.
3. Create or verify coach accounts through the existing controlled-launch coach account path.
4. Create or verify athlete accounts through the existing controlled-launch athlete account path.
5. Record coach-athlete relationship evidence for each named pair.
6. Do not add open sign-up, marketplace access, organisation access, gym access, team access, federation access, enterprise dashboard access, messaging, or post-v1 scope.
7. Capture account setup evidence references in the controlled launch evidence path.

## Founder test instructions

Use the existing founder test pack proof path:

    npm.cmd run proof:s-v1-f-01

The launch operator should capture evidence references for assignment, compile, session start, factual event recording, factual history, coach factual view, and support route availability.

Founder testing remains factual. It does not assess people, rank users, alter engine truth, or create outcome claims.

## Support and defect route references

Before starting named founding users, record:

- operator owner
- support intake route
- defect intake route
- defect owner
- escalation contact
- evidence storage location
- launch stop condition

If a launch-blocking defect appears, stop new starts for affected users, record the defect, keep existing factual evidence, and do not widen launch scope.

Required defect fields:

- defect_id
- detected_at_utc
- detected_by
- affected_path
- evidence_reference
- owner
- current_state
- closure_reference

Controlled launch operation continues only after a new evidence reference records the defect path closed.

## Boundary

This pack is factual and operator-facing only.

It does not touch product code.
It does not change engine behaviour.
It does not create feature implementation.
It does not change onboarding feature logic.
It does not change pricing logic.
It does not create marketplace scope.
It does not create organisation scope.
It does not create gym scope.
It does not create team scope.
It does not create federation scope.
It does not create enterprise dashboard scope.
It does not create messaging scope.
It does not activate post-v1 scope.
It does not create commercial claims.

This pack makes no athlete condition claim, programme effect claim, automated selection claim, automated ranking claim, external endorsement claim, or commercial claim.

## Required proof

    npm.cmd run proof:s-v1-f-09
    npm.cmd run proof:s-v1-f-05
    npm.cmd run proof:s-v1-f-08
    node ci/guards/postv1_packaging_surface_registry_guard.mjs
    npm.cmd run lint:fast
