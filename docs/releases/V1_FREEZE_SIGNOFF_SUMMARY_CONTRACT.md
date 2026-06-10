<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# V1 Freeze Signoff Summary Contract

Purpose:
- provide one human-readable freeze signoff summary generated from existing freeze JSON artefacts only

Invariant:
- freeze decision must be reviewable in under 2 minutes
- summary introduces no new truth, scoring, or inference

Required source roles:
- closure
- readiness
- exit
- drift

Generation rules:
- missing required source artefact fails hard
- missing or unknown verdict fails hard
- identical inputs must produce byte-identical output
- output is derived only from pinned source artefacts
