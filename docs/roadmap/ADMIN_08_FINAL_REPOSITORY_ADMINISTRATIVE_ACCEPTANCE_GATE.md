# ADMIN-08 — Final Repository Administrative Acceptance Gate

Status: acceptance gate only
Branch: `automation/admin-08-repository-admin-acceptance`

## Goal

Prove that repository code, CI, GitHub governance, documentation, registry acceptance and administrative state all describe the same current system.

ADMIN-08 is not a repair slice. A substantive failure discovered by this gate must remain a failure until repaired in the surface that owns it.

## Gate entrypoint

The executable gate is:

```text
node scripts/run_admin_repository_closure.mjs --write
```

It runs in the `green` workflow only after `green-unit` and `green-integration` have passed for a pull request. The gate also waits for and verifies the complete live default-branch required-check set on the exact PR head.

## Evidence

The gate creates:

```text
ci/evidence/admin_repository_closure.v1.json
```

The evidence is generated at CI runtime and uploaded as a GitHub Actions artifact. It is intentionally not committed as a static snapshot because the record binds the exact pull-request head SHA, exact current base SHA, live GitHub ruleset state, live open PR/issue state and check-run results. Committing that same record would change the head SHA it claims to attest.

The generated record includes:

- exact head SHA;
- exact base SHA;
- required CI check results;
- developer-command, path, documentation-currency, product-surface and mojibake results;
- live default-branch ruleset results and the documented bypass policy;
- the bypass-actor list, when exposed to the workflow token, as diagnostic evidence only;
- open obsolete REG-FULL draft PR count;
- open obsolete FULL-UI issue count;
- closed FULL-UI issue count;
- registry expected-count and REG-FULL-09 status;
- FULL-UI function-state counts;
- exact blockers when any check fails;
- final PASS/FAIL.

## Existing owners composed by ADMIN-08

ADMIN-08 does not replace these owners. It composes them:

- `ci/guards/developer_operating_conventions_guard.mjs` — canonical developer command and portable developer paths;
- `ci/guards/readme_validation_contract_guard.mjs` — README verification-command contract;
- `ci/guards/current_project_docs_currency_guard.mjs` — current-project documentation currency;
- `test/admin_04_product_surface_index_reconciliation.test.mjs` — product-surface index reconciliation;
- `ci/guards/no_mojibake_guard.mjs` — tracked-text mojibake signatures;
- `scripts/materialize_registry_expected_counts.mjs --check` — expected-count authority drift;
- `test/reg_full_09_final_registry_acceptance.test.mjs` — exact REG-FULL-09 acceptance;
- `ci/guards/full_ui_completion_guard.mjs` and `test/full_ui_25_final_acceptance_gate.test.mjs` — FULL-UI closure.

Live GitHub state remains authoritative for default branch, required ruleset checks, open PRs/issues and exact-head check runs.

## Required GitHub governance state

ADMIN-08 requires the active default-branch ruleset to retain the authoritative ten GitHub Actions contexts already documented by ADMIN-01:

- `v0-test-suite`;
- `runnable-v0`;
- `engine-status-guard-pull_request`;
- `engine-status-smoke-pull_request`;
- `plan-session-api`;
- `tier1-smoke-db`;
- `comprehensive-test-suite`;
- `green-unit`;
- `green-integration`;
- `ci`.

The live ruleset must remain strict. The bypass policy must remain explicitly documented as the PR-only repository-admin entry in `docs/dev/GITHUB_MERGE_ENFORCEMENT.md`.

GitHub's workflow-scoped `GITHUB_TOKEN` has read access to checks, contents, issues, metadata and pull requests, but it does not carry repository-administration authority. GitHub may therefore return an empty or redacted `bypass_actors` list to the closure job even when an owner/admin readback exposes the configured bypass. ADMIN-08 records whatever the workflow token returns as diagnostic governance evidence but does not treat absence from that limited runtime view as proof of bypass-policy drift. The required acceptance fact is the documented policy; actual bypass membership remains an owner/admin GitHub governance surface.

## Administrative reconciliation

The gate fails closed when any of the following is true:

- the checked-out head differs from the declared PR head;
- the PR base is not current `main`;
- the worktree is dirty before evidence generation;
- a draft REG-FULL PR remains open;
- a FULL-UI issue remains open after the function manifest reports no partial or missing functions;
- developer-command surfaces disagree;
- portable developer surfaces contain a developer-specific absolute Windows path;
- the current-project status or product-surface index disagrees with the current function manifest/report;
- known mojibake signatures remain;
- the default-branch ruleset or required check set drifts;
- the documented bypass policy drifts;
- the registry expected-count snapshot drifts;
- REG-FULL-09 is not PASS;
- FULL-UI contains a missing or partial function;
- any authoritative required GitHub check is missing, pending or failing on the exact head.

## Final statement

The executable gate prints:

```text
REPOSITORY_ADMIN_CLOSURE: PASS
```

only when every required check passes.

Otherwise it writes FAIL evidence, reports exact blockers and prints:

```text
REPOSITORY_ADMIN_CLOSURE: FAIL
```

No failure may be reclassified, suppressed or repaired inside ADMIN-08 merely to make this record green.
