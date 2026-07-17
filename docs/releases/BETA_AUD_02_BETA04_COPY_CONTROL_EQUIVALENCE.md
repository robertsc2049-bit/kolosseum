# BETA-AUD-02 — BETA-04 Copy-Control Equivalence Assessment

## Assessment result

**PARTIALLY_SUPERSEDED**

Later beta slices reproduce some BETA-04 copy-control protections, principally within the BETA-20 Phase 7 factual projection surface. They do not reproduce the complete beta-wide BETA-04 contract.

## Source state

- PR: #764
- PR state: OPEN
- Merged: false
- Feature branch: `beta/BETA-04-copy-registry-baseline`
- Feature SHA: `7890518e0e981f7624b7fa246e2545882b3c84af`
- Authoritative beta branch: `beta/BETA-10-phase3-constraint-prune`
- Authoritative beta SHA: `771a52b9f74449e36b4333b438984f08d732c568`

PR #764 remained open and unmerged throughout this assessment.

## Critical findings

- Required BETA-04 copy IDs present: 0 of 21.
- Required BETA-04 copy IDs absent: 21 of 21.
- Exact baseline copy registry present: no.
- Exact beta copy scope lock present: no.
- Exact BETA-04 guard present: no.
- Exact BETA-04 test file present: no.
- Original PR paths currently present: 10 of 17.
- Original PR paths byte-identical: 0 of 17.

Shared infrastructure paths remaining in the repository do not establish functional equivalence.

## Requirement matrix

Requirement ID | Requirement | Equivalence | Finding
--- | --- | --- | ---
BETA04-EQ-01 | BASELINE_COPY_REGISTRY | NO_EQUIVALENCE | The closed-world BETA-04 baseline registry is absent. BETA-20 provides a separate six-ID Phase 7 projection registry only.
BETA04-EQ-02 | REQUIRED_BETA_COPY_IDS | NO_EQUIVALENCE | None of the 21 BETA-04 required copy IDs exist in the authoritative beta integration branch.
BETA04-EQ-03 | NO_INLINE_COPY_ENFORCEMENT | PARTIAL_EQUIVALENCE | BETA-20 rejects inline copy and unknown references inside the Phase 7 projection contract, but it does not scan all BETA-04 beta scope paths.
BETA04-EQ-04 | FORBIDDEN_LANGUAGE_ENFORCEMENT | PARTIAL_EQUIVALENCE | BETA-20 rejects a narrower forbidden-term set on Phase 7 registry text. It does not reproduce BETA-04 medical, protection, prevention and full performance-language coverage.
BETA04-EQ-05 | CONTEXTUAL_CLAIMS_ENFORCEMENT | NO_EQUIVALENCE | The BETA-04 personalised and avoidance contextual phrases are not enforced by the BETA-20 copy library or tests.
BETA04-EQ-06 | SCOPE_PATH_COVERAGE | NO_EQUIVALENCE | The BETA-04 scope lock and its app, src, UI, server, web and client beta path prefixes are absent.
BETA04-EQ-07 | GUARD_ENTRYPOINT_REGISTRATION | PARTIAL_EQUIVALENCE | The later BETA-20 guard has a declared proof entrypoint, but the BETA-04 beta-wide guard is absent.
BETA04-EQ-08 | FAILURE_TOKEN_REGISTRATION | PARTIAL_EQUIVALENCE | BETA-20 exposes one guard-owned token and reason strings, but not BETA-04's six copy-specific tokens or BETA-03 structured token-report contract.
BETA04-EQ-09 | GUARD_INDEX | PARTIAL_EQUIVALENCE | The BETA-20 Phase 7 copy guard is indexed, but no BETA-04 beta-wide copy guard is indexed.
BETA04-EQ-10 | FAILURE_TOKEN_INDEX | PARTIAL_EQUIVALENCE | The later BETA-20 guard token is indexed, but the BETA-04 copy-specific token set is absent.
BETA04-EQ-11 | CHECKSUMS | NO_EQUIVALENCE | The current checksum file and beta artefact manifest do not directly include the BETA-20 copy registry, copy guard or copy guard library.
BETA04-EQ-12 | FOUR_CORE_TEST_CLASSES | PARTIAL_EQUIVALENCE | BETA-20 proves allowed registry use, inline-copy rejection and forbidden-language rejection, but does not include the BETA-04 contextual-claim test class.

## Outcome counts

- FULL_EQUIVALENCE: 0
- PARTIAL_EQUIVALENCE: 7
- NO_EQUIVALENCE: 5

## Decision basis

Later slices reproduce limited Phase 7 copy controls, but they do not reproduce the beta-wide BETA-04 registry, ID set, path scope, contextual-claim law, token contract, checksum coverage or complete test contract.

BETA-20 provides meaningful overlap:

- a six-ID Phase 7 copy registry;
- Phase 7 copy-reference enforcement;
- inline-copy rejection;
- limited forbidden-term rejection;
- allowed, inline and forbidden-language tests;
- a registered proof entrypoint;
- a guard-index entry.

The following BETA-04 protections remain unresolved:

- the 21-ID beta-wide baseline registry;
- beta-wide scope-path scanning;
- contextual personalised and avoidance claim phrases;
- the complete medical, protection, prevention and performance-language rule set;
- BETA-04 copy-specific failure tokens and structured report shape;
- direct checksum coverage;
- the contextual-claim test class.

## PR #764 disposition

**DO NOT MERGE DURING THIS ASSESSMENT**

This assessment does not authorise merging or closing PR #764. It also does not authorise declaring PR #764 fully superseded.

## Required follow-up

1. Create BETA-FIX-01 — Copy Registry Reconciliation.
2. Define one authoritative beta-wide copy registry and enforcement path.
3. Reconcile the required copy IDs, scope coverage, language rules, tokens, indexes, checksums and tests.
4. Resolve PR #764 only after the reconciliation proof is complete.

## Non-actions

- PR #764 was not merged.
- PR #764 was not closed.
- No branch was deleted.
- No copy law was activated or changed.
- No product, engine, runtime or registry behaviour was changed.

## Final verdict

**PARTIALLY_SUPERSEDED**
