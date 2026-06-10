# S31 — Pilot User Provisioning Pack

Status: v0 aligned  
Scope: founder/operator provisioning flow  
Invariant: coach + athlete access must be created explicitly with accepted link and no org/team/unit paths

## Target

Define the exact provisioning process for pilot coach and athlete access.

## Invariant

Provisioning must produce:
- coach account
- athlete account
- accepted coach↔athlete link
- valid v0 scope (no org/team/unit paths)

No inference  
No auto-linking  
No org hierarchy  
No messaging dependency  

---

# 1. Provisioning Sequence (Ordered, Deterministic)

## Step 1 — Create Coach Account

Required:
- email (unique)
- role = coach

Checks:
- account exists
- role correctly assigned
- account active

Failure:
→ STOP — coach_account_invalid

---

## Step 2 — Create Athlete Account

Required:
- email (unique)
- actor type valid for v0

Checks:
- account exists
- account active

Failure:
→ STOP — athlete_account_invalid

---

## Step 3 — Initiate Coach→Athlete Link

Required:
- coach_id
- athlete_id
- execution_scope = coach_managed

Checks:
- link created in pending state

Failure:
→ STOP — link_creation_failed

---

## Step 4 — Athlete Accepts Link

Required:
- explicit accept action

Checks:
- link state = accepted
- link not revoked

Failure:
→ HOLD — link_not_accepted

---

## Step 5 — Scope Validation

Required:
- execution_scope ∈ { individual, coach_managed }
- actor_type ∈ { athlete, coach }

Checks:
- no org/team/unit scope present
- no external authority injected

Failure:
→ STOP — scope_invalid

---

# 2. Proof Requirements

Provisioning is valid only if all artefacts exist:

- coach account record
- athlete account record
- link record
- link acceptance record
- scope validation record

If any artefact missing:
→ HOLD — provisioning_incomplete

---

# 3. Prohibited Paths

The following must not exist in provisioning:

- org creation
- team creation
- unit creation
- gym creation
- auto-assignment
- inferred relationships
- bulk import linking
- messaging-based linking

Any presence:
→ STOP — non_v0_path_detected

---

# 4. Provisioning Output

## SUCCESS

- coach account active
- athlete account active
- link accepted
- scope valid

→ Provisioning complete

## HOLD

- link pending
- artefact missing

→ Await completion

## STOP

- invalid account
- invalid link
- invalid scope
- prohibited path used

→ Abort provisioning

---

# 5. Blocked Reason Closed Set

- coach_account_invalid
- athlete_account_invalid
- link_creation_failed
- link_not_accepted
- scope_invalid
- provisioning_incomplete
- non_v0_path_detected

---

# 6. Final Rule

If the coach and athlete are not explicitly created and linked through accepted action, the relationship does not exist.

No link = no coach-managed execution.