# Documentation Maintenance Rules

This file defines how Kolosseum documentation should be kept useful without creating drift.

## Main Rule

Do not make docs cleaner by rewriting canonical rules into many places.

Make docs cleaner by improving:

- Indexes
- Pointers
- Search terms
- Authority chain
- Repo maps
- Developer start paths
- Missing-link visibility

## Allowed Documentation Work

Allowed:

- Add navigation docs.
- Add short summaries that point to authoritative docs.
- Add search guides.
- Add repo maps.
- Add module README files.
- Add DEV NOTE comments on critical functions.
- Add missing where-to-start guidance.
- Add CI checks that ensure important docs exist.
- Clarify authority order.

## Dangerous Documentation Work

Avoid:

- Rewriting canonical product rules for style.
- Deleting old docs without a deprecation plan.
- Moving files without updating links and references.
- Duplicating release boundaries into multiple docs.
- Turning future ideas into current commitments.
- Adding product claims.
- Adding unsupported safety, medical, or performance language.
- Adding implementation details that contradict tests.
- Creating docs that sound authoritative but are not.

## When Adding A New Doc

A new doc should state:

1. Purpose
2. Authority level
3. What it does not override
4. Related files
5. Search terms if relevant

## When Editing Existing Docs

Before editing:

1. Search for duplicate concepts.
2. Identify the highest-authority source.
3. Preserve original meaning.
4. Avoid expanding scope.
5. Avoid changing product claims.
6. Run docs/index checks.
7. Run relevant tests if behaviour-adjacent.

## When A Doc Looks Outdated

Do not delete it immediately.

Instead:

1. Check whether a newer authority exists.
2. Add a note pointing to the newer authority if appropriate.
3. Mark as historical only if the repo already has a clear replacement.
4. Avoid relying on metadata alone.
5. Preserve history unless there is a deliberate cleanup slice.

## Required Language Style

Use factual language.

Prefer:

- recorded
- reported
- declared
- selected
- assigned
- completed
- skipped
- substituted
- changed
- coach review
- available data

Avoid:

- recommends
- optimal
- safe
- safer
- risk
- injury risk
- readiness
- fatigue
- effective
- programme worked
- programme failed

## Documentation CI

The docs index check should prove that the navigation layer exists and contains required sections.

It should not validate product truth. Product truth is validated by contracts and tests.
