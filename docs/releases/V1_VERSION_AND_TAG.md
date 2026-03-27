# Kolosseum v1 version and tag contract

## Purpose
This document defines the truthful operator procedure for version confirmation and git tagging.
It does not create, imply, or simulate release automation.

## Authority boundaries

### 1. Version authority
- the repository package version is the version string authority
- the git tag is a release marker attached by an operator
- the release notes document is descriptive and does not override package or git history

### 2. Tag authority
- a tag is not considered part of the release record unless it points to a merged main commit
- a tag must be created intentionally by an operator
- annotated tags are preferred for release visibility and traceability

## Operator procedure
- [ ] hard-sync local main to origin/main
- [ ] confirm release notes artefact exists
- [ ] confirm release checklist artefact exists
- [ ] confirm CI for the intended release commit is fully green
- [ ] confirm the package version matches intended release naming
- [ ] create an annotated git tag on the merged main release commit
- [ ] push the tag to origin
- [ ] verify the tag resolves to the intended main commit

## Explicit non-claims
- no claim of automatic version bumping
- no claim of automatic tag creation
- no claim of automatic deployment
- no claim of app-store publication
- no claim that a tag alone proves runtime correctness or release approval