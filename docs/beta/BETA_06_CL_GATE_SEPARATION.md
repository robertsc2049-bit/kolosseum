<!-- DEV NOTE: BETA-06 controlled-launch gate separation record. This document records product/legal gate order only; it does not create CI token semantics, registry activation, engine law, replay authority, evidence authority, or proof claims. -->

# BETA-06 CL Gate Separation

Status: beta contract record.

## Purpose

BETA-06 separates controlled-launch legal permission refusal from technical engine, replay, evidence, and proof failure domains.

## Boundary

Controlled-launch legal permission must be evaluated before technical engine work.

Legal refusal is a product/legal refusal surface. It is not a CI failure token, runtime technical failure token, replay result, evidence envelope, or proof artefact.

## Required refusal conditions

Controlled launch must refuse before technical work when any of the following are true:

- consent is missing or false
- jurisdiction acknowledgement is missing or false
- age declaration is unsupported
- actor or execution scope is unsupported or unlawful for the beta pair

## Required non-effects after CL refusal

After CL refusal:

- no engine artefacts are created
- replay is not run
- no replay record is created
- no evidence envelope is created
- no proof artefact is created
- no CI failure token is emitted
- no runtime technical failure token is emitted

## Failure-domain separation

CL refusal uses product/legal refusal codes and neutral copy IDs.

Technical failure remains separate and may report technical failure tokens only after legal permission has passed.

## Machine proof

Machine-checkable implementation and proof:

- `src/betaClGateSeparation.mjs`
- `test/beta_06_cl_gate_separation.test.mjs`
- `ci/contracts/phase1_docs_ci_cluster.json`

## Copy boundary

CL refusal copy must remain neutral, factual, and non-claiming. It must not imply medical, safety, suitability, readiness, effectiveness, approval, certification, recommendation, or injury-prevention claims.
