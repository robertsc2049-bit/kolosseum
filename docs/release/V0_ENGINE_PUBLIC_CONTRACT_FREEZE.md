# V0 Engine Public Contract Freeze

Status: active v0 release record.
Slice: S-V0-03 Engine Public Contract Freeze.

## DEV NOTE: purpose

This record documents the public engine contract freeze for v0.

It does not create new engine behaviour. It records the currently exported engine boundary and adds a guard so future UI, copy, notes, auth, billing, claims, dashboards, analytics, or later product surfaces cannot silently become part of engine truth.

## DEV NOTE: boundary invariant

The v0 engine is a deterministic execution boundary.

The public entrypoint is:

- engine/src/index.ts

The public named exports frozen by this slice are:

- runEngine

The wildcard export sources frozen by this slice are:

- ./run_pipeline.js

## DEV NOTE: failure behaviour

The guard at ci/scripts/run_v0_engine_public_contract_guard.mjs fails if public exports drift from ci/contracts/v0_engine_public_contract.json or if the engine entrypoint imports from forbidden product-layer surfaces.

Do not fix a guard failure by widening the contract casually. A public export change means the v0 engine contract changed and must be reviewed as a release-boundary decision.

## DEV NOTE: what must remain engine-invisible

The following must not influence engine output:

- UI copy
- coach notes
- auth state
- billing or payment state
- dashboards
- claims surfaces
- analytics surfaces
- later v1 product surfaces

## Completion condition

S-V0-03 is complete only when:

- the contract JSON exists
- the guard script exists
- the guard passes
- all required repo gates pass
- working tree is clean
- local main is pushed to origin/main after successful gates
