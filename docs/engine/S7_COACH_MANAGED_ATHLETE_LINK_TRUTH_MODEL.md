# S7 — Coach-managed athlete link truth model

**Type:** Engine boundary
**Status:** Draft
**Scope:** v0 Deterministic Execution Alpha
**Release Applicability:** v0 Deterministic Execution Alpha
**Owner:** Founder / Product / Engine
**Engine Compatibility:** EB2-1.0.0
**Rewrite Policy:** Rewrite-only

---

## Target

Formalise coach-athlete link creation, acceptance, revocation, and scope validity for lawful coach-managed execution.

## Invariant

Coach-managed execution cannot exist without an explicit valid link.

## Why now

The active v0 build allows only `individual_user` and `coach` actors, and only `individual` and `coach_managed` execution scopes. Coach-managed execution already requires explicit authority at declaration time, but the meaning of that authority must be pinned to an explicit coach-athlete link so the platform and engine boundary stays deterministic, closed-world, and non-inferential.

Without this rule, coach-managed execution can drift into implied relationship logic, hidden visibility grants, or soft product-side authority that is not lawful engine truth.

---

## Scope lock

This slice applies only to current v0:

- actors: `individual_user`, `coach`
- execution scopes: `individual`, `coach_managed`
- activities: `powerlifting`, `rugby_union`, `general_strength`
- phases: active v0 path only
- broader organisation, team, unit, gym, federation, and other dormant platform runtime are out of scope

This slice does **not** create organisation runtime, PAH hierarchy, team ownership, or broader delegated authority.

---

## Core rule

A coach-managed run is lawful only when:

1. the acting coach and subject athlete are bound by an explicit link record
2. that link has been accepted
3. that link has not been revoked
4. the run declares that link explicitly via `governing_authority_id`
5. the declared link resolves to the same acting coach and the same subject athlete

If any of the above is false, coach-managed execution must not occur.

---

## Boundary model

### Platform truth layer

The coach-athlete link record exists outside the engine truth model.

It is a platform-owned relationship record used only to determine whether coach-managed execution is lawfully permitted to start and whether coach visibility is within granted scope.

The platform may create, accept, and revoke links.

The platform must not use link metadata to alter legality, enumeration, substitution, progression, or deterministic output beyond lawful admission or refusal of coach-managed execution.

### Engine gate layer

The engine does not own relationship state.

The engine only receives a declaration for `execution_scope = coach_managed` and a `governing_authority_id`.

For v0, `governing_authority_id` must mean exactly one accepted, non-revoked coach-athlete link record between the acting coach and the subject athlete.

The engine must not infer links.
The engine must not discover links.
The engine must not repair invalid links.
The engine must not continue on best effort.

---

## Canonical link state contract

### Closed state set

`link_state` is a closed set:

- `invited`
- `accepted`
- `revoked`

No other states exist in v0.

### Canonical record

    type CoachAthleteLink = {
      link_id: string
      coach_id: string
      athlete_id: string
      link_state: "invited" | "accepted" | "revoked"
      created_at: string
      accepted_at: string | null
      revoked_at: string | null
      revoked_by_user_id: string | null
    }

### State rules

#### invited

The link record exists but is not yet valid for coach-managed execution.

#### accepted

The link is valid for coach-managed execution if:

- `coach_id` matches the acting coach
- `athlete_id` matches the subject athlete
- `revoked_at` is `null`

#### revoked

The link is not valid for new coach-managed execution.

Revocation is terminal for that link record.
A revoked link must not return to `accepted`.
A new relationship requires a new link record.

---

## Validity rule

A link is **valid** only when all of the following are true:

- `link_state = accepted`
- `accepted_at` is non-null
- `revoked_at = null`
- `coach_id` equals the acting coach id
- `athlete_id` equals the subject athlete id

Anything else is invalid.

---

## Phase-1 declaration binding

For current v0:

- `execution_scope = individual` does not require a coach-athlete link
- `execution_scope = coach_managed` requires `governing_authority_id`

