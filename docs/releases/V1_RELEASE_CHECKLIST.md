# Kolosseum v1 release checklist

## Purpose
This checklist is for executing the v1 release boundary only.
Each item must be directly verifiable from merged artefacts, CI state, or replay/evidence law.
Unmerged work, inferred readiness, and generic release wishes do not count.

## Operator checklist

### 1. Main branch release base
- [ ] local main is hard-synced to origin/main
- [ ] release work is based only on merged main scope
- [ ] V1 release notes artefact exists at docs/releases/V1_RELEASE_NOTES.md

### 2. CI authority
- [ ] CI has passed fully for the release commit
- [ ] no release proceeds on partial, pending, bypassed, or failed CI
- [ ] CI is treated as existence-gating, not advisory

### 3. Replay gate
- [ ] replay runs only after prerequisite gates have passed
- [ ] replay uses identical canonical inputs and locked compatibility
- [ ] replay result is ACCEPTED before any evidence or export claim is made

### 4. Evidence / export gate
- [ ] evidence is not treated as sealed unless CI passed fully and replay is ACCEPTED
- [ ] no artefact is exported if replay failed
- [ ] no artefact is exported if evidence preconditions are unmet

### 5. Non-claim checks
- [ ] checklist does not claim safety, correctness, suitability, optimisation, or approval
- [ ] checklist does not claim unmerged scope
- [ ] checklist does not broaden replay proof beyond what the runner and CI actually prove