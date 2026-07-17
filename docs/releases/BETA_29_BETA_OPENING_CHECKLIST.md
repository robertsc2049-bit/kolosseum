<!-- DEV NOTE: BETA-29 operational checklist only. This document creates no engine, registry, product, payment, or runtime authority. -->

# BETA-29 Beta Opening Checklist

Slice: BETA-29
Scope: controlled production beta opening
Required proof command: npm.cmd run rehearsal:beta

No item may be inferred. Every item must be recorded from repository, CI, deployment, or operator evidence.

## Beta opening checklist

### Release-candidate identity

- [ ] The working tree is clean.
- [ ] The selected commit is the intended merged beta-base commit.
- [ ] The release-candidate identifier and commit SHA are recorded.
- [ ] Node and npm versions match the repository pins.
- [ ] Dependency installation used the committed lockfile.
- [ ] No unmerged branch is included in the candidate.

### Rehearsal gate

- [ ] npm.cmd run rehearsal:beta completed successfully.
- [ ] The clean individual Phase 1-8 assertion passed.
- [ ] The coach-managed assertion passed.
- [ ] The replay verdict was ACCEPTED.
- [ ] Phase 8 evidence was sealed.
- [ ] Projection export bytes matched stored projection bytes.
- [ ] Evidence export bytes matched sealed evidence bytes.
- [ ] The copy-policy scan passed.
- [ ] Organisation, team, unit, and gym runtime remained unreachable.
- [ ] The tracked-file secret scan passed.
- [ ] The production dependency audit reported zero high and zero critical findings.
- [ ] Full repository CI passed for the candidate commit.
- [ ] All GitHub checks completed successfully.

### Operational controls

- [ ] The status surface was checked.
- [ ] Error reporting was checked.
- [ ] The backup and restore reference was checked.
- [ ] The opening operator is recorded.
- [ ] The rollback operator is recorded.
- [ ] The incident owner is recorded.
- [ ] The opening window start and end are recorded.
- [ ] Open blocker count is zero.
- [ ] Open incident count is recorded.
- [ ] No production secret value appears in the opening record.
- [ ] No live export is attached to the opening record.

### Scope lock

- [ ] Supported actors remain individual user and coach only.
- [ ] Supported execution scopes remain individual and coach-managed only.
- [ ] Supported activities remain powerlifting, rugby_union, and general_strength only.
- [ ] Organisation, team, unit, and gym runtime remain unavailable.
- [ ] No dashboard, analytics, ranking, messaging, or broader entity runtime was activated.
- [ ] No beta acceptance test was weakened.

### Opening decision

- [ ] Every required item above is complete.
- [ ] The opening decision is recorded as OPEN or DO NOT OPEN.
- [ ] Any failed item produces DO NOT OPEN.
- [ ] A failed item is assigned to a separate bounded fix slice.

## Rollback checklist

Use docs/releases/V1_ROLLBACK_RUNBOOK.md as the controlling rollback surface.

- [ ] Identify the affected non-engine surface.
- [ ] Pause new beta access where required.
- [ ] Disable or withdraw the affected UI, API, integration, or export surface.
- [ ] Record the rollback timestamp and operator.
- [ ] Preserve historical truth and runtime events.
- [ ] Preserve replay artefacts.
- [ ] Preserve sealed evidence without rewriting it.
- [ ] Preserve registry content unchanged.
- [ ] Confirm that engine legality and determinism were not changed.
- [ ] Re-run npm.cmd run rehearsal:beta before any later promotion.
- [ ] Record the post-rollback incident state.
- [ ] Do not use rollback to repair or replace historical truth.

## Release tag checklist

Use docs/releases/V1_RELEASE_TAG_PREPARATION.md and .github/workflows/release.yml as the controlling tag surfaces.

- [ ] The candidate commit is merged and locally synchronised.
- [ ] Full CI passed on the exact candidate commit.
- [ ] npm.cmd run rehearsal:beta passed on the exact candidate commit.
- [ ] The candidate tag name is recorded.
- [ ] The candidate tag does not already exist locally or remotely.
- [ ] The tag points to the exact candidate commit.
- [ ] The release workflow is enabled for the selected rc-* or v* tag lane.
- [ ] The tag is not created from a dirty tree.
- [ ] The tag is not moved after creation.
- [ ] Release workflow checks are retained as evidence.
- [ ] A failed release workflow blocks beta opening or continued promotion.

BETA-29 itself does not create or push a tag.

## Support and incident checklist

Use docs/ops/V1_RUNBOOK.md and docs/v1/V1_STATUS_PAGE.md as the controlling operational surfaces.

- [ ] A support contact is recorded for the beta window.
- [ ] An incident owner is recorded.
- [ ] The status surface is available.
- [ ] The error-reporting surface is available.
- [ ] Open incident count is recorded at opening.
- [ ] Open incident count is recorded at handover.
- [ ] Open incident count is recorded at close.
- [ ] Every incident records factual time, affected surface, observed state, and operator action.
- [ ] Incident notes contain no production secret values.
- [ ] Incident notes contain no live data export.
- [ ] Engine, registry, replay, or evidence mutation triggers an immediate pause.
- [ ] An unresolved release blocker produces DO NOT OPEN or PAUSE.
- [ ] Handover notes identify the next operator and unresolved factual items.

## Required opening record

The opening record must include:

- candidate commit SHA;
- release-candidate identifier;
- rehearsal command result;
- GitHub check result;
- opening operator;
- rollback operator;
- incident owner;
- beta window;
- open blocker count;
- open incident count;
- opening decision;
- record timestamp.

The record must not contain credentials, secret values, live exported user data, coaching judgement, or claims about outcomes.