For coach-managed execution, `governing_authority_id` must resolve to a valid coach-athlete link record exactly as defined in this document.

### Hard rules

- missing `governing_authority_id` for coach-managed execution -> fail
- unknown `governing_authority_id` -> fail
- `governing_authority_id` that resolves to `invited` -> fail
- `governing_authority_id` that resolves to `revoked` -> fail
- `governing_authority_id` that resolves to a different coach -> fail
- `governing_authority_id` that resolves to a different athlete -> fail

---

## Failure semantics

This slice does not create soft failures.

### Use existing failure domain where possible

- missing `governing_authority_id` for coach-managed execution -> `missing_governing_authority`
- present but invalid / unknown / mismatched / invited / revoked link -> `scope_violation`

No advisory text.
No silent downgrade to individual execution.
No inferred relationship fallback.

---

## Visibility boundary

A valid accepted link may permit the coach to access only the already-allowed v0 coach surfaces for that athlete:

- assignment within system limits
- factual execution artefact viewing
- factual history counts
- non-binding coach notes

A link does **not** grant authority to:

- override engine decisions
- alter legality
- trigger substitutions directly
- edit Phase-1 declarations
- rewrite historical truth
- view unlinked athletes
- create wider org-level visibility

---

## Revocation semantics

Revocation has immediate forward effect only.

### On revocation

- any new coach-managed execution using that link must fail
- any new coach visibility grant based on that link must be refused

### Revocation must not

- rewrite historical execution artefacts
- mutate prior accepted Phase-1 declarations
- change historical factual truth
- reclassify prior lawful runs as if they never happened

Historical retention and post-relationship visibility policy remain platform concerns and do not alter engine truth.

---

## Determinism and engine purity rules

Link truth is admission metadata only.

The following are forbidden:

- reading link metadata during enumeration
- branching substitution logic on link state
- branching progression logic on link state
- using commercial tier or payment state to validate a link
- using coach notes or platform metadata to infer acceptance
- auto-linking a coach and athlete because prior sessions exist
- continuing a coach-managed run after invalid admission on best effort

The engine remains a deterministic library:
canonical JSON in, canonical JSON out.

---

## Minimal implementation shape

### Platform-owned functions

- create link invite
- accept link invite
- revoke accepted link
- resolve link by `link_id`

### Engine admission gate

Before permitting `coach_managed` execution, validate:

1. `governing_authority_id` exists
2. the resolved record exists
3. the resolved record is `accepted`
4. `revoked_at` is null
5. `coach_id` matches acting coach
6. `athlete_id` matches subject athlete

Only then may coach-managed execution proceed.

---

## Proof

### Contract tests

1. create invite -> record exists with `link_state = invited`
2. accept invite -> same record becomes `accepted`
3. revoke accepted link -> same record becomes `revoked`
4. invited link cannot be used for coach-managed execution
5. revoked link cannot be used for coach-managed execution
6. revoked link cannot transition back to accepted
7. a new relationship after revocation requires a new `link_id`

### Engine gate tests

1. coach-managed + accepted matching link -> pass
2. coach-managed + missing `governing_authority_id` -> fail `missing_governing_authority`
3. coach-managed + unknown `governing_authority_id` -> fail `scope_violation`
4. coach-managed + invited link -> fail `scope_violation`
5. coach-managed + revoked link -> fail `scope_violation`
6. coach-managed + link for different athlete -> fail `scope_violation`
7. coach-managed + link for different coach -> fail `scope_violation`

### Boundary tests

1. link metadata does not enter canonical engine truth except declared `governing_authority_id`
2. link state does not alter Phase 3-6 outputs other than lawful admission or refusal
3. payment or product tier cannot turn an invalid link into a valid one
4. coach notes cannot be read as authority evidence
5. historical artefacts remain factual after revocation

---

## Final rule

Coach-managed execution is lawful only when a declared `governing_authority_id` resolves to one explicit, accepted, non-revoked coach-athlete link between the acting coach and the subject athlete.

If no such link exists, coach-managed execution must not occur.
