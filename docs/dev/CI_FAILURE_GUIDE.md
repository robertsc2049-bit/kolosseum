<!-- DEV NOTE: Developer documentation surface. This guide explains how to approach CI failures. It does not weaken guards or create new CI authority. -->

# CI Failure Guide

Status: developer handover guide.

Purpose: help a future developer identify what a gate is protecting and what not to change when fixing it.

The guard output is the immediate source of failure detail. This file is a navigation layer only.

Use docs/dev/FAILURE_TOKEN_INDEX.md when the failure output includes a stable token and you need to find the emitting source file.

## First response to any failure

1. Keep the failure output.
2. Identify the exact guard or script name.
3. Read that guard before changing code.
4. Fix the underlying boundary drift.
5. Re-run the targeted guard.
6. Commit.
7. Run `npm.cmd run lint:fast` from a clean tree.

## Common failures

### clean_tree_guard

Meaning: the gate requires no unstaged or staged changes.

Do not fix by weakening the guard.

Correct response: commit the intended change, revert unintended drift, or run the clean-tree gate only after the tree is clean.

### no_bom_guard

Meaning: a file contains a UTF-8 BOM.

Do not fix by disabling encoding checks.

Correct response: rewrite the file as UTF-8 without BOM and LF.

PowerShell note: avoid `Set-Content -Encoding utf8` in Windows PowerShell for repo writes.

### no_crlf_guard

Meaning: a repo text file contains CRLF.

Do not fix by allowing CRLF.

Correct response: rewrite the touched file with LF line endings.

### diff_line_endings_guard

Meaning: changed lines carry invalid line endings in a diff-aware context.

Do not fix by bypassing diff checks.

Correct response: normalise touched files to LF and re-run the targeted guard.

### readme_validation_contract_guard

Meaning: `README.md` no longer contains the required validation contract or contains a forbidden internal command.

Do not fix by adding internal green commands to the README.

Correct response: keep README as a stable entry point and point detailed commands to `docs/COMMANDS.md`.

### green_ci_parity_guard

Meaning: local green and GitHub Actions green wiring drifted.

Do not fix by deleting package scripts or weakening the workflow check.

Correct response: keep `green:ci` wired through the workflow path that the guard expects.

### v1_boundary_guard_scaffolding_guard

Meaning: a locked v1 boundary scaffold rule detected forbidden drift.

Do not fix by editing forbidden paths or widening the scaffold casually.

Correct response: revert forbidden path changes or create a deliberate boundary slice.

### dev_note_comment_policy_guard

Meaning: required developer signposting docs or DEV NOTE blocks drifted.

Do not fix by adding noisy comments everywhere.

Correct response: add concise notes only to critical boundary files and include Purpose, Boundary, Determinism, and Failure where enforced.

### dev_function_note_policy_guard

Meaning: required exported boundary functions lack structured function notes.

Do not fix by documenting unrelated functions.

Correct response: add targeted FUNCTION NOTE blocks immediately before enforced exports.

### engine_contract_guard / engine public contract guard

Meaning: engine contract bytes, exports, or public boundary changed.

Do not fix by widening exports casually.

Correct response: review whether this is a release-boundary change. If not, restore the contract.

### engine_exports_types_guard

Meaning: engine package export or type/default mapping changed.

Do not fix by hiding the failure with package metadata.

Correct response: restore expected exports or create a deliberate engine package contract slice.

### run_v0_no_coupling_engine_boundary_guard

Meaning: engine code imports or exports a forbidden app, UI, copy, commercial, payment, notes, auth, dashboard, analytics, server, or API surface.

Do not fix by adding an allow-list for convenience.

Correct response: move the dependency outward so product surfaces consume engine output, not the reverse.

### golden_manifest_guard / golden_outputs_guard

Meaning: deterministic fixture manifests or golden outputs drifted.

Do not fix by updating hashes without review.

Correct response: review the fixture change, regenerate through approved writer scripts only if intended, then commit JSON and hash pins together.

### spine_guard / sha256_guard

Meaning: docs listed in `docs/SPINE.md` or `docs/checksums.sha256` are missing or changed.

Do not fix by deleting spine entries casually.

Correct response: verify whether a canonical doc changed. If intentional, update checksum material through the approved path.

### registry_schema_presence_guard / registry_bundle_guard / registry_law_guard

Meaning: registry structure, bundle, or law checks failed.

Do not fix by adding temporary registry paths or hidden substitutions.

Correct response: restore registry schema, FK closure, bundle shape, or law rule compliance.

### run_commercial_artefact_registry_guard / lint_sales_claims

Meaning: commercial artefact registry or claim-safe copy checks failed.

Do not fix by moving claim language into another scanned file.

Correct response: keep copy factual and keep commercial artefacts registered or excluded under the current boundary.

### run_v0_active_scope_guard

Meaning: active v0 scope detected forbidden or future-scope material.

Do not fix by expanding v0 scope in a handover slice.

Correct response: move future material to clearly post-v0 documentation or revert it.

### run_v0_completion_gate_manifest_verifier

Meaning: the v0 completion checklist, required docs, required commands, or required guard wiring drifted.

Do not fix by weakening completion assertions.

Correct response: restore missing required files or update the manifest only through a deliberate release-boundary slice.

## Local triage pattern

Use targeted checks first, then full gate:

    node ci/guards/no_bom_guard.mjs
    node ci/guards/no_crlf_guard.mjs
    npm.cmd run lint:fast

Only run `npm.cmd run lint:fast` after committing or reverting changes, because it includes `clean_tree_guard`.

## Final rule

A passing targeted guard is not enough by itself. Finish with clean tree plus the slice-required full gates.

### CI wrapper contract failures

Meaning: package scripts, workflow commands, or wrapper semantics drifted.

Do not fix by deleting checks, removing clean-tree gates, or changing workflows to run weaker commands.

Correct response: keep local PowerShell commands Windows-safe with `npm.cmd`, keep GitHub workflows on `npm run ...`, preserve the wrapped command failure, and update the wrapper contract guard only when the release boundary intentionally changes.

<!-- S-V1-07:CI-FAILURE-ENTRY-PACK:START -->
## Developer entry pack failure path

A future developer should handle CI failure by reading the failing guard, reading the failure token, and checking the current release boundary before editing.

Start here:

1. `docs/dev/COMMAND_GUIDE.md`
2. `docs/dev/FAILURE_TOKEN_INDEX.md`
3. `docs/GUARDS_INDEX.md`
4. `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`
5. the failing guard or script

Primary local check command:

    npm.cmd run lint:fast

This section states what not to touch during failure recovery.

Do not touch runtime behaviour, engine behaviour, app implementation, registry content, payment/auth/UI implementation, workflows, generated files, package version, or release tags unless the named slice explicitly permits it.

Docs define law.
Tests prove behaviour.
Comments explain boundaries.
CI blocks drift.

This guide explains failure triage. It does not create product law, engine law, registry law, runtime law, commercial authority, CI token meaning, or release approval.
<!-- S-V1-07:CI-FAILURE-ENTRY-PACK:END -->
