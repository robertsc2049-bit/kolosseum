# P189 - Pilot Intake Form Spec

Status: draft
Audience: founder / operator / commercial
Purpose: minimal intake schema for paid pilot setup that standardises sales handoff into delivery without collecting anything beyond current v0 setup need.

---

## Target

- minimal intake schema for paid pilot setup

## Invariant

- intake must collect only what current setup actually needs

## Proof

- intake fields pinned
- required vs optional pinned
- banned extra fields pinned
- anything beyond current v0 pilot setup fails

---

## 1. Use rule

Use this intake spec only after:
- the lead has agreed to proceed
- the lead is already a valid current v0 fit
- the pilot is being handed from commercial into setup

Do not use intake to reopen discovery or sneak in broader scope mapping.

---

## 2. Current setup truth

The intake form exists only to capture setup for the bounded current v0 pilot:

- one coach
- one activity lane
- bounded athlete count inside current tier
- preferred start window
- current coach tier

Current included surfaces:
- lawful onboarding
- coach assignment
- factual session execution
- split / return
- partial completion
- coach-viewable factual artefacts
- history counts
- non-binding coach notes

Not included:
- dashboards
- analytics
- rankings
- readiness scoring
- messaging
- team runtime
- unit runtime
- gym runtime
- organisation runtime
- proof export
- evidence sealing
- outcome tracking

---

## 3. Required fields

The intake form must require only:

- coach full name
- coach email
- activity lane
- athlete count
- preferred start window
- coach tier

These are the minimum fields required to set up the bounded current pilot.

---

## 4. Optional fields

The intake form may optionally collect:

- short setup note
- billing contact name
- billing contact email

Optional means optional.
If the pilot can start without it, it must not become a hidden required field.

---

## 5. Banned fields

Do not collect:

- organisation hierarchy
- team hierarchy
- unit structure
- gym structure
- dashboard requirements
- analytics requirements
- messaging requirements
- readiness requirements
- proof export requirements
- athlete comparison requirements
- outcome goals
- retention goals
- injury or rehab claims
- multi-coach rollout planning
- multi-activity rollout planning

If those fields are needed, the lead is either outside current v0 fit or the intake is being abused.

---

## 6. Suggested exact intake structure

Use this structure:

### Required
- coach full name
- coach email
- activity lane
- athlete count
- preferred start window
- coach tier

### Optional
- short setup note
- billing contact name
- billing contact email

### Excluded
- everything outside current v0 pilot setup need

---

## 7. Field rules

### Coach full name
Used to identify the single operating coach for the pilot.

### Coach email
Used for commercial and setup contact.

### Activity lane
Must be one of:
- powerlifting
- rugby_union
- general_strength

### Athlete count
Must be bounded to the current pilot tier and current v0 fit.

### Preferred start window
Must be a simple timing input only.

### Coach tier
Must match the bounded current pilot offer.

---

## 8. Failure conditions

This intake spec fails if:
- it asks for more than the minimum current setup need
- it turns optional fields into hidden required fields
- it collects organisation, team, unit, or gym runtime structure
- it collects dashboard, analytics, messaging, proof, or outcome requirements
- it drifts away from one coach, one activity lane, and bounded athlete count
- it becomes discovery instead of setup

---

## 9. Final rule

This intake exists to move from sale to setup cleanly.

Collect only what current setup actually needs.
Nothing else.