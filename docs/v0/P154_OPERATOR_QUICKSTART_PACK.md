# P154 — Operator Quickstart Pack

Status: Proposed
Scope: v0 only
Mode: BUILD
Rewrite Policy: rewrite-only

## Target

Create a brutally short operator quickstart for local proof, demo, and release checks.

## Invariant

Core founder/operator workflow must fit on one page.

The quickstart must reference only live commands and tracked artefacts.
No legacy command drift is allowed.

## Operator Quickstart

### 1) Repo root

`powershell
Set-Location C:\Users\rober\kolosseum
`",
  ",
  

Run the slice-targeted proof first.

`powershell
node --test <targeted test file>
`",
  ",
  

`powershell
npm run lint:fast
npm run dev:status
gh run list --limit 10
`",
  ",
  

Use only tracked v0 artefacts for proof/demo boundary reading:

- docs/v0/P153_V0_CAPABILITY_MATRIX.md
- docs/v0/P151_SPLIT_RETURN_DEMO_READ_MODEL_SURFACE.md
- docs/v0/P152_COACH_NOTES_BOUNDARY_PROOF.md

### 5) Release/operator rule

Do not claim capability outside the current v0 capability matrix.
Do not use legacy commands.
Do not widen beyond local proof, demo, and release checks.

## Allowed Commands

- Set-Location C:\Users\rober\kolosseum
- node --test <targeted test file>
- npm run lint:fast
- npm run dev:status
- gh run list --limit 10

## Forbidden Legacy Drift

- npm run engine-status
- scripts/engine-status.ps1
- broad undocumented repo commands
- stale operator shorthand not pinned in current workflow

## Completion Rule

This slice is complete only when the quickstart fits on one page, references only live commands and tracked artefacts, and stale or legacy command drift fails.