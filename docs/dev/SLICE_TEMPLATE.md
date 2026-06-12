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
- Run full gates from a clean tree before calling the slice complete.

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

Then run clean-tree gates:

    npm.cmd run lint:fast

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
- `npm.cmd run lint:fast` passes from a clean tree
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
