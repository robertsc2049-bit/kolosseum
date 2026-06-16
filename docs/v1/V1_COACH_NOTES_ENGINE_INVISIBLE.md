# V1 Coach Notes Engine-Invisible

Status: active v1 slice documentation
Slice: S-V1-42
Surface: coach_notes

## Purpose

Coach notes remain product-layer records only.

They may support coach review surfaces, but they must not become deterministic inputs or alter recorded session artefacts.

## Boundary

Allowed:

- Assigned coach creates, updates, reads, and soft-deletes notes for an authorised athlete relationship.
- Athlete reads athlete-visible notes for their own session.
- Coach notes remain stored separately from factual artefacts.
- Copy explains the non-binding and separated nature of notes.

Not included:

- Engine input fields.
- Compile output mutation.
- Replay input mutation.
- Substitution logic.
- Proof artefact mutation.
- History truth mutation.
- Factual artefact mutation.

No engine input field may include coach notes.
No compile, replay, substitution, proof, or history surface may consume coach notes.

## Required proof

- Existing coach note creation and visibility tests remain present.
- Unlinked, revoked, rejected, invited, expired, and wrong-athlete relationship paths remain refused.
- Note creation does not change compile probe output.
- Note creation does not change session artefact projection.
- V1 compile input canonicalisation refuses coach note fields.
- Coach factual artefact view refuses coach note fields.
- No compile, replay, substitution, proof, or history surface may consume coach notes.
- S-V1-42 guard is registered in lint:fast.