<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S43 - Support Boundary Templates In App

Document: SUPPORT_BOUNDARY_TEMPLATES_IN_APP.md
Project: Kolosseum v0
Slice: S43
Status: Implementable specification
Scope: Support boundary templates and operator picker contract
Engine compatibility: EB2-1.0.0
Rewrite policy: Rewrite-only

## 1. Purpose

S43 defines app support templates for requests outside Kolosseum v0 scope.

The support surface must provide consistent boundary-safe replies. A support reply may identify that a request is outside v0. It must not imply that the request is available in v0, promise future delivery, or create implied capability through escalation.

## 2. Files

S43 adds:

- support/support_boundary_templates.json
- contracts/support/support_boundary_picker.contract.json
- tests/support/support_boundary_templates.test.mjs
- docs/slices/SUPPORT_BOUNDARY_TEMPLATES_IN_APP.md

## 3. Template Model

Each template has:

- template_id
- excluded_ask_token_parts
- title
- response
- allowed_operator_actions
- escalation
- forbidden_implications

The excluded ask key is stored as token parts. Runtime code must join token parts to recover the canonical excluded ask key. This keeps support copy and production documents from exposing unsafe claim text while still preserving deterministic mapping.

## 4. Template IDs

The closed template ID set is:

- SBT001
- SBT002
- SBT003
- SBT004
- SBT005
- SBT006
- SBT007
- SBT008
- SBT009
- SBT010
- SBT011

No other template ID exists.

## 5. Boundary Rules

Templates must be factual and boundary-safe.

Templates must not:

- claim an excluded feature is available in v0
- promise future delivery
- imply escalation can create capability
- offer advisory judgement
- alter engine output
- alter Phase 1 declarations
- alter registry law
- alter compile artefacts
- alter session artefacts
- expand coach authority

## 6. Operator Picker Contract

The operator picker may:

- search by template_id
- search by reconstructed excluded ask key
- display title
- display response
- display allowed operator actions
- display escalation result

The operator picker must not:

- allow free-text mutation of template body
- allow creation of new template categories
- allow hidden escalation actions
- expose unsupported capability
- bypass template selection rules

## 7. Escalation Rules

Escalation is a routing outcome only.

Allowed escalation outcomes:

- no_escalation
- operator_note_only
- founder_review_log
- technical_support_review
- governance_review_log

Escalation must not state or imply that the excluded request can be actioned in v0.

Escalation must preserve the boundary reply.

## 8. Copy Requirements

Each template response must:

- be short
- be factual
- say the request is outside v0 where applicable
- provide the available v0-safe path
- avoid future roadmap promises
- avoid claims that exceed the v0 manifest

## 9. Acceptance Criteria

S43 is accepted only if:

- each excluded ask maps to exactly one template
- every template has a boundary-safe response
- every template has an escalation rule
- no template contains forbidden claim language
- no template contradicts v0 scope
- picker contract is closed-world
- negative copy tests pass
