# P180 - First Paid Pilot Setup Checklist

Status: draft  
Audience: founder / operator  
Purpose: configure one real paid pilot coach safely within current v0 limits

---

## 1. Pilot boundary lock

This pilot must stay inside the current v0 fence.

Allowed:
- actor types: `individual_user`, `coach`
- execution scopes: `individual`, `coach_managed`
- activities: `powerlifting`, `rugby_union`, `general_strength`
- product surfaces:
  - Phase 1 onboarding forms
  - session execution UI
  - split / return
  - partial completion
  - coach assignment
  - factual artefact viewing
  - non-binding coach notes
  - history counts only

Not allowed:
- org / team / unit / gym runtime
- dashboards
- analytics
- rankings
- messaging
- readiness scoring
- outcome evaluation
- evidence sealing
- export / proof packaging

**Hard rule:** if the pilot sale, onboarding, or delivery needs anything outside this list, stop. The pilot is not v0-safe.

---

## 2. Commercial package lock

Use one coach package only.

Pilot commercial shape:
- one paid coach
- tier: `coach_16`
- up to 16 athletes maximum
- one activity lane only for the first pilot
- no team or organisation packaging

Commercial rule:
- payment controls access only
- payment must not alter engine behaviour
- payment must not alter legality
- payment must not alter outputs
- payment must not imply extra authority

Operator actions:
- create one coach account
- mark coach as active paid pilot coach
- attach coach to the `coach_16` commercial tier
- keep all commercial wording literal and bounded

Fail the setup if:
- the coach needs more than 16 athletes now
- the sale depends on team / club / org features
- payment state changes execution behaviour
- pricing copy implies broader platform capability

---

## 3. Coach authority lock

The pilot coach is bounded.

Coach may:
- assign programs within implemented limits
- view factual athlete execution artefacts
- write non-binding coach notes

Coach may not:
- override engine decisions
- edit registries
- alter legality
- change constraints silently
- trigger hidden substitutions outside lawful product flow
- change athlete truth by note text
- act as organisation runtime authority

Operator actions:
- enable coach assignment
- enable artefact viewing
- enable non-binding note entry
- keep notes observational only
- ensure notes do not feed engine truth or output generation

Fail the setup if:
- coach notes affect execution
- coach can bypass constraints
- coach can modify athlete truth without a new lawful declaration
- coach surface behaves like supervision, compliance, or command tooling

---

## 4. Athlete roster lock

Keep the first paid pilot small and real.

Recommended first pilot roster:
- 1 coach
- 3 to 8 athletes
- 1 activity lane
- 1 clear use case

Do not build fake hierarchy.

Operator actions:
- create real athlete accounts as individual users
- explicitly link each athlete to the pilot coach
- do not create club / team / unit / org runtime structure for this pilot
- keep every relationship explicit and auditable

Fail the setup if:
- the pilot needs attendance capture
- the pilot needs shared team execution
- the pilot needs group scheduling logic
- the pilot needs org reporting to function

---

## 5. Activity lock

Pick one activity only for the first pilot.

Preferred order:
1. `powerlifting`
2. `general_strength`
3. `rugby_union` only if that is the real paying use case

Operator actions:
- lock the pilot to one activity in setup
- keep onboarding, test data, and execution inside that lane
- reject mixed-activity delivery in the first paid pilot

Fail the setup if:
- the coach wants multi-sport from day one
- the coach needs an unsupported activity
- the coach needs broader sport-role or organisation workflow beyond v0

---

## 6. Phase 1 onboarding gate

Every athlete must enter through lawful Phase 1 only.

Required behaviour:
- no inference
- no defaults
- no unknown fields
- consent must be explicit
- activity must be declared
- execution scope must be declared
- coach-managed setup must include governing authority
- presentation flags must be valid
- equipment / context must be explicit if used

Operator actions per athlete:
- complete onboarding through the implemented Phase 1 flow
- set valid actor and execution scope
- set one allowed activity
- set required consent fields
- set governing authority when coach-managed
- set only declared equipment / context truth
- save only if the declaration is valid as entered

Fail the setup if:
- onboarding captures undeclared fields
- consent is missing or false
- coach-managed flow omits governing authority
- the system infers anything
- the system "helps" by filling missing truth

---

## 7. Equipment and environment truth lock

Use only explicit declared equipment and environment truth.

Operator actions:
- record actual available equipment only
- keep athlete and coach setup aligned to real facility reality
- ensure session compilation is based on declared availability only
- do not assume access to undeclared hardware

Fail the setup if:
- the coach expects the system to guess missing equipment
- the pilot depends on undeclared facility capability
- the product silently substitutes around missing setup without lawful support

---

## 8. Program assignment check

Program assignment is allowed. Hidden coaching authority is not.

Operator actions:
- assign a lawful program through the coach surface
- keep assignment within one allowed activity lane
- keep assignment inside current v0 capabilities
- ensure the assigned athlete can execute the result through the existing flow

Fail the setup if:
- assignment requires manual hidden rules
- assignment depends on out-of-band edits
- coach assignment modifies engine truth beyond implemented boundaries

---

## 9. End-to-end execution proof before charging

Run one full real path before treating the pilot as live revenue.

Required proof path on at least one athlete:
1. athlete completes onboarding
2. coach relationship is active
3. coach assigns program
4. athlete receives executable session
5. athlete starts session
6. athlete completes at least one step normally
7. athlete uses split / return once
8. athlete records partial completion once
9. coach can view factual artefact
10. coach writes one non-binding note
11. athlete history updates with counts only

Operator actions:
- run the full path yourself
- confirm every screen is factual and bounded
- confirm no step leaks into unsupported surfaces
- confirm the result is repeatable on a second athlete

Fail the setup if:
- split / return fails
- partial completion fails
- coach cannot view artefacts
- history requires more than current counts surface
- the flow needs human explanation to hide product gaps

---

## 10. Copy and sales-language lock

Pilot language must stay literal.

Allowed framing:
- deterministic execution alpha
- coach-operable
- bounded paid pilot
- assign programs
- factual execution
- history counts
- non-binding coach notes
- one coach / up to 16 athletes
- one activity lane

Forbidden framing:
- safer
- protects
- readiness
- compliance
- optimised
- smarter programming
- injury prevention
- recovery support
- risk reduction
- org-ready platform
- evidence export
- audit-proof release
- full coach operating system

Operator actions:
- review pilot sales message
- review onboarding copy
- review any PDF, email, DM, landing page, or invoice wording
- strip all implied claims and future-scope wording

Fail the setup if:
- the copy implies medical, safety, or optimisation value
- the copy implies broad org/team runtime
- the copy implies proof/evidence/export capability
- the copy implies the system decides like a human coach

---

## 11. Missing dependency kill list

Do not start the paid pilot unless all of these are true:
- one coach exists
- coach is on `coach_16`
- 3 to 8 real athletes are linked explicitly
- one supported activity is chosen
- Phase 1 onboarding works lawfully
- coach assignment works
- athlete execution works
- split / return works
- partial completion works
- factual artefact viewing works
- non-binding coach notes work
- history counts work
- copy is bounded and literal

If any item is false, the setup is incomplete and the pilot must not be sold as live.

---

## 12. Final founder rule

The first paid pilot is not a broad platform launch.

It is:
- one coach
- one bounded commercial tier
- one supported activity
- a small real athlete roster
- one repeatable onboarding-to-execution path
- zero fake surfaces
- zero fake promises

Revenue starts when this path is real, repeatable, and honestly sold.