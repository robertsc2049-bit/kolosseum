<!-- DEV NOTE: S-V1-U-04 template assignment UI boundary. This document permits a bounded coach assignment surface only; it does not create template content, commerce, template sharing, or deterministic engine behaviour. -->

# V1 Template Assignment UI

Status: active v1 slice boundary.
Slice: S-V1-U-04.
Surface: template_assignment_ui.

## Purpose

S-V1-U-04 creates a UI/API integration surface for an authorised coach to assign an existing v1 programme template to an assigned athlete.

The surface shows template metadata needed for assignment and records an assignment submission envelope for later product persistence and declared compile-path orchestration.

## Allowed

The slice may add:

- a bounded UI model
- an API adapter
- a copy-id-backed projection
- factual copy entries
- tests and guard
- release-boundary, acceptance, and authority-map markers
- package proof wiring

The UI may show:

- assigned athlete display id
- relationship id
- template id
- template display name
- template version
- activity id
- visible template summary
- assignment request id
- assignment status
- declared compile-path-required marker

## Required boundaries

The UI is authorised-coach only.

The UI may include assigned athletes only.

The UI must not expose hidden template internals.

The UI must not expose formula text, progression logic, internal rules, or calculation source.

The UI is engine-inert.

The UI must not alter deterministic engine truth.

The assignment envelope must remain product-layer state until passed through the declared compile path by a later boundary that is already permitted to compile.

## Not active in this slice

This slice does not activate:

- marketplace
- coach-to-coach sharing
- royalties
- revenue-share logic
- template publication
- template authoring
- template cloning
- derivative programme checks
- licence sale
- commerce
- database migration
- persistence implementation
- compile route mutation
- engine mutation
- formula visibility

## Proof

Required local proof:

- node --test test/s_v1_u_04_template_assignment_ui.test.mjs
- node ci/guards/s_v1_u_04_template_assignment_ui_guard.mjs
- standard generated-surface and checksum proof
- npm run lint:fast