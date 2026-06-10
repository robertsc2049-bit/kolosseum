<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# SENIOR_DEVELOPER_REVIEW_CHECKLIST

Document class: developer review checklist
Status: working reference
Authority: non-canonical, engine-inert
Scope: pull request and slice review discipline
Does not define: engine behaviour, CI authority, legal authority, registry data, release scope, replay, evidence, or runtime execution logic

## 1. Purpose

This checklist defines how a senior developer should review a Kolosseum change.

It is designed to help newer developers avoid common mistakes while keeping the repo strict, deterministic, and commercially defensible.

## 2. First-pass review

Before reading code deeply, answer:

- What is the purpose of this change?
- What files changed?
- Is this engine, platform, docs, CI, registry, product, or UI?
- Is the scope narrow enough?
- Is this inside current v0?
- Is anything being smuggled in under a vague name?
- Does the PR description explain what was not changed?

If the change is unclear, the PR is not ready.

## 3. Boundary review

Check whether the change claims or implies any of the following without authority:

- Phase 7
- Phase 8
- evidence sealing
- exportable proof
- organisation runtime
- team runtime
- gym runtime
- analytics
- rankings
- predictive readiness
- medical meaning
- safety meaning
- optimisation
- guaranteed outcomes
- suitability judgement
- autonomous coaching authority

If yes, block or revise.

## 4. Engine impact review

Ask:

- Does this change engine output?
- Does it change Phase 1 to Phase 6 behaviour?
- Does it change CLI output?
- Does it change notes strings?
- Does it change session shape?
- Does it change deterministic ordering?
- Does it change registry-derived output?
- Does it change golden hashes?

If yes, treat it as a contract-sensitive change.

Contract-sensitive changes require clear explanation and intentional fixture/golden handling.

## 5. Platform impact review

Ask:

- Does this add a role or permission?
- Does this change visibility?
- Does this change storage?
- Does this create an operator workflow?
- Does this create public copy?
- Does this expose a new surface?
- Does this create a new source of truth?

Platform changes must not mutate engine truth unless explicitly designed and authorised.

## 6. Docs review

Ask:

- Does the document state its authority level?
- Does it say what it does not define?
- Does it accidentally create engine capability?
- Does it accidentally expand v0?
- Does it use future-platform language as current product language?
- Does it conflict with `CURRENT_PROJECT_DOCS_STATUS.md`?
- Does it require `V0_SURFACE_INDEX.md` to be updated?

Good docs reduce ambiguity.

Bad docs create scope creep.

## 7. Copy and claim review

Block unsupported language such as:

- safe
- safer
- safety
- injury prevention
- reduce risk
- rehab
- treatment
- medical
- clinical
- optimised
- optimal
- best for you
- tailored to you
- guaranteed progress
- proven results
- ready to train
- performance prediction
- readiness certification

Prefer factual wording:

- recorded
- submitted
- declared
- available
- unavailable
- review required
- blocked
- accepted
- source missing
- status updated

## 8. Test review

Ask:

- Is there a test for the changed behaviour?
- Is there a negative test?
- Is unknown input rejected?
- Is fail-closed behaviour proven?
- Is determinism proven where relevant?
- Are permissions tested?
- Are boundary claims tested?
- Are affected tests wired into CI?
- Did the PR rely only on local green without PR green?

If no tests are needed, the PR should explain why.

## 9. Guard review

Ask:

- Does this need a guard?
- Does this modify guard behaviour?
- Does this weaken a guard?
- Does this bypass a guard?
- Does this add a new class of drift that should be machine-checked?

Do not accept manual discipline where a guard is clearly needed.

## 10. Registry review

For registry changes, ask:

- Is the registry closed-world?
- Are unknown values rejected?
- Is ordering deterministic?
- Is schema validation present?
- Are aliases explicit?
- Are no defaults or inference being introduced?
- Are values being added for real product need or speculative future scope?

Registry changes are high-risk.

## 11. File hygiene review

Check:

- UTF-8 without BOM
- LF-only line endings
- no mojibake
- no accidental binary files
- no generated junk
- no untracked files
- no unintended lockfile change
- clean working tree after commit

The guards should enforce most of this, but reviewers should still notice obvious drift.

## 12. PR quality review

A good PR includes:

- clear title
- clear summary
- changed files
- engine impact statement
- validation run
- explicit non-goals
- v0 boundary statement if relevant

A weak PR includes:

- vague title
- "updates docs"
- "fixes stuff"
- no validation
- no boundary statement
- no explanation of risk

## 13. Merge review

Before merge:

- PR checks must be green or intentionally admin-merged for a known branch-protection-only block
- no failing checks
- no unresolved scope concern
- no unexplained contract change
- no known file hygiene issue
- branch should be deleted after merge
- local main should be synced after merge

## 14. Reviewer decision

Use these outcomes:

Approve:
The change is scoped, tested, guarded where needed, documented, and inside boundary.

Request changes:
The change is useful but has fixable issues.

Block:
The change expands scope, weakens guardrails, makes unsupported claims, changes engine behaviour accidentally, or creates unclear authority.

## 15. Final rule

A senior developer protects the system from unclear work.

Do not reward speed if it creates drift.

Small, explicit, tested, guarded changes win.
