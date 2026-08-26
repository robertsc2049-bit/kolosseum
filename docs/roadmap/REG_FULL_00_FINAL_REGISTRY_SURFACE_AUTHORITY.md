# REG-FULL-00 — Final Registry Surface Authority

Status: authoritative architecture slice explanation.

The machine-readable authority created by REG-FULL-00 is `registries/final_registry_surface_manifest.json`. This document explains that authority; it does not replace it.

## Boundary

REG-FULL-00 resolves registry architecture only. The current live registry surface is implementation evidence, not automatically the final architecture. Historical S-REG candidate, activation and extension records remain historical facts and are not rewritten by this slice.

No active registry content, current registry index, generated registry bundle, registry seal artefact, golden output, supported activity, runtime behaviour, package version or release tag is changed by REG-FULL-00.

## Final classification

The manifest classifies 34 discovered registry concepts exactly once: 25 `required_active`, 1 `derived_generated`, 2 `retained_legacy`, 4 `dormant`, and 2 `prohibited`. The final required-active dependency/load order is encoded only in the JSON manifest.

The current compact `program` implementation is reconciled to Sport Program Profile Registry 5D, not Programme Template Registry 5F. Current `exercise_activity_applicability` is reconciled to Exercise to Sport Applicability Registry 6X. The sealed substitution graph and warm-up mapping remain retained legacy surfaces with explicit migration destinations. Threshold markers remain historically activated but dormant for final v1 runtime authority. Historical participation/attendance 5F and waiver 5G material remain dormant. Copy Registry remains the sole copy authority; independent instruction/display and copy/legal registries are prohibited only as competing authorities.

## Follow-up

Schema, canonical ID vocabulary and row-shape contradictions are deliberately deferred to REG-FULL-01. Content depth/coverage follows in later REG-FULL slices. Every later registry slice must consume `registries/final_registry_surface_manifest.json` and must not recreate registry architecture by inference.
