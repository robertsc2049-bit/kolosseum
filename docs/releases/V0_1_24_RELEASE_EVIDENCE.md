<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# v0.1.24 Release Evidence

## Release identity

Release tag: v0.1.24

Release commit: 40cc391fcc92027dbcee8313dc571ea6557b8dec

Package version: 0.1.24

Branch: main

Remote: origin

## Status

S08 pushed main and the immutable release tag to GitHub.

Final verified identity:

- HEAD: 40cc391fcc92027dbcee8313dc571ea6557b8dec
- origin/main: 40cc391fcc92027dbcee8313dc571ea6557b8dec
- v0.1.24 target commit: 40cc391fcc92027dbcee8313dc571ea6557b8dec
- Remote tag exists: refs/tags/v0.1.24

## GitHub workflow evidence

After push, the following GitHub workflow surfaces were observed green for the release commit:

- ci
- engine-status
- runnable-v0
- vertical-slice
- green
- Protect main

Captured workflow status:

    completed	success	chore: release v0.1.24	Protect main (auto-revert on CI failure)	main	push	26962804724	33s	2026-06-04T15:46:34Z
    completed	success	chore: release v0.1.24	runnable-v0	main	push	26962803931	14s	2026-06-04T15:46:33Z
    completed	success	chore: release v0.1.24	ci	main	push	26962803930	41s	2026-06-04T15:46:33Z
    completed	success	chore: release v0.1.24	engine-status	main	push	26962803926	37s	2026-06-04T15:46:33Z
    completed	success	chore: release v0.1.24	vertical-slice	main	push	26962804575	1m20s	2026-06-04T15:46:33Z
    completed	success	chore: release v0.1.24	green	main	push	26962804503	3m28s	2026-06-04T15:46:33Z
    completed	success	chore: release v0.1.24	Protect main (auto-revert on CI failure)	main	push	26962803909	3m36s	2026-06-04T15:46:33Z
    completed	success	Add S54 coach queue review static preview (#639)	Protect main (auto-revert on CI failure)	main	push	26507252213	3m46s	2026-05-27T11:02:46Z
    completed	success	Add S54 coach queue review static preview (#639)	runnable-v0	main	push	26507252280	19s	2026-05-27T11:02:46Z
    completed	success	Add S54 coach queue review static preview (#639)	ci	main	push	26507252355	32s	2026-05-27T11:02:46Z

## Branch protection note

The release push used an authorised branch-protection bypass. GitHub reported that direct changes to main would normally require pull request flow and required status checks.

This evidence file records the bypass as a release operation only. It does not weaken future branch protection expectations.

## Boundary

This release evidence records repository state only.

It does not claim production deployment.

It does not claim v1 completion.

It does not add new engine, proof-layer, export, dashboard, organisation, marketplace, billing, analytics, or commercial surface area.

## Immutability rule

Do not move, delete, overwrite, or force-push the v0.1.24 tag.

If another release is needed, bump package version and create a new immutable tag.
