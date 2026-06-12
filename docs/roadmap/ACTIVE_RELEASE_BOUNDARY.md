<!-- DEV NOTE: Developer documentation surface. This document points to active release-boundary records. It does not create new product, engine, registry, or commercial scope. -->

# Active Release Boundary

Status: pointer document for developer handover.

Purpose: give a future developer one place to find the current release-boundary records without relying on founder memory.

This document is not a new authority layer. If a listed source and this pointer disagree, the listed source wins.

## Current active release lane

Current working lane: v0 closure and v1 preparation guardrails.

The v0 engine and completion boundary remains governed by the v0 release records and executable guards.

Do not treat this pointer as permission to add v1 product implementation.

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

## Current v0 rule

v0 closure work may add guards, documentation, boundary checks, and proof records.

v0 closure work must not add new product capability unless a current release record explicitly permits it.

## Explicitly not added by this document

This document does not add:

- billing or subscription flows
- sales dashboards
- coach marketplace
- athlete marketplace
- new UI screens
- new registry content records
- new programme templates
- database migrations
- org/team/unit product capability
- live coach intervention
- claim, outcome, advisory, or interpretation language
- new engine public exports
- package version changes
- release tags

## Boundary check

Before changing code or docs, answer:

1. Which current boundary source permits this change?
2. Which guard proves it?
3. Which files must remain untouched?
4. Does this change alter engine truth?
5. Does this change make docs, UI, payment, notes, or copy appear more authoritative than engine contracts?

If the answer is unclear, inspect the relevant guard and source-of-truth record before editing.

## Completion references

v0 completion is not declared by this file.

Use the completion manifest and its verifier:

    node ci/scripts/run_v0_completion_gate_manifest_verifier.mjs

Use full local gate from a clean tree:

    npm.cmd run lint:fast
