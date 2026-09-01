<!-- DEV NOTE: Developer documentation surface. This template standardises slice execution without creating product, engine, or release law. -->

# Slice Template

Status: developer handover template.

Use this for bounded Kolosseum repo changes.

## Slice header

Slice id:

Title:

Goal:

Boundary touched:

Boundary not touched:

Source-of-truth docs:

Required gates:

Commit message:

## Rules

- Start from a clean tree.
- Inspect before writing.
- Keep the change as small as possible.
- Do not duplicate canonical docs.
- Do not add v1 implementation inside v0 closure slices.
- Do not alter package version, release tags, registry content, migrations, UI screens, billing, dashboards, or commercial surfaces unless the slice explicitly requires it.
- Preserve UTF-8 without BOM and LF line endings.
- Run the canonical local verification entrypoint plus slice-specific gates from a clean tree before calling the slice complete.

## Inspection checklist

Record the current state before editing:

    git status --short
    git log -1 --oneline

Find relevant files:

    git ls-files
    git grep -n "search term"

Read the guard that owns the failure or boundary before editing.

## Implementation checklist

- Update only files inside the allowed boundary.
- Add DEV NOTE or FUNCTION NOTE comments only when they explain a critical boundary.
- Keep docs as pointer maps where canonical docs already exist.
- Avoid broad rewrites.
- Avoid hidden defaults.
- Avoid changing tests to fit broken behaviour.

## Gate checklist

Use targeted gates first where relevant.

Common targeted gates:

    node ci/guards/no_bom_guard.mjs
    node ci/guards/no_crlf_guard.mjs
    node ci/guards/dev_note_comment_policy_guard.mjs
    node ci/guards/dev_function_note_policy_guard.mjs
    node ci/scripts/run_v0_no_coupling_engine_boundary_guard.mjs
    node ci/scripts/run_v0_completion_gate_manifest_verifier.mjs

Then commit.

Then run the canonical clean-tree verification entrypoint:

    npm.cmd run verify

Slice-specific engine public contract gate:

    npm.cmd run test:v0:engine-contract

## Commit rule

Commit only intentional files.

Before commit:

    git status --short
    git diff --name-only

After commit:

    git status --short
    git log -1 --oneline

## Completion statement

A slice is complete only when:

- intended files are committed
- required targeted gates pass
- `npm.cmd run verify` passes from a clean tree
- slice-specific gates pass
- final working tree is clean

## Do not fix failures by

- deleting or weakening guards
- editing forbidden paths
- moving forbidden wording elsewhere
- widening engine exports casually
- adding silent registry or server behaviour
- treating README or handover docs as product law
- skipping clean-tree verification

<!-- S-V1-05:SLICE-TEMPLATE-ENFORCEMENT:START -->
## V1 enforced slice template

Status: enforced developer template for v1 slices.

This section standardises v1 slice work. It does not create product scope, engine behaviour, registry content, app implementation, payment implementation, auth implementation, UI implementation, workflow behaviour, or release approval.

No v1 work may start without a slice ID.

Do not implement before preflight.

### Required v1 slice prompt fields

Every v1 slice prompt must include:

- Slice ID:
- Title:
- Goal:
- Target:
- Boundary:
- Invariants:
- Allowed files:
- Forbidden files:
- Expected proof:
- Branch rule:
- Commit rule:
- PR rule:
- Non-scope:

### Required v1 implementation rules

- Start with a read-only preflight.
- Do not write files until preflight confirms the repo state.
- Work from current `main`.
- Use one branch per slice.
- V1 branch names must use `ticket/s-v1-<number>-<short-name>`.
- Do not use vague branches such as `fix-stuff`, `fixes`, `misc`, `stuff`, or `wip`.
- Every v1 branch must include the slice ID.
- Every v1 commit must start with the slice ID.
- Every v1 PR must state Boundary, Proof, and Non-scope.
- Every v1 PR must list files changed and tests or guards run.
- Generated files must be refreshed only through owning generators.
- Do not manually patch generated indexes unless the generator itself is the slice target.

### Required v1 preflight record

Before implementation, record:

- current branch
- clean or dirty tree state
- local HEAD
- origin main pointer
- target branch existence
- target PR existence
- authority docs inspected
- allowed files
- forbidden files
- generated files affected
- owning generators
- target guard or test proof
- non-scope confirmation

### Required v1 completion proof

A v1 slice is locally complete only when:

- intended files are committed
- targeted guard or test passes
- generated-file checks pass where applicable
- `npm.cmd run verify` passes from a clean tree
- final working tree is clean
- commit message begins with the slice ID

### Required v1 PR proof

A v1 PR is mergeable only when:

- PR title starts with the slice ID
- PR body states Boundary, Proof, and Non-scope
- every reported PR check is complete
- every reported PR check is green
- branch protection is bypassed only where checks are complete and green and the block is branch protection only
<!-- S-V1-05:SLICE-TEMPLATE-ENFORCEMENT:END -->
