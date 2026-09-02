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

This document does not add:

- billing or subscription flows beyond a deliberately sliced controlled-launch payment path
- sales dashboards
- coach marketplace
- athlete marketplace
- new UI screens without a v1 acceptance item
- new registry content records without a registry slice
- new programme templates without a registry/template slice
- database migrations without a data-model slice
- org/team/unit/gym runtime capability
- live coach intervention
- claim, outcome, advisory, or interpretation language
- new engine public exports
- package version changes
- release tags
- Metric Threshold Marker Engine implementation

## Boundary check

Before changing code or docs, answer:

1. Which current boundary source permits this change?
2. Which acceptance gate item does this advance?
3. Which not-in-scope item does this avoid?
4. Which guard proves it?
5. Which files must remain untouched?
6. Does this change alter engine truth?
7. Does this change make docs, UI, payment, notes, metrics, proof, or copy appear more authoritative than engine contracts?

If the answer is unclear, inspect the relevant guard and source-of-truth record before editing.

## Completion references

v0 completion is not declared by this file.

Use the completion manifest and its verifier:

    node ci/scripts/run_v0_completion_gate_manifest_verifier.mjs

Use full local gate from a clean tree:

    npm run verify

V1 completion is not declared by this file.

Use the v1 acceptance gate and any matching v1 release gate:

    docs/v1/V1_ACCEPTANCE_GATE.md
    node ci/scripts/run_v1_release_gate.mjs

<!-- S-V1-01:ACTIVE-V1-BOUNDARY-CONFIRMATION:START -->
## S-V1-01 Active v1 Boundary Confirmation

Status: active boundary confirmed

The active v1 boundary is confirmed by:

- docs/roadmap/V1_ACTIVE_BOUNDARY_CONFIRMATION.md
- docs/roadmap/V1_ACTIVE_BOUNDARY_CONFIRMATION.json
- ci/guards/s_v1_01_active_boundary_confirmation_guard.mjs

This confirmation does not reopen v0 scope and does not add engine runtime behaviour.
<!-- S-V1-01:ACTIVE-V1-BOUNDARY-CONFIRMATION:END -->

<!-- S-V1-10:ACTIVE-RELEASE-BOUNDARY-CLOSURE:START -->
## S-V1-10 Active Release Boundary Closure

S-V1-10 closes the canonical v1 release-boundary files before product implementation widens.

V1 equals a complete coach-athlete product with proof layer and full supported registry/template/substitution coverage.

Controlled launch support is allowed only where separately sliced and only where it cannot alter engine truth.

Organisations, organizations, teams, gyms, units, federations, marketplace, messaging, chat, EPOS, gym access, full dashboards, and enterprise remain excluded from v1.

This active release pointer does not create implementation authority, engine authority, registry content, payment implementation, auth implementation, UI implementation, commercial authority, legal authority, proof authority, or release approval.
<!-- S-V1-10:ACTIVE-RELEASE-BOUNDARY-CLOSURE:END -->

<!-- LAUNCH-00:CURRENT-PUBLIC-LAUNCH-AUTHORITY:START -->
## LAUNCH-00 Current Public Launch Authority

Status: current release-preparation pointer.

The current post-ADMIN public-launch preparation boundary is:

- `docs/releases/PUBLIC_LAUNCH_RELEASE_BOUNDARY.md`
- `docs/releases/PUBLIC_LAUNCH_RELEASE_BOUNDARY.json`

Release name: Kolosseum Public Launch.

For this new release's activation decisions only, LAUNCH-00 supersedes the historical founder-group-only controlled-launch limit. It does not rewrite the historical controlled-launch GO record, does not retroactively widen First Lawful Run v1 scope, and does not itself authorise public launch.

Implementation existence remains distinct from release activation. Current post-v1 surfaces remain unlaunched unless the LAUNCH-00 manifest explicitly classifies them otherwise.

The exact accepted registry activity scope remains sourced from REG-FULL-09.

