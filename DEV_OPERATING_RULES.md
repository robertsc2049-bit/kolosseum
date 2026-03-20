# DEV OPERATING RULES

## Purpose
This document defines the mandatory operating rules for development inside the Kolosseum repo.

It is the default human working contract for:
- code
- tests
- docs
- CI
- branches
- pull requests
- release-bound changes
- access and offboarding-sensitive work

If a change violates this document, the slice is invalid and must not be merged.

---

## 1. Core operating principles

1. Ship vertical slices, not vague progress.
2. One slice must prove one boundary, one invariant group, or one ownership rule.
3. Prefer single-owner flows over duplicated plumbing.
4. Determinism beats convenience.
5. Engine authority is supreme. UI, API, docs, helpers, flags, billing, and presentation must not silently change engine truth.
6. Fail hard on contract breakage. No silent fallback where correctness matters.
7. Stabilize plumbing before adding complexity.
8. Use the smallest safe change that proves a real boundary.
9. Docs are part of the product surface and must stay aligned with current ship criteria.
10. Unknown is illegal. Inference is not permission.

---

## 2. Mandatory repo hygiene rules

- The working tree must be clean after standard workflows.
- Intended staged changes during work are allowed, but a finished slice must not leave repo dirt behind.
- Repo text files must be LF only.
- Repo text files must be UTF-8 without BOM.
- Do not use write patterns that introduce CRLF or BOM drift.
- Use a UTF-8 no BOM + LF writer helper for repo-authored text files.
- If `package-lock.json` changes, `LOCKFILE_CHANGE_NOTE.md` must also be added and staged, and it must be LF only.
- Do not leave disposable junk files in the repo root unless intentionally tracked.
- Do not commit generated noise unless the repo explicitly expects it.
- Do not bypass repo hygiene to get green.

### Consequence
Any hygiene violation makes the slice invalid until corrected.

---

## 3. Boundary ownership rules

### 3.1 Engine
The engine owns:
- canonical phase execution
- legality
- deterministic materialisation
- runtime truth capture
- engine-side invariants
- replay-coupled outputs

### 3.2 Server / transport
The server owns:
- transport
- auth wiring
- persistence orchestration
- API exposure

The server must not:
- inject engine behaviour
- reinterpret legality
- add fallback selection logic
- mutate canonical engine truth

### 3.3 UI / presentation
The UI owns:
- rendering
- user flow
- copy routing
- presentation-only preferences

The UI must not:
- add engine logic
- reinterpret truth
- infer missing declarations
- create advisory meaning
- silently change engine outputs

### 3.4 Docs
Docs may:
- describe
- constrain
- declare workflow
- define acceptance boundaries where authoritative

Docs must not:
- silently conflict with current release scope
- introduce hidden behavioural authority where they are subordinate
- drift from current canonical naming

### Consequence
Any cross-boundary leak makes the slice invalid and must be removed before merge.

---

## 4. Formal slice contract requirement

Every meaningful slice must define a contract before it is considered complete.

A slice contract must contain:

### 4.1 Slice name
A clear name for the boundary being proved.

### 4.2 Purpose
What this slice exists to prove.

### 4.3 Inputs
The exact input surfaces touched by the slice.

Examples:
- API route
- phase output
- registry payload
- CI script
- doc authority surface
- runtime event stream

### 4.4 Outputs
The exact outputs or guarantees established by the slice.

### 4.5 Named invariants
Every slice must include named invariants.

Examples:
- no resurrection after terminal state
- no phase-order drift
- no hidden mutation after return decision
- no authority leak across boundary

### 4.6 Failure modes
State what must fail if the invariant is broken.

### 4.7 Linked proof
Each invariant must be linked to tests, checks, or CI coverage proving it.

No linked proof = incomplete slice.

### Consequence
A change without a clear slice contract is not complete work and must not be merged.

---

## 5. Branching and scope rules

- Start from `main`.
- Pull fast-forward only before beginning work.
- Create one dedicated ticket branch per slice.
- Avoid unrelated edits on the same branch.
- Prefer grouped slices only when the grouped scope is truly one contract.
- Branch names should describe the boundary or proof being added.

### Default branch style
- `ticket/<scope>-<contract>-<intent>`

### Commit message rule
Commit messages must state the proof, boundary, or invariant being added.
Do not use vague activity language.

Bad:
- update files
- fix stuff
- more docs

