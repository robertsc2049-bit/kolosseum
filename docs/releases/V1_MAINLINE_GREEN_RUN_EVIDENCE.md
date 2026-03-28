# V1 mainline green-run evidence

This note records how main green state is captured after a merge.

## Evidence sequence
1. Merge the approved pull request into `main`.
2. Sync local `main` to `origin/main`.
3. Run the repo-known post-merge verification script:
   - `ci/scripts/run_postv1_mainline_post_merge_verification.mjs`
4. Confirm the script emits:
   - `POSTV1_MAINLINE_POST_MERGE_VERIFICATION_OK`
5. Record the resulting clean local state and current `main` commit as internal green-run evidence.

## Repo-known evidence surfaces
- `ci/scripts/run_postv1_mainline_post_merge_verification.mjs`
- `npm run lint:fast`
- `npm run build:fast`
- clean `git status --short`
- current `main` commit after sync

## Boundary
This note describes internal repository verification only.
It does not imply deployment success, rollout success, publish completion, hosted availability, or customer-facing release success.