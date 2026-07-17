# BETA-FIX-01 - Copy Registry Reconciliation

## Outcome

**RECONCILED**

One authoritative beta-wide copy registry now declares the BETA-04 baseline IDs and the existing BETA-16, BETA-17 and BETA-20 subordinate surfaces.

## Authoritative structure

- Registry: `copy/beta_copy_registry.json`
- Scope contract: `ci/locks/beta_copy_scope.json`
- Model: authoritative registry with declared subordinate surface registries
- Closed world: true
- Subordinate registries: 3
- Canonical copy IDs: 130

Subordinate registries cannot introduce undeclared IDs. Their exact paths, ordered ID sets and SHA-256 values are declared by the authoritative registry.

## ID reconciliation

- BETA-04 IDs retained: 21
- BETA-04 IDs mapped: 0
- BETA-20 IDs retained: 6
- BETA-20 IDs mapped: 0
- BETA-20 deterministic rendered bytes changed: no

## Scope coverage

- Explicit scoped paths: 14
- Future beta path prefixes: 6
- Technical exclusions: 2

The scope covers registry files, public beta presentation files, BETA-16 and BETA-17 service references, the BETA-20 Phase 7 copy boundary and the BETA-27 export adapter. BETA-28 protected-resource transport and the beta CI gate-separation module are explicitly excluded because they do not emit presentation copy.

## Enforcement

- Registered copy-ID references only
- Unknown IDs fail closed
- Duplicate IDs fail closed
- Missing required IDs fail closed
- Inline HTML and presentation-sink copy fail closed
- Forbidden language fails closed
- Contextual claims use a distinct failure classification
- Subordinate path, mirror, ID and checksum conflicts fail closed

## CI and proof

- Proof entrypoint: `proof:beta-fix-01`
- Behavioural tests: 18
- Stable failure tokens: 11
- Guard index: generated
- Failure-token index: generated
- Checksum artefacts declared: 15
- BETA-20 regression proof remains required

## PR #764 disposition

During this slice: **KEEP_OPEN_UNMERGED**

Recommended after BETA-FIX-01 is merged and present on the authoritative beta branch: **CLOSE_AS_SUPERSEDED**

BETA-FIX-01 itself does not merge or close PR #764.

## Non-actions

- No user-facing product behaviour was added.
- No engine truth was changed.
- No deterministic engine or Phase 7 output was changed.
- No registry activation law was changed.
- No launch GO or NO-GO decision was made.

## Final result

**RECONCILED**