Good:
- docs: add operating rules, repo boundary map, PR checklist, and access/offboarding controls
- test(v0): prove split-return preserves terminal-state shape after downstream reads

---

## 6. Standard local workflow

### Start
1. `git switch main`
2. `git pull --ff-only`
3. create a fresh ticket branch

### During work
1. write repo text with LF + UTF-8 no BOM
2. stage intended changes only
3. keep scope tight
4. keep the slice contract visible while working
5. keep authority boundaries intact

### Required local checks before commit/push
1. `npm run lint:fast`
2. `npm run test:unit`
3. `npm run build:fast`

If a stronger slice-specific command exists, run that too.

### PR and merge flow
1. commit only intended files
2. push branch
3. create PR
4. review PR diff for scope drift
5. check PR status
6. merge only when checks are green and scope is still correct
7. use admin merge only when branch protection blocks the normal path after checks are green
8. switch back to `main`
9. `git pull --ff-only`
10. `npm run dev:status`

### Non-blocking CI visibility after push or merge
Use status commands that return, not indefinite watch commands, unless you explicitly want to wait.

Preferred:
1. `gh pr checks`
2. `gh run list --limit 10`

Optional waiting commands:
- `gh pr checks --watch`
- `gh run watch`

Do not make a hanging watch command the default final step in written workflow docs.

### Consequence
If required checks are skipped, the slice is incomplete and must not be merged.

---

## 7. Required PowerShell command style

All PowerShell command blocks must start with:

    Set-Location C:\Users\rober\kolosseum
    $ErrorActionPreference = "Stop"

Use full copy-paste-ready commands.
Do not use placeholder paths.
Do not assume manual editing in the middle of a workflow unless explicitly stated.

---

## 8. CI coupling rules

The repo must treat CI as binding, not advisory.

- CI failure means the slice is not mergeable.
- A green local run does not overrule CI.
- A green PR with scope drift still requires human rejection.
- If CI proves a contradiction with docs or code, the contradiction must be resolved before merge.
- No waiver-based culture for core engine, registry, CI, replay, or release-boundary work.

### PR coupling
Every PR must be able to answer:
- What boundary is being changed?
- What invariant is being proved?
- What tests prove it?
- What authority surface is touched?
- What is explicitly out of scope?

If the PR cannot answer those clearly, it is not ready.

---

## 9. Release-scope discipline

Current release naming and scope must stay aligned with the active v0 definition.

- v0 means Deterministic Execution Alpha only.
- Do not silently treat v1/proof-layer work as current v0 completion.
- Do not let broader dormant platform law be mistaken for current shipping reachability.
- If an older document is broader than current release scope, it must be fenced, relabelled, or demoted clearly.

### Consequence
Any scope leak that makes dormant work look current is a release-boundary defect.

---

## 10. Forbidden development behaviours

The following behaviours are forbidden:

- adding fallback behaviour to get green
- relaxing constraints without explicit authority
- silent defaults in engine-relevant paths
- mixing product/payment state into engine truth
- softening hard-fail boundaries
- speculative scaffolding inside current shipping path
- duplicate owners for the same standard workflow
- temporary bypass logic with no explicit kill plan
- vague slices that touch many boundaries without one proving contract

### Consequence
These behaviours invalidate the slice and require rewrite or rollback.

---

## 11. Minimum artefacts for future maintainability

For repo health and onboarding, the repo should maintain and keep aligned:

- `DEV_OPERATING_RULES.md`
- `REPO_BOUNDARY_MAP.md`
- `PR_CHECKLIST.md`
- `ACCESS_AND_OFFBOARDING.md`

These are operational control surfaces for:
- future developers
- reviewers
- contractors
- access changes
- branch discipline
- merge discipline
- safe offboarding

---

## 12. Decision rule when in doubt

If behaviour is unclear:

1. stop
2. identify the authority surface
3. check current release scope
4. define the slice contract
5. prove the invariant with tests or CI
6. only then merge

Do not:
- infer
- soften
- guess
- patch around uncertainty
- ship ambiguity because it feels usable

Correct beats convenient.

---

## 13. Final rule

A slice is valid only if all of the following are true:

- scope is clear
- ownership boundary is clear
- invariants are named
- tests or checks prove them
- repo hygiene is clean
- CI is green
- release scope is not leaked
- no forbidden behaviour was introduced

If any of the above is false:
the slice is incomplete,
the PR is not ready,
and the change must not be merged.
