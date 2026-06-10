# Kolosseum v1 rollback note

## Purpose
This note defines conservative rollback expectations for the v1 release boundary.
It is an operator guidance artefact only and does not represent an automated rollback system.

## Trigger conditions
- release gate regression on merged main
- contract break against pinned release expectations
- golden or evidence mismatch that invalidates the intended release boundary
- post-release verification result that shows the release artefact set is not trustworthy

## Rollback expectations
- stop outward release communication for the affected release claim
- stop treating the affected release state as the current trustworthy release state
- identify the last known good merged main commit or validated release marker
- re-run the required CI / proof checks for the selected recovery point before making any new release claim
- correct the broken release artefact or release boundary before attempting a replacement release

## Explicit non-claims
- no automatic production rollback is claimed here
- no infrastructure rollback mechanism is claimed here
- no database rollback mechanism is claimed here
- no guarantee is made that a git tag alone is sufficient for recovery
## Rollback boundary

Rollback is limited to repo-known rollback artefacts and declared operator steps.

Rollback does not claim any rollback capability outside the declared release boundary.

Rollback claims are limited to files, checks, and steps that exist in this repository and are explicitly declared in the release artefacts.
