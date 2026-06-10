# S6 — First-compile eligibility gate

Type: Engine  
Status: Draft  
Scope: v0 Deterministic Execution Alpha only  
Engine Compatibility: EB2-1.0.0  
Rewrite Policy: Rewrite-only

## Target

Define the exact conditions under which first compile may occur.

## Invariant

Compile cannot occur without accepted declarations and scope-valid inputs.

First compile is forbidden unless:

- a lawful Phase-1 declaration has been accepted
- the request remains inside active v0 actor, execution-scope, activity, and phase boundaries
- every compile-relevant input is explicit, schema-valid, and fully resolvable under closed-world registry law

No compile may occur on missing, inferred, corrected, defaulted, incompatible, or out-of-scope inputs.

## Why now

The current corpus is clear on Phase 1 being the sole lawful entry point and on v0 being restricted to individual_user and coach, individual and coach_managed, powerlifting / rugby_union / general_strength, and Phase 1-6 only.

What is still worth pinning explicitly is the first point at which compile becomes lawful in the active v0 slice.

This gate prevents:

- compile-before-acceptance drift
- soft handling of missing authority or scope fields
- product / payment / relationship metadata leaking into engine truth
- accidental widening into dormant org-managed or proof-layer paths

## Contract

### 1. Gate position

The first-compile eligibility gate sits after Phase 1 acceptance and before Phase 2 canonicalisation and hashing.

If Phase 1 has not accepted the payload, there is no lawful compile input.

### 2. Accepted declaration requirement

"Accepted declarations" means Phase 1 has returned validated verbatim input only.

This requires:

- no unknown fields
- no missing required fields
- no extra fields
- no defaults
- no inference
- no correction
- no partial acceptance

If Phase 1 fails, compile is forbidden.

### 3. Scope-valid input requirement

For current v0, first compile is lawful only when all of the following are true:

- actor_type is lawful for active v0
- execution_scope is lawful for active v0
- activity_id is lawful for active v0
- all compile-relevant IDs and conditional fields resolve exactly
- no excluded runtime, proof, org, team, unit, or gym path is being invoked

### 4. Active v0 boundary for this gate

The gate must enforce the active release fence:

- actor_type: athlete or coach only
- execution_scope: individual or coach_managed only
- activity_id: powerlifting, rugby_union, or general_strength only
- active shipping phases: Phase 1-6 only

Anything outside this fence is not compile-reachable in v0.

### 5. Conditional requirements

The gate must hard-fail on missing conditional prerequisites.

At minimum:

- if execution_scope = coach_managed, governing_authority_id is required
- if a role-specific goal is declared, sport_role_id must be present
- if equipment_profile_id is present, it must resolve
- if baseline metrics or linked exercise tokens are present, all referenced metric / activity / exercise links must resolve lawfully

No downgrade, substitution, inference, or silent omission is permitted.

### 6. Foreign-key and profile legality

Compile is lawful only if all compile-relevant references resolve under closed-world law.

This includes, where present:

- activity_id
- sport_role_id
- equipment_profile_id
- movement blacklists
- baseline metric IDs
- linked exercise token IDs
- any referenced allow-listed profile or constraint token

Unknown, mismatched, cross-sport, or out-of-context references make first compile illegal.

### 7. Non-engine metadata exclusion

The first-compile gate must not read, infer from, or branch on:

- payment state
- product tier
- commercial entitlement state
- coach notes
- presentation-only flags as control inputs
- relationship metadata beyond lawfully declared execution authority

These may affect visibility or access outside the engine, but they must not create compile legality.

### 8. Gate result

If and only if all prerequisites hold:

- Phase 1 is accepted
- first compile is lawful
- Phase 2 may begin

If any prerequisite fails:

- compile must not begin
- no Phase 2 artefact may be created
- no downstream phase may run
- there is no fallback path

## Proof

The slice is complete only when the following are covered by contract tests and negative tests.

### Positive proof

- accepted lawful individual payload compiles
- accepted lawful coach-managed payload compiles
- identical accepted inputs produce identical eligibility verdicts

### Negative proof

- missing consent -> compile forbidden
- unknown Phase-1 field -> compile forbidden
- missing required Phase-1 field -> compile forbidden
- invalid actor_type -> compile forbidden
- invalid execution_scope -> compile forbidden
- coach_managed without governing_authority_id -> compile forbidden
- unsupported activity_id -> compile forbidden
- unresolved equipment profile -> compile forbidden
- role goal without sport_role_id -> compile forbidden
- invalid movement blacklist semantics -> compile forbidden
- unresolved baseline metric / linked exercise token -> compile forbidden
- payment or entitlement state changes compile verdict -> system invalid

## Required tests

- `first_compile_gate_accepts_lawful_individual_v0_input`
- `first_compile_gate_accepts_lawful_coach_managed_v0_input`
- `first_compile_gate_rejects_when_phase1_not_accepted`
- `first_compile_gate_rejects_unknown_field`
- `first_compile_gate_rejects_missing_required_field`
- `first_compile_gate_rejects_invalid_actor_type`
- `first_compile_gate_rejects_invalid_execution_scope`
- `first_compile_gate_rejects_missing_governing_authority_for_coach_managed`
- `first_compile_gate_rejects_unsupported_activity`
- `first_compile_gate_rejects_unresolved_fk_input`
- `first_compile_gate_ignores_payment_and_tier_state`
- `first_compile_gate_is_deterministic_for_identical_inputs`

## Final rule

First compile may occur only after a verbatim accepted Phase-1 declaration exists and every compile-relevant input is lawful, explicit, resolved, and inside the active v0 boundary.

Otherwise compile is not permitted.
