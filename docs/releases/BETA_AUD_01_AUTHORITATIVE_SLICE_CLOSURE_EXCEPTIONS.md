# BETA-AUD-01 — Authoritative Slice Closure Exceptions

## Audit authority and boundary

This record audits BETA-00 through BETA-29 only. It records GitHub pull-request state, target branches, commit identities, check history, remote branch presence and git ancestry against the authoritative beta integration branch.

It does not repair, merge, close, supersede, delete, promote, tag or authorise any implementation.

## Executive result

All 30 required slice IDs and all 30 expected primary pull requests were found. Three additional pull requests were confirmed as the BETA-11 corrective chain. No unexpected BETA pull requests were found.

Twenty-nine implementations are present by git ancestry in the authoritative beta integration branch. BETA-04 is the single implementation absent by ancestry.

The beta slice chain cannot currently be described as fully closed because BETA-04 remains open and unmerged.

## Current beta integration identity

- Repository: `robertsc2049-bit/kolosseum`
- Authoritative branch: `beta/BETA-10-phase3-constraint-prune`
- Authoritative head: `771a52b9f74449e36b4333b438984f08d732c568`
- Main branch: `main`
- Main head observed during audit: `c607cc055690fc70c7e69d67a12620513fd0c7de`
- Audit date: `2026-07-16`

## Slice-status summary

- MERGED_COMPLETE: 28
- MERGED_COMPLETE_WITH_CORRECTIVE_PRS: 1
- OPEN_UNMERGED: 1
- CLOSED_UNMERGED: 0
- ABANDONED: 0
- SUPERSEDED: 0
- MISSING: 0
- DUPLICATED: 0
- UNVERIFIABLE: 0

Slice | Primary PR | Actual target | Check history | Remote branch | Integration presence | Final status | Related PRs
--- | --- | --- | --- | --- | --- | --- | ---
BETA-00 | #760 | main | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-01 | #761 | main | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-02 | #762 | main | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-03 | #763 | main | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-04 | #764 | main | ALL_SUCCESSFUL | EXISTS | NOT_PRESENT_BY_ANCESTRY | OPEN_UNMERGED | —
BETA-05 | #765 | main | ALL_SUCCESSFUL | EXISTS | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-06 | #766 | main | ALL_SUCCESSFUL | EXISTS | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-07 | #767 | main | ALL_SUCCESSFUL | EXISTS | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-08 | #768 | main | ALL_SUCCESSFUL | EXISTS | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-09 | #769 | main | ALL_SUCCESSFUL | EXISTS | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-10 | #770 | main | ALL_SUCCESSFUL | EXISTS | PRESENT_BY_FEATURE_ANCESTRY | MERGED_COMPLETE | —
BETA-11 | #771 | beta/BETA-10-phase3-constraint-prune | FAILURES_PRESENT | DELETED | PRESENT_BY_PRIMARY_AND_CORRECTIVE_ANCESTRY | MERGED_COMPLETE_WITH_CORRECTIVE_PRS | #772, #773, #774
BETA-12 | #775 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-13 | #776 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-14 | #777 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-15 | #778 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-16 | #779 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-17 | #780 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-18 | #781 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-19 | #782 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-20 | #783 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-21 | #784 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-22 | #785 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-23 | #786 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-24 | #787 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-25 | #788 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-26 | #789 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-27 | #790 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-28 | #791 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | DELETED | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —
BETA-29 | #792 | beta/BETA-10-phase3-constraint-prune | ALL_SUCCESSFUL | EXISTS | PRESENT_BY_MERGE_ANCESTRY | MERGED_COMPLETE | —

## Confirmed exceptions

### BETA-AUD-01-EX-001 — OPEN_UNMERGED_AND_ABSENT

Severity: **BLOCKER**

BETA-04 remains open and unmerged, and its implementation is not present by ancestry in the authoritative beta integration branch.

Evidence:
  - PR #764 is OPEN and merged=false.
  - Feature branch beta/BETA-04-copy-registry-baseline still exists remotely.
  - Implementation presence is NOT_PRESENT_BY_ANCESTRY.

Required follow-up: Run BETA-AUD-02 to assess current-state copy-control equivalence. Do not merge, close or classify PR #764 as superseded in this audit.

### BETA-AUD-01-EX-002 — MERGED_REMOTE_BRANCHES_RETAINED

Severity: **MINOR**

Several merged feature branches remain on origin after their pull requests were merged.