Final public launch authority belongs only to `LAUNCH-10`, which may emit `PUBLIC_LAUNCH_ACCEPTANCE: GO` only after every required launch gate passes.

Use the executable LAUNCH-00 proof:

    node --test test/launch_00_current_release_authority.test.mjs
    node scripts/launch_00_current_release_authority_guard.mjs

This pointer creates no payment implementation, pricing, account-registration change, UI change, database migration, programme import, marketplace activation, organisation activation, registry content, or engine behaviour.
<!-- LAUNCH-00:CURRENT-PUBLIC-LAUNCH-AUTHORITY:END -->

<!-- LAUNCH-01:PUBLIC-LAUNCH-SURFACE:START -->
## LAUNCH-01 Public Launch Surface

Status: executable closed-world function classification for the LAUNCH-00 release boundary.

Authority:

- `docs/releases/PUBLIC_LAUNCH_SURFACE_MANIFEST.json`
- `docs/releases/PUBLIC_LAUNCH_SURFACE_MANIFEST.md`
- `scripts/launch_01_public_launch_surface_guard.mjs`
- `test/launch_01_public_launch_surface_manifest.test.mjs`

The exact current UI inventory is 35 product areas and 317 implemented functions. Every function is classified through the blob-pinned closed-world projection. No implementation is launch-active merely because it exists.

`launch_active` equals LAUNCH-00 public launch candidate scope exactly. `founder_admin` remains operator-only. All LAUNCH-00 post-v1 areas remain implemented but not launched. Current `historical`, `diagnostic` and `future` area sets are empty and explicit.

Function-level launch overrides are forbidden. Unknown functions, unknown areas, actor drift, missing normal route/action ownership, public operator exposure and unauthorised post-v1 promotion fail closed.

Commercial entitlement remains downstream-gated and cannot alter deterministic engine truth. UI state, payment state and product state cannot change compile output.

Use the executable LAUNCH-01 proof:

    node --test test/launch_01_public_launch_surface_manifest.test.mjs
    node scripts/launch_01_public_launch_surface_guard.mjs

LAUNCH-01 does not authorise public launch. Final authority remains LAUNCH-10.
<!-- LAUNCH-01:PUBLIC-LAUNCH-SURFACE:END -->

<!-- LAUNCH-02:PUBLIC-LAUNCH-COMMERCIAL-AUTHORITY:START -->
## LAUNCH-02 Commercial Pricing and Entitlement Freeze

Status: frozen provider-agnostic pricing and entitlement authority.

Authority:

- `docs/releases/PUBLIC_LAUNCH_COMMERCIAL_AUTHORITY.json`
- `docs/releases/PUBLIC_LAUNCH_COMMERCIAL_AUTHORITY.md`
- `scripts/launch_02_commercial_pricing_entitlement_guard.mjs`
- `test/launch_02_commercial_pricing_entitlement_freeze.test.mjs`

The launch commercial model freezes one individual-athlete plan and six coach tiers, the 30-day no-card founding trial, six paid introductory months, first-100 active founding cohort with explicit expansion authority up to 250, and server-authoritative hard athlete caps.

Athlete and coach subscriptions remain separate commercial truths. Commercial state controls product access only and cannot alter deterministic engine, registry, substitution, factual history, proof, or relationship truth.

LAUNCH-02 does not connect Stripe or implement checkout. Production billing lifecycle activation remains LAUNCH-04 scope. Organisation, team, gym and enterprise tiers remain unauthorised.

Use the executable LAUNCH-02 proof:

    node --test test/launch_02_commercial_pricing_entitlement_freeze.test.mjs
    node scripts/launch_02_commercial_pricing_entitlement_guard.mjs

PASS token: `PUBLIC_LAUNCH_COMMERCIAL_AUTHORITY: PASS`

LAUNCH-02 does not authorise public launch. Final authority remains LAUNCH-10.
<!-- LAUNCH-02:PUBLIC-LAUNCH-COMMERCIAL-AUTHORITY:END -->
