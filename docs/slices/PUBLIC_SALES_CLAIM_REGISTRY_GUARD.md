<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# S44 - Public Sales Claim Registry Guard

Document: PUBLIC_SALES_CLAIM_REGISTRY_GUARD.md
Project: Kolosseum v0
Slice: S44
Status: Implementable specification
Scope: Public copy claim registry and fail-closed guard
Engine compatibility: EB2-1.0.0
Rewrite policy: Rewrite-only

## 1. Purpose

S44 defines a CI-ready guard for surfaced public copy.

The guard protects public, pricing, sales, admin, app, and documentation copy by requiring surfaced claims to match a registered allowed claim exactly.

Coach tier copy is especially sensitive. The binding authority limit is:

Coaches may comment, never decide

## 2. Files

S44 adds:

- claims/public_sales_claim_registry.json
- ci/scripts/run_public_sales_claim_registry_guard.mjs
- tests/fixtures/public_sales_claim_registry_guard_fixtures.json
- tests/claims/public_sales_claim_registry_guard.test.mjs
- docs/slices/PUBLIC_SALES_CLAIM_REGISTRY_GUARD.md

## 3. Claim Registration Rule

Any surfaced public claim must be marked in source text as:

PUBLIC_CLAIM: exact registered claim phrase

The guard extracts the phrase after PUBLIC_CLAIM and compares it with the registry.

A surfaced claim passes only when:

- the phrase exactly matches one registered claim
- the registered claim has at least one proof id
- every proof id resolves to a registry proof entry
- no forbidden semantic rule matches the surfaced text

## 4. Allowed Claim Types

The registry supports only these allowed claim type ids:

- price_fact
- seat_cap_fact
- access_fact
- visibility_fact
- authority_limit
- proof_scoped_value
- factual_runtime_surface

No other claim type is valid.

## 5. Forbidden Semantic Rules

Forbidden semantic classes are encoded in the registry as FSC rules.

The registry stores sensitive terms as token parts. The guard reconstructs those terms at runtime before scanning candidate copy.

This prevents the guard's own source files from becoming accidental public claim violations while still enforcing the required semantics.

## 6. Fail-Closed Behaviour

The guard fails when:

- a surfaced public claim is unknown
- a registered claim has no proof link
- a registered proof id is missing
- a forbidden semantic rule matches
- a context rule matches
- the registry shape is invalid
- a scan file cannot be read

## 7. Report Format

The guard report is JSON:

- ok
- registry_id
- scanned_files
- failures

Each failure includes:

- code
- path
- line
- rule_id
- claim
- excerpt

## 8. Coach 16 Public Copy

The coach_16 public copy is allowed only when exact registered phrases are used.

Allowed phrases include:

- £59.99 per month
- Manage up to 16 athletes
- Assign programs within system limits
- View athlete execution artefacts
- Write non-binding coach notes
- Coaches may comment, never decide
- Payment controls access only and does not change engine output

Any stronger claim fails.

## 9. Acceptance Criteria

S44 is accepted only if:

- allowed coach_16 pricing copy passes
- a stronger unregistered claim fails
- proof package claims in public copy fail
- forbidden FSC public copy fails
- unknown claims fail
- missing proof links fail
- the report format is deterministic
- the guard fails closed