Evidence:
  - BETA-05: beta/BETA-05-phase1-schema-closure is EXISTS
  - BETA-06: beta/BETA-06-cl-gate-separation is EXISTS
  - BETA-07: beta/BETA-07-registry-loader-core is EXISTS
  - BETA-08: beta/BETA-08-registry-fk-enum-guard is EXISTS
  - BETA-09: beta/BETA-09-phase2-canonical-hash is EXISTS
  - BETA-29: beta/BETA-29-production-beta-rehearsal is EXISTS

Required follow-up: Review branch-retention requirements after BETA-04 reconciliation and beta promotion. No branches are deleted by this audit.

### BETA-AUD-01-EX-003 — CORRECTIVE_PR_CHAIN

Severity: **INFORMATIONAL**

BETA-11 primary PR #771 contains failed check history, but the final implementation includes three merged corrective PRs.

Evidence:
  - Primary PR #771 check classification is FAILURES_PRESENT.
  - Corrective PRs #772, #773 and #774 are merged.
  - Primary and all corrective changes are present by ancestry in the integration branch.

Required follow-up: Retain BETA-11 classification as MERGED_COMPLETE_WITH_CORRECTIVE_PRS. Do not classify the corrective PRs as duplicate implementations.

### BETA-AUD-01-EX-004 — INTENTIONALLY_RETAINED_INTEGRATION_BRANCH

Severity: **INFORMATIONAL**

The BETA-10 feature branch remains present because it is the authoritative beta integration branch.

Evidence:
  - Branch beta/BETA-10-phase3-constraint-prune is EXISTS.
  - The authoritative beta head is 771a52b9f74449e36b4333b438984f08d732c568.
  - BETA-10 is present by feature ancestry.

Required follow-up: Retain the branch until controlled beta-to-main promotion and ancestry verification are complete.

## Corrective PR chains

BETA-11 was delivered through primary PR #771 and the following corrective pull requests:

- #772 — BETA-11 CI entrypoint coverage fix; state MERGED; checks FAILURES_PRESENT; ancestry feature=true, merge=true.
- #773 — BETA-11 CI command-length fix; state MERGED; checks FAILURES_PRESENT; ancestry feature=true, merge=true.
- #774 — BETA-11 legacy Phase 4 routing fix; state MERGED; checks ALL_SUCCESSFUL; ancestry feature=true, merge=true.

PRs #772, #773 and #774 are corrective closure records. They are not duplicate independent implementations of BETA-11.

## Remote branch exceptions

The following merged feature branches remain present remotely:

- BETA-05: `beta/BETA-05-phase1-schema-closure`
- BETA-06: `beta/BETA-06-cl-gate-separation`
- BETA-07: `beta/BETA-07-registry-loader-core`
- BETA-08: `beta/BETA-08-registry-fk-enum-guard`
- BETA-09: `beta/BETA-09-phase2-canonical-hash`
- BETA-29: `beta/BETA-29-production-beta-rehearsal`

The BETA-10 branch is separately retained intentionally because it remains the authoritative beta integration branch.

The BETA-04 branch remains present because PR #764 is still open and unmerged.

## Implementation ancestry exceptions

BETA-04 is the only slice classified as `NOT_PRESENT_BY_ANCESTRY`.

BETA-AUD-01 does not map later copy-control work onto BETA-04. BETA-AUD-02 must determine whether the intended BETA-04 protections are fully, partially or not superseded by current-state implementation.

## Unverified evidence

The audit records GitHub `baseRefOid` as an observed target SHA only. It does not claim that value independently proves the target branch SHA at the exact time each pull request was created.

No pull-request check result was inferred from merge state. Historical check rollups were recorded directly.

## Required follow-up slices

1. BETA-AUD-02 — BETA-04 Copy-Control Equivalence Assessment.
2. A later controlled branch-cleanup action after BETA-04 reconciliation and beta-to-main promotion decisions.
3. Beta-to-main divergence and promotion assessment after the BETA-04 position is resolved.

## Non-actions

This audit:

- did not merge or close PR #764;
- did not declare BETA-04 superseded;
- did not delete any branch;
- did not promote the beta branch to main;
- did not create a release tag;
- did not make a GO or NO-GO decision;
- did not modify product, engine, runtime, registry, replay, evidence, copy or CI semantics.

## Final audit verdict

**AUDIT COMPLETE — EXCEPTIONS FOUND**
