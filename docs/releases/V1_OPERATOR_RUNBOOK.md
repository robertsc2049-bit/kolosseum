# Kolosseum v1 operator runbook

## Purpose
This runbook is a manual operator procedure for the current v1 release pack.
It reflects only artefacts and operator steps that exist in the repository now.
It does not imply automated deployment, automated publication, or automated rollback.

## 1. Preflight
- hard-sync local main to origin/main
- confirm docs/releases/V1_RELEASE_NOTES.md exists
- confirm docs/releases/V1_RELEASE_CHECKLIST.md exists
- confirm docs/releases/V1_VERSION_AND_TAG.md exists
- confirm docs/releases/V1_ARTEFACT_MANIFEST.json exists
- confirm docs/releases/V1_ROLLBACK.md exists
- confirm docs/releases/V1_ENV_TEMPLATE.example exists

## 2. Release execution
- review the release checklist and release notes together
- confirm CI for the intended release commit is fully green
- confirm the artefact manifest contains only real artefacts
- confirm the rollback note is present before making a release claim
- perform version/tag steps only if the operator is intentionally tagging the release

## 3. Post-release confirmation
- verify the intended release commit is still the current release reference point
- verify the release artefact set remains present and unchanged
- verify any created release tag resolves to the intended main commit
- stop release communication immediately if the release boundary becomes untrustworthy

## Explicit non-claims
- no automatic deployment is claimed here
- no automatic publication is claimed here
- no automatic rollback is claimed here