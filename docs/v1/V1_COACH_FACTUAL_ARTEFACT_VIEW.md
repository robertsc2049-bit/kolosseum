# V1 Coach Factual Artefact View

Status: active v1 slice documentation
Slice: S-V1-41
Surface: v1_coach_factual_artefact_view

## Purpose

S-V1-41 creates a coach-facing read-only artefact view for assigned athletes.

The surface shows stored artefact records and runtime event facts for a single assigned athlete.

## Boundary

Allowed:

- Assigned coach reads artefacts for assigned athlete.
- API transports the read model.
- UI renderer exposes copy ids and recorded row facts.
- Permission failure is product permission state only.
- Coach notes remain separate.

Not included:

- Engine calls.
- Runtime event append.
- Session state mutation.
- Coach note inclusion.
- Programme outcome claims.
- Coach numeric assessment.
- Athlete ordering.
- Comparison surfaces.

## Required proof

- Assigned coach view passes.
- Unassigned coach view is refused.
- Non-coach actor is refused.
- Copy ids exist in copy registry surface.
- UI renderer returns copy ids and row facts only.
- Read model is byte-stable for the same explicit input.
- Guard is wired into lint:fast.