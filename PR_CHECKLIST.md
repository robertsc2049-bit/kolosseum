# PR CHECKLIST

## Purpose
This checklist is mandatory for every Kolosseum pull request.

It exists to prevent:
- scope drift
- hidden authority leakage
- weak proofs
- merge-ready-looking PRs that are not actually safe

A PR that cannot answer this checklist clearly is not ready.

---

## 1. PR identity

### Required
- PR title states the proof, boundary, or invariant being added
- branch name describes the slice accurately
- PR scope is one contract or one tightly grouped contract set
- out-of-scope items are stated explicitly

### Fail conditions
- vague title
- vague branch name
- mixed unrelated work
- hidden opportunistic edits

---

## 2. Slice contract

### Required
State all of the following in the PR body:

- slice name
- purpose
- touched inputs
- touched outputs
- named invariants
- failure modes
- linked proof

### Minimum questions the PR must answer
- What boundary is changing?
- What invariant is being proved?
- What would fail if this invariant breaks?
- Which tests or checks prove the boundary?

### Fail conditions
- “small cleanup” with no contract
- no invariants named
- no linked proof
- outcome described without actual boundary statement

---

## 3. Scope control

### Confirm
- change stays inside intended slice
- unrelated churn was removed
- docs changed only where needed
- no speculative future scaffolding entered the current shipping path
- release scope remains honest

### Fail conditions
- opportunistic extras
- accidental refactors outside slice
- dormant v1/proof-layer work made to look active in v0
- “while I was here” edits with no proof value

---

## 4. Boundary safety

### Confirm
- engine authority stayed in engine surfaces
- server did not inject behaviour
- UI did not alter truth
- payment / tier state did not affect execution truth
- notes, presentation flags, or convenience helpers did not leak into engine behaviour

### Fail conditions
- any non-engine surface can change engine output
- any cross-boundary leak exists
- docs now imply broader authority than allowed

---

## 5. Repo hygiene

### Confirm
- working tree is clean after finishing
- text files are LF only
- text files are UTF-8 without BOM
- no junk files were left behind
- if `package-lock.json` changed, `LOCKFILE_CHANGE_NOTE.md` was added and staged

### Fail conditions
- dirty tree after normal workflow
- CRLF / BOM drift
- disposable files added accidentally
- lockfile changed without note

---

## 6. Required local checks

### Must run
- `npm run lint:fast`
- `npm run test:unit`
- `npm run build:fast`

### Also run when relevant
- slice-specific checks
- replay / fixture checks
- validation scripts tied to touched contract surfaces

### Fail conditions
- skipped required checks
- only partial checks run
- “CI will catch it” used as excuse for not validating locally

---

## 7. CI status

### Confirm
- PR checks are green
- no core failure is being waved through
- failure output was resolved, not rationalised away
- CI scope matches what the PR claims to prove

### Fail conditions
- red CI
- ignored CI contradictions
- merge attempted on “probably fine”
- PR claims stronger proof than CI actually provides

---

## 8. Replay / determinism honesty

### Confirm when relevant
- replay claims stay within actual proven scope
- no proof-layer language appears beyond what current slice truly proves
- deterministic claims match actual verification coverage

### Fail conditions
- replay wording too strong
- evidence/proof language used dishonestly
- deterministic claim not backed by actual checks

---

## 9. Docs alignment

### Confirm
- docs updated where release scope, workflow, or authority changed
- dormant broader material remains fenced if needed
- naming is aligned with current v0 definition
- no document silently widens current ship criteria

### Fail conditions
- doc drift
- stale naming
- contradictory workflow docs
- broader platform law now reads like current v0 reachability

---

## 10. Reviewer questions

Reviewer must be able to answer yes to all:

- Do I understand the boundary this PR changes?
- Do I understand what must remain untouched?
- Are the invariants explicit?
- Is there enough proof?
- Is the release scope still honest?
- Is the repo cleaner or at least not worse after this PR?

If any answer is no, reject or request changes.

---

## 11. Merge rule

A PR may be merged only if:
- the contract is clear
- scope is controlled
- required checks passed
- CI is green
- release scope is still honest
- no forbidden boundary leakage exists

Admin merge is allowed only when branch protection blocks the normal path after checks are green.
Admin merge is not permission to skip discipline.

---

## 12. Final statement for PR body

Use this structure in plain English:

- Boundary changed:
- Invariants proved:
- Inputs touched:
- Outputs touched:
- Tests/checks run:
- Out of scope:
- Risks checked:
- Why this is safe to merge:

If you cannot fill that in clearly, the PR is not ready.
