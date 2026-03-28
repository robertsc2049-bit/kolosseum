# V1 release artefact naming contract

This contract standardises naming for current release documents, pack files, and evidence outputs.

## Naming rules
1. Release-facing documentation under `docs/releases/` uses the `V1_` prefix.
2. Release document names use uppercase words with underscore separators.
3. Evidence manifests under `docs/releases/` use descriptive suffixes such as `_MANIFEST`.
4. Evidence output folders under `artifacts/` use lowercase descriptive names with underscore separators.
5. Script names under `ci/scripts/` use lowercase descriptive names with the `run_` or `build_` prefix where applicable.
6. This contract applies to current repo-known release, acceptance, promotion, and evidence surfaces only.

## Current release document examples
- `V1_RELEASE_NOTES.md`
- `V1_RELEASE_CHECKLIST.md`
- `V1_VERSION_AND_TAG.md`
- `V1_ROLLBACK.md`
- `V1_OPERATOR_RUNBOOK.md`
- `V1_ACCEPTANCE_SIGNOFF.md`
- `V1_ACCEPTANCE_PACK_INDEX.md`
- `V1_PROMOTION_FLOW.md`
- `V1_MAINLINE_GREEN_RUN_EVIDENCE.md`
- `V1_PACKAGING_EVIDENCE_MANIFEST.json`

## Current evidence output example
- `artifacts/postv1_packaging_evidence`

## Boundary
This contract is deterministic and current-surface only.
It does not define future artefact families, external packaging names, publishing names, or deployment names.