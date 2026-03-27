# V1 promotion flow

This note records the internal repo-known promotion path from a completed packaging boundary to a merged release branch.

## Promotion path
1. Confirm the packaging boundary proof for the slice is green.
2. Stage only the intended repo files for that slice.
3. Commit the slice on its ticket branch.
4. Push the ticket branch to origin.
5. Open a pull request into main.
6. Wait for required pull request checks to pass.
7. Merge the pull request into main using the repo-approved merge path.
8. Sync local main to origin/main.
9. Confirm the pull request is merged and the working tree is clean.

## Boundary
This note describes repository, branch, pull request, and merge steps only.
It does not describe deployment, rollout, publishing, or customer-facing release activity.