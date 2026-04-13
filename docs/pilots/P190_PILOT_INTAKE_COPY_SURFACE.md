# P190 - Pilot Intake Copy Surface

Status: Draft
Scope: current v0 surfaces only
Boundary: exact copy for intake form/questions only

## Intent

This document defines the exact pilot intake copy surface for current v0-reachable onboarding only.

It is limited to:

- actor types: athlete, coach
- execution scopes: individual, coach_managed
- activities: powerlifting, rugby_union, general_strength
- active path: Phase 1 onboarding / declaration only
- engine-inert presentation flags only

It excludes:

- org/team/unit/gym runtime intake
- dashboards
- analytics
- rankings
- messaging
- readiness scoring
- outcome evaluation
- evidence/export inputs
- medical / safety / advisory intake

Unknown or extra fields must not be captured.

---

## Form shell

### Title

Pilot intake

### Intro text

Complete this intake to declare the minimum information required for lawful setup and execution.

### Boundary text

Only declared fields are accepted. Unknown or extra fields are not accepted.

### System disclaimer

Kolosseum is a software system that generates and adapts structured activity plans based on user-declared constraints and feedback. It does not provide medical, therapeutic, or coaching advice.

---

## Section 1 - Consent and version lock

### Q1 - Consent

**Label**  
Do you grant consent to use your declared inputs for session generation and execution?

**Type**  
single-select

**Options**
- Yes

**Helper text**  
Consent is required. Without it, execution is not permitted.

### Q2 - Engine version

**Label**  
Engine version

**Type**  
hidden / fixed

### Q3 - Enum bundle version

**Label**  
Enum bundle version

**Type**  
hidden / fixed

### Q4 - Phase 1 schema version

**Label**  
Phase 1 schema version

**Type**  
hidden / fixed

**Section rule**  
All version pins must match exactly.

---

## Section 2 - Role and execution scope

### Q5 - Role

**Label**  
Select your role.

**Type**  
single-select

**Options**
- Athlete
- Coach

### Q6 - Execution scope

**Label**  
Select execution scope.

**Type**  
single-select

**Options**
- Individual
- Coach-managed

### Q7 - Governing authority ID

**Label**  
Governing authority ID

**Type**  
text

**Show when**  
Execution scope = Coach-managed

**Helper text**  
Required for coach-managed execution.

---

## Section 3 - Activity

### Q8 - Activity

**Label**  
Select activity.

**Type**  
single-select

**Options**
- Powerlifting
- Rugby Union
- General Strength

### Q9 - Sport role

**Label**  
Select sport role.

**Type**  
single-select

**Show when**  
Selected activity requires sport role

**Helper text**  
Only show this when required by the selected activity.

---

## Section 4 - Environment

### Q10 - Location type

**Label**  
Where will you train?

**Type**  
single-select

**Options**  
Enum-backed only

### Q11 - Equipment profile

**Label**  
Select available equipment profile.

**Type**  
single-select

**Options**  
Enum-backed only

**Required**  
No

**Helper text**  
Declare available equipment only. Do not assume access.

---

## Section 5 - Presentation preferences

### Q12 - Display mode

**Label**  
Display mode

**Type**  
single-select

**Options**
- Standard
- ND mode

### Q13 - Instruction density

**Label**  
Instruction density

**Type**  
single-select

**Options**
- Minimal
- Standard
- Detailed

### Q14 - Prompt density

**Label**  
Prompt density

**Type**  
single-select

**Options**  
Enum-backed only

### Q15 - Exercise bias

**Label**  
Exercise bias

**Type**  
single-select

**Options**  
Enum-backed only

**Section helper text**  
These options change presentation only. They do not change legality, selection, progression, evidence, or replay.

---

## Section 6 - Constraints

### Q16 - Movements you cannot perform

**Label**  
Select movement patterns to exclude.

**Type**  
multi-select

**Options**  
movement_pattern_id only

**Helper text**  
Use movement patterns only. Exercise IDs are not accepted.

### Q17 - Primary goal

**Label**  
Primary goal

**Type**  
single-select

**Options**  
Enum-backed only

**Required**  
No

**Helper text**  
Only show goals that are permitted. If a role-specific goal is selected, a sport role must already be declared.

### Q18 - Record bias

**Label**  
Record bias

**Type**  
single-select

**Options**  
Enum-backed only

**Required**  
No

### Q19 - Record lift target

**Label**  
Record lift target

**Type**  
single-select

**Options**  
Enum-backed only

**Show when**  
Record bias != none

---

## Section 7 - Coach relationship setup

Only include this section if the pilot includes coach-managed setup.

### Q20 - Coach relationship

**Label**  
Will this account be linked to a coach?

**Type**  
single-select

**Options**
- Yes
- No

### Q21 - Coach ID

**Label**  
Coach ID

**Type**  
text

**Show when**  
Coach relationship = Yes

### Q22 - Relationship acceptance

**Label**  
Do both parties accept this coach relationship?

**Type**  
single-select

**Options**
- Yes

**Show when**  
Coach relationship = Yes

**Helper text**  
Coach relationships must be explicit.

---

## Copy rules

Use descriptive, mechanical, non-valenced wording only.

Allowed style:
- Movements you cannot perform
- Equipment not available
- Constraints you want applied
- Where will you train?
- Select available equipment profile

Do not use:
- safe
- safer
- safety
- suitable
- appropriate
- best
- optimal
- optimise
- protect
- prevent
- injury
- rehab
- rehabilitation
- medical
- diagnosis
- treatment
- therapy
- recommend
- advice
- readiness
- risk
- pain-free
- correction
- fix
- resolve

Do not ask for:
- diagnoses
- symptoms
- medical history
- therapeutic goals
- readiness state
- outcome predictions
- free-text advice requests

---

## Founder summary

The pilot intake surface is restricted to:

1. Consent and version pins
2. Role and execution scope
3. Activity and conditional sport role
4. Location and optional equipment profile
5. Presentation preferences
6. Constraints
7. Optional explicit coach link

That is the narrowest current-v0 lawful intake surface.