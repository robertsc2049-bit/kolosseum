# V1 Legal Document Surfaces

Status: active v1 controlled-launch boundary document.
Slice: S-V1-L-01.
Version: 1.0.0.

## Purpose

This document defines the controlled-launch legal document rendering surface.

The surface renders:

- Terms
- Privacy
- DPA
- Legal index

The surface creates renderable document view models only.

The surface does not create data export handling.

The surface does not create account removal handling.

The surface does not create enterprise procurement handling.

The surface does not alter deterministic engine truth.

## Allowed scope

S-V1-L-01 permits:

- legal index rendering
- Terms rendering
- Privacy rendering
- DPA rendering
- legal route/API shaped adapter
- factual legal document copy
- route render tests
- copy lint tests
- engine isolation tests

## Not included

S-V1-L-01 does not implement:

- final solicitor-approved wording
- data export request workflow
- account removal request workflow
- cookie preference management
- enterprise legal workflow
- organisation legal workflow
- team legal workflow
- unit legal workflow
- federation legal workflow
- marketplace legal workflow
- provider calls
- billing state mutation
- coach-athlete relationship mutation
- engine decision logic

## Boundary invariants

1. Legal documents render.
2. Legal document copy remains factual and claim-neutral.
3. Legal documents do not change engine legality.
4. Legal documents do not change compile output.
5. Legal documents do not change substitution selection.
6. Legal documents do not change replay records.
7. Legal documents do not change proof records.
8. Legal documents do not change factual history records.
9. Legal documents do not change billing state.
10. Legal documents do not change coach-athlete relationship truth.

## Contract files

- `src/v1LegalDocumentSurfaces.mjs`
- `src/api/v1LegalDocumentSurfacesApi.mjs`
- `test/s_v1_l_01_legal_document_surfaces.test.mjs`
- `ci/guards/s_v1_l_01_legal_document_surfaces_guard.mjs`
- `copy/legal_document_surfaces_copy.json`

## Required proof

The slice must prove:

- legal index route render
- Terms route render
- Privacy route render
- DPA route render
- unknown route rejection
- route/document mismatch rejection
- copy remains factual and claim-neutral
- legal surfaces do not alter engine truth
- generated failure token index
- generated guard index
- generated checksum manifest
- standard proof sequence

## Failure token

`CI_V1_LEGAL_DOCUMENT_SURFACES`

## Launch note

This slice renders controlled-launch legal document surfaces only. Final public wording still requires formal review before live public launch.

## Final rule

If legal document rendering changes deterministic legality, compile output, substitution, replay, proof, factual history, billing state, or coach-athlete relationship truth, the implementation is invalid.