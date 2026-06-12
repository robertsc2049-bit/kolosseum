# Branch and PR Conventions

Status: canonical developer convention for v1 and later.
Release boundary: applies from S-V1-00 onward.

## Purpose

Branches and PRs must show exactly what slice they carry, what boundary they touch, and how the change was proved. They must not become hidden planning spaces or long-running product dumps.

## Branch naming

Use one branch per slice.

Required v1 form:

- ticket/s-v1-00-short-name
- ticket/s-v1-01-short-name

Developer-only form:

- ticket/s-dev-short-name

Emergency form:

- hotfix/short-critical-fix-name

Backup/rescue form:

- backup/short-reason-yyyyMMdd-HHmmss
- rescue/short-reason-yyyyMMdd-HHmmss

## PR title

Use:

- S-V1-00: Short slice name
- S-DEV: Short developer support change
- HOTFIX: Short critical fix

Examples:

- S-V1-00: Developer Operating Conventions Lock
- S-V1-01: Active v1 Boundary Confirmation
- S-DEV: CI Failure Guide Update

## PR body must include

Every PR must state:

- Target
- Boundary
- Non-scope
- Files changed
- Tests run
- Risk
- Rollback
- Developer notes added or not applicable

## Required boundary language

Use this wording where applicable:

- This PR does not add product scope.
- This PR does not alter deterministic engine truth.
- This PR does not make coach notes engine-visible.
- This PR does not add recommendations, optimisation, diagnosis, risk, readiness, fatigue, or live intervention.
- This PR does not add billing, marketplace, organisation, gym, federation, messaging, or EPOS scope.

## Merge rule

Do not merge dirty, behind, or review-required PRs.

Do not merge stale pre-v0 or post-v1 branches into v1.

Do not merge a PR if it changes release boundary docs without matching tests or guard coverage.

## Branch cleanup

After merge or closure:

- delete the remote branch,
- delete local branch if not needed,
- do not keep stale ticket branches as planning storage,
- recreate future work from current main.

## Admin bypass

Admin bypass is reserved for release-boundary correction or explicitly approved emergency recovery. It must be stated in the output when used.
