<!--
DEV NOTE: This pull request template is an execution boundary, not product law.
Use it to make each change reviewable against scope, proof, and rollback needs.
Do not use this file to introduce engine behaviour, CI token meanings, registry rules,
copy authority, or release-scope changes. Canonical documents and tests remain the source of truth.
-->

## What changed
<!--
DEV NOTE: State the concrete repo changes only.
Good: "Added registry FK guard for exercise_token_id resolution."
Bad: broad product claims, future intent, or behaviour that is not implemented in this PR.
Keep this section factual so reviewers can compare the diff against the declared slice.
-->
-

## Why
<!--
DEV NOTE: Link the change to the slice purpose, failing gate, canonical boundary, or handover need.
This section should explain the reason for the change without redefining authority.
If the change exists because CI failed, name the gate or test rather than reinterpreting the failure token.
-->
-

## Tests
<!--
DEV NOTE: Tick only checks actually run for this PR.
Add any slice-specific checks beneath the existing baseline checks.
If a check was not run, leave it unticked and state why in plain factual language.
Do not mark manual inspection as equivalent to automated proof.
-->
- [ ] npm test
- [ ] npm run lint

## Risk
<!--
DEV NOTE: Record practical review exposure: touched boundaries, migration impact, test gaps, or rollback complexity.
Avoid product, medical, safety, suitability, optimisation, or outcome language.
For engine-adjacent work, explicitly say whether the PR changes engine inputs, outputs, phase order, registry loading, CI gates, or copy surfaces.
-->
-

## Rollback plan
<!--
DEV NOTE: State the exact revert path.
Prefer: revert commit / close PR / remove generated artefact / restore previous registry payload.
Do not propose partial runtime recovery, silent bypasses, or manual production edits.
If rollback requires data handling, state the data boundary precisely.
-->
-
---

## S-V1-00 developer operating conventions checklist

- [ ] Target is named with a slice ID.
- [ ] Boundary is stated.
- [ ] Non-scope is stated.
- [ ] Tests or guards run are listed.
- [ ] Naming follows docs/dev/NAMING_CONVENTIONS.md.
- [ ] Branch and PR rules follow docs/dev/BRANCH_AND_PR_CONVENTIONS.md.
- [ ] DEV NOTE or JSDoc changes are targeted and boundary-relevant, or not applicable.
- [ ] This PR does not add hidden product scope.

<!-- S-V1-05:PR-TEMPLATE-ENFORCEMENT:START -->
## S-V1-05 v1 slice enforcement checklist

- [ ] Target uses a slice ID.
- [ ] Boundary is stated.
- [ ] Proof is stated.
- [ ] Non-scope is stated.
- [ ] Files changed are listed or obvious from the PR.
- [ ] Tests or guards run are listed.
- [ ] Branch follows `ticket/s-v1-<number>-<short-name>` for v1 work.
- [ ] Commit starts with the slice ID.
- [ ] This PR does not hide v1 work without a slice ID.
- [ ] This PR does not use a vague branch such as `fix-stuff`, `fixes`, `misc`, `stuff`, or `wip`.
<!-- S-V1-05:PR-TEMPLATE-ENFORCEMENT:END -->
