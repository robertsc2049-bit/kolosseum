<!-- DEV NOTE: Developer documentation surface. This document points to active release-boundary records. It does not create new product, engine, registry, or commercial scope. -->

# Active Release Boundary

Status: pointer document for developer handover.

Purpose: give a future developer one place to find the current release-boundary records without relying on founder memory.

This document is not a new authority layer. If a listed source and this pointer disagree, the listed source wins.

## Current active release lane

Current working lane: v0 closure and v1 preparation guardrails.

The v0 engine and completion boundary remains governed by the v0 release records and executable guards until v0 closure is explicitly complete.

The v1 lane is scope-locked for planning through the v1 boundary documents listed below.

Do not treat this pointer as permission to add v1 product implementation. V1 implementation still requires a named slice, declared authority source, acceptance item, non-scope check, and proof gate.

## Source-of-truth records

Read these for the current boundary:

1. `docs/release/V0_COMPLETION_GATE_MANIFEST.md`
2. `docs/v0/V0_COMPLETION_GATE_MANIFEST.json`
3. `docs/release/V0_FINAL_RELEASE_READINESS_GATE.md`
4. `docs/release/V0_ENGINE_PUBLIC_CONTRACT_FREEZE.md`
5. `docs/release/V0_SCOPE_GUARD_HARDENING_RECORD.md`
6. `docs/release/V0_REGISTRY_BUNDLE_CLOSURE.md`
7. `docs/release/V0_REGISTRY_LAW_DOCUMENTATION_BINDING.md`
8. `docs/release/V0_COMMERCIAL_ARTEFACT_REGISTRY_CLOSURE.md`
9. `REPO_BOUNDARY_MAP.md`
10. `docs/dev/AUTHORITY_CHAIN.md`
11. `docs/v1/V1_RELEASE_BOUNDARY.md`
12. `docs/v1/V1_ACCEPTANCE_GATE.md`
13. `docs/v1/V1_NOT_IN_SCOPE.md`
14. `docs/v1/V1_DOC_AUTHORITY_MAP.md`

## Current v0 rule

v0 closure work may add guards, documentation, boundary checks, and proof records.

v0 closure work must not add new product capability unless a current release record explicitly permits it.

## Current v1 rule

v1 work may proceed only as named slices that map to:

- `docs/v1/V1_RELEASE_BOUNDARY.md`
- `docs/v1/V1_ACCEPTANCE_GATE.md`
- `docs/v1/V1_NOT_IN_SCOPE.md`
- `docs/v1/V1_DOC_AUTHORITY_MAP.md`

V1 slices must state boundary, proof, and non-scope.

## Explicitly not added by this document

This document does not add billing or subscription flows beyond named slices, sales dashboards, marketplace, new registry content, new programme templates, unsliced database migrations, org/team/unit/gym runtime capability, live coach intervention, advisory claims, new engine exports, package version changes, release tags, or Metric Threshold Marker Engine implementation.

## Boundary check

Before changing code or docs, identify the permitting authority, acceptance gate, non-scope boundary, proof guard, protected files, engine-truth effect, and any competing UI/payment/notes authority.

## Completion references

Use `npm run verify` for the full local gate. Historical v0/v1 completion records remain governed by their own canonical documents.

<!-- LAUNCH-00:CURRENT-PUBLIC-LAUNCH-AUTHORITY:START -->
## LAUNCH-00 Current Public Launch Authority
Authority: `docs/releases/PUBLIC_LAUNCH_RELEASE_BOUNDARY.md` and `.json`.
Release name: Kolosseum Public Launch. LAUNCH-00 supersedes the founder-only limit only for this new release's activation decisions and does not itself authorise public launch. Final authority is LAUNCH-10.
<!-- LAUNCH-00:CURRENT-PUBLIC-LAUNCH-AUTHORITY:END -->

<!-- LAUNCH-01:PUBLIC-LAUNCH-SURFACE:START -->
## LAUNCH-01 Public Launch Surface
Authority: `docs/releases/PUBLIC_LAUNCH_SURFACE_MANIFEST.json` and `.md`.
All 35 areas / 317 current functions are closed-world classified. Athlete/coach candidate scope is active; founder admin remains operator-only; post-v1 areas remain unlaunched.
<!-- LAUNCH-01:PUBLIC-LAUNCH-SURFACE:END -->

<!-- LAUNCH-02:PUBLIC-LAUNCH-COMMERCIAL-AUTHORITY:START -->
## LAUNCH-02 Commercial Pricing and Entitlement Freeze
Authority: `docs/releases/PUBLIC_LAUNCH_COMMERCIAL_AUTHORITY.json` and `.md`.
Provider-agnostic athlete and coach pricing, founding trial/intro clocks, hard capacity and engine isolation are frozen. Billing provider activation remains LAUNCH-04.
<!-- LAUNCH-02:PUBLIC-LAUNCH-COMMERCIAL-AUTHORITY:END -->

<!-- LAUNCH-03:PUBLIC-ACCOUNT-ACCESS:START -->
## LAUNCH-03 Public Account Registration and Access Activation
Authority:
- `docs/releases/PUBLIC_LAUNCH_ACCOUNT_ACCESS.json`
- `docs/releases/PUBLIC_LAUNCH_ACCOUNT_ACCESS.md`
- `scripts/launch_03_public_account_access_guard.mjs`
- `test/launch_03_public_account_access.test.mjs`

Public account actors are exactly athlete and coach. Existing persisted account registration, verification, session lifecycle and accepted individual coach-athlete relationship permissions are the launch account path. Organisation/team/gym account scope remains inactive. Auth/account/relationship permission state remains engine-invisible.

Persistent account and relationship lifecycle proofs are explicitly indexed into the DB-backed integration suite. Billing provider activation remains LAUNCH-04.

PASS token: `PUBLIC_LAUNCH_ACCOUNT_ACCESS: PASS`.
LAUNCH-03 does not authorise public launch. Final authority remains LAUNCH-10.
<!-- LAUNCH-03:PUBLIC-ACCOUNT-ACCESS:END -->
