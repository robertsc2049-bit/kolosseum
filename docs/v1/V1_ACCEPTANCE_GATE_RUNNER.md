<!-- DEV NOTE: S-V1-F-02 acceptance gate runner documentation. This is a release proof orchestration surface only. It does not create product law, engine law, registry law, workflow law, commercial authority, or production-data authority. -->

# V1 Acceptance Gate Runner

Status: active v1 acceptance gate runner documentation.

Slice: S-V1-F-02.

## Purpose

S-V1-F-02 creates the final v1 acceptance gate runner and manifest.

The runner makes v1 completion explicit and auditable.

V1 must not be marked complete unless every required acceptance gate in `docs/v1/V1_ACCEPTANCE_GATE_MANIFEST.json` is proven.

## Boundary

S-V1-F-02 may add:

- a v1 acceptance manifest
- a local acceptance gate runner
- tests and guard proof for the manifest and runner
- package scripts that name the exact acceptance commands
- v1 documentation pointers to the runner and manifest
- generated indexes refreshed through their owning generators

S-V1-F-02 must not add:

- broad workflow changes
- production data access
- production account creation
- live provider calls
- engine behaviour
- registry law
- runtime reducer behaviour
- substitution law
- product routes
- marketplace
- messaging
- team runtime
- organisation runtime
- unit runtime
- gym runtime
- federation runtime
- enterprise runtime

## Authority

The manifest and runner are proof orchestration only.

They do not define behaviour.

They do not replace feature guards.

They do not replace `npm.cmd run lint:fast`.

They do not permit manual assumptions.

They do not activate post-v1 surfaces.

The runner does not activate post-v1 surfaces.

If a command in the manifest fails, v1 is not complete.

If a required acceptance gate is missing from the manifest, v1 is not complete.

If a post-v1 scope leak is detected, v1 is not complete.

## Commands

Check manifest and runner wiring:

    node ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs --check

List required acceptance commands:

    node ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs --list

Run the acceptance commands from the manifest:

    node ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs --run

Package aliases:

    npm.cmd run acceptance:v1:check
    npm.cmd run acceptance:v1:list
    npm.cmd run acceptance:v1:run

Slice proof:

    npm.cmd run proof:s-v1-f-02

Full local proof:

    npm.cmd run lint:fast

## Completion rule

S-V1-F-02 is complete when:

- `docs/v1/V1_ACCEPTANCE_GATE_MANIFEST.json` exists.
- `ci/scripts/run_s_v1_f_02_v1_acceptance_gate_runner.mjs` exists.
- the manifest states that v1 cannot be marked complete unless all required gates pass.
- every required gate names exact commands.
- the manifest includes a post-v1 scope leak blocker gate.
- package scripts expose the acceptance check, list, run, and proof commands.
- target test and guard pass.
- generated indexes are refreshed by generators.
- `npm.cmd run lint:fast` passes.