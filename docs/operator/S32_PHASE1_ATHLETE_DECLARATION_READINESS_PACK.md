# S32 — Phase 1 Athlete Declaration Readiness Pack

Status: v0 aligned  
Scope: pre-execution athlete declaration completion  
Invariant: athlete cannot reach execution until Phase 1 is present, complete, valid, and explicitly accepted

## Target

Define the exact pre-execution declaration completion guide for pilot athletes.

## Invariant

Execution must remain blocked until the athlete has a valid accepted Phase 1 declaration.

No inference  
No defaults  
No partial acceptance  
No coach completion on athlete behalf  
No org/team/unit path  

---

# 1. Declaration Status Model

## NOT_STARTED

Meaning:
- no Phase 1 declaration exists

Execution:
- blocked

Operator label:
- Phase 1 declaration not started

Blocked reason:
- phase1_not_started

---

## IN_PROGRESS

Meaning:
- declaration exists but required fields are incomplete

Execution:
- blocked

Operator label:
- Phase 1 declaration incomplete

Blocked reason:
- phase1_incomplete

---

## INVALID

Meaning:
- declaration contains invalid value, unknown field, missing required field, invalid enum, invalid activity, or invalid scope

Execution:
- blocked

Operator label:
- Phase 1 declaration invalid

Blocked reason:
- phase1_invalid

---

## ACCEPTED

Meaning:
- declaration is complete
- consent_granted = true
- required fields present
- no unknown fields
- actor type valid
- execution scope valid
- activity valid
- presentation flags valid and engine-inert

Execution:
- permitted to compile

Operator label:
- Phase 1 declaration accepted

Blocked reason:
- null

---

## NOT_ACCEPTED

Meaning:
- declaration was completed but not accepted
- consent not granted
- athlete has not confirmed declaration

Execution:
- blocked

Operator label:
- Phase 1 declaration not accepted

Blocked reason:
- phase1_not_accepted

---

# 2. Required Fields Checklist

Phase 1 readiness requires all mandatory fields for the v0 declaration path.

## Legal Prerequisites

Required:
- consent_granted = true
- age_declaration present
- jurisdiction_acknowledged = true

If any fail:
→ INVALID or NOT_ACCEPTED

## Version Pins

Required:
- engine_version present
- enum_bundle_version present
- phase1_schema_version present

If any mismatch:
→ INVALID

## Actor and Scope

Required:
- actor_type valid for v0
- execution_scope valid for v0

Allowed v0 actor/scope:
- athlete / individual_user surface
- coach only where explicitly permitted
- individual
- coach_managed

Forbidden:
- org_admin
- team_admin
- unit_admin
- gym_admin
- org_managed
- team_managed
- unit_managed
- gym_managed

If forbidden value appears:
→ INVALID

## Activity

Required:
- activity_id present
- activity_id valid for v0

Allowed v0 activities:
- powerlifting
- rugby_union
- general_strength

If absent or outside v0:
→ INVALID

## Environment

Required:
- location_type present
- equipment profile present if declared
- equipment profile resolvable if declared

If invalid:
→ INVALID

## Presentation Flags

Required:
- nd_mode present
- instruction_density present
- exposure_prompt_density present
- bias_mode present

Rule:
- presentation flags must not alter engine output

If missing or invalid:
→ INVALID

---

# 3. Blocked States

## phase1_not_started

Use when:
- no declaration record exists

Next action:
- athlete must begin declaration

## phase1_incomplete

Use when:
- declaration exists
- one or more required fields are missing

Next action:
- athlete must complete missing fields

## phase1_invalid

Use when:
- unknown field present
- invalid enum present
- invalid actor type present
- invalid execution scope present
- invalid activity present
- version mismatch present
- invalid equipment reference present
- invalid presentation flag present

Next action:
- declaration must be corrected before acceptance

## phase1_not_accepted

Use when:
- declaration is complete but not accepted
- consent_granted is false, null, or missing
- athlete has not confirmed declaration

Next action:
- athlete must explicitly accept the declaration

## phase1_revoked

Use when:
- previously accepted declaration has been revoked

Next action:
- execution remains blocked until a new accepted declaration exists

---

# 4. Accepted / Not Accepted Gate

## Accepted

Accepted requires:

- required fields complete
- values valid
- consent_granted = true
- no unknown fields
- no forbidden v0 scope
- athlete confirmation recorded

Result:
- compile may proceed

## Not Accepted

Not accepted includes:

- missing consent
- false consent
- null consent
- incomplete declaration
- athlete has not confirmed declaration
- revoked declaration

Result:
- compile must not proceed

---

# 5. Coach Boundary

Coach may view declaration readiness status only if the coach-athlete link is accepted.

Coach must not:
- complete Phase 1 for the athlete
- edit athlete declaration
- accept declaration for athlete
- override blocked state
- change consent
- inject missing fields

Coach may:
- see factual status
- see blocked reason
- tell athlete declaration is incomplete using allowed factual wording

---

# 6. Operator Output

## READY_FOR_COMPILE

Required:
- Phase 1 status = ACCEPTED
- blocked_reason = null

Meaning:
- athlete declaration is ready for first compile

## BLOCKED

Required:
- Phase 1 status is NOT_STARTED, IN_PROGRESS, INVALID, NOT_ACCEPTED, or revoked
- blocked_reason populated

Meaning:
- execution must not begin

---

# 7. Operator Wording

Allowed:
- Phase 1 declaration not started.
- Phase 1 declaration incomplete.
- Phase 1 declaration invalid.
- Phase 1 declaration not accepted.
- Phase 1 declaration accepted.
- Execution is blocked until Phase 1 is accepted.

Forbidden:
- ready
- suitable
- safe
- recommended
- corrected
- optimised
- approved
- cleared
- compliant

---

# 8. Closed Blocked Reason Set

- phase1_not_started
- phase1_incomplete
- phase1_invalid
- phase1_not_accepted
- phase1_revoked

---

# 9. Proof Requirements

This pack is valid only if it proves:

- required fields are listed
- blocked states are closed
- accepted status is defined
- not accepted status is defined
- coach cannot complete or override athlete declaration
- no org/team/unit path exists

---

# 10. Final Rule

If Phase 1 is not accepted, execution does not exist.

No accepted declaration.  
No compile.  
No session.