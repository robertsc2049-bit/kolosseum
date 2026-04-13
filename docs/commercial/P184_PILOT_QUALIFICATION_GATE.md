# P184 - Pilot Qualification Gate

Status: draft  
Audience: founder / operator / commercial  
Purpose: one-page filter for whether a lead is a good current v0 pilot fit now.

---

## Target

- one-page filter for who is a good v0 pilot now

## Invariant

- qualification gate must reject any lead whose needs outrun current v0 truth

## Proof

- fail-fast filters pinned
- excluded needs pinned
- pass / fail logic pinned
- anything outside current v0 fit is excluded

---

## 1. Use rule

Use this gate before:
- offering a pilot
- sending pricing
- sending a sales handoff pack
- spending time on a second or longer follow-up call

If the lead fails this gate, do not try to force the fit.

---

## 2. Green fit

A lead is a strong current v0 pilot fit if all of the following are true:

- one coach is the main operator
- one activity lane is enough
- athlete count is between 3 and 16
- the lead is comfortable with a bounded early pilot
- the lead only needs current v0 surfaces
- the lead does not require team, unit, gym, or organisation runtime
- the lead does not require dashboards, analytics, rankings, readiness scoring, messaging, or proof export

If all are true, qualify as:
- GREEN - good v0 pilot fit now

---

## 3. Yellow fit

A lead is a possible fit only if the core pilot still stays inside current v0 boundaries, but there is some friction.

Typical yellow cases:
- athlete count is slightly unclear
- the lead wants to start with one coach but may expand later
- the lead is asking future-facing questions but is still willing to buy a bounded pilot now
- the lead wants a later broader rollout but accepts the current pilot as a narrow first step

If the lead is still willing to buy the current bounded pilot without hidden promises, qualify as:
- YELLOW - possible v0 pilot fit, but only with explicit scope lock

---

## 4. Red fit

A lead is not a current v0 pilot fit if any of the following are true:

- they need more than one real operating coach from the start
- they need more than one activity lane from the start
- they need team, unit, gym, or organisation runtime now
- they need dashboards, analytics, rankings, readiness scoring, or messaging now
- they need exportable proof, evidence sealing, or outcome reporting now
- they need broad coach-operating-system capability rather than a bounded early pilot
- they are only interested if you imply future capability as if it exists now

If any are true, qualify as:
- RED - not a current v0 pilot fit

---

## 5. Fail-fast filters

Ask these in order.

### A. Coach type
Ask:
- Are you the single coach who would run this pilot directly?

Pass:
- yes, one coach

Fail:
- multi-coach requirement now
- org-controlled coaching structure now

### B. Activity lane
Ask:
- Is one activity lane enough for the first pilot?

Pass:
- yes, one of powerlifting, rugby_union, or general_strength

Fail:
- multi-activity requirement now
- unsupported activity

### C. Athlete count
Ask:
- Roughly how many athletes would be in the first pilot?

Pass:
- 3 to 16

Yellow:
- unclear but likely within range

Fail:
- needs a much larger rollout now
- needs org/team runtime instead of a bounded pilot

### D. Surface need
Ask:
- Is a bounded early pilot enough if it covers onboarding, coach assignment, factual execution, split / return, partial completion, factual artefacts, history counts, and non-binding coach notes?

Pass:
- yes

Fail:
- needs dashboards
- needs analytics
- needs rankings
- needs readiness scoring
- needs messaging
- needs org/team runtime
- needs proof export

---

## 6. Recommended qualification questions

Use these exact questions:

1. Are you the single coach who would run the pilot directly?
2. Is one activity lane enough for the first pilot?
3. Roughly how many athletes would be in the first pilot?
4. Is a bounded early pilot enough if it stays inside current v0 surfaces only?
5. Do you need any of the following now: dashboards, analytics, rankings, readiness scoring, messaging, team runtime, organisation reporting, or proof export?

If question 5 is yes, fail fast.

---

## 7. Qualification outputs

### GREEN output
Good current fit.
Proceed to:
- sales handoff pack
- pilot offer
- start window discussion

### YELLOW output
Possible fit, but only if scope is restated explicitly.
Proceed only if the lead accepts:
- one coach
- one activity lane
- 3 to 16 athletes
- current v0 surfaces only

### RED output
Not a current v0 fit.
Do not sell a pilot as if the product already supports their needs.

---

## 8. Hard exclusions

Do not qualify the lead if they need:
- team runtime
- unit runtime
- gym runtime
- organisation runtime
- dashboards
- analytics
- rankings
- readiness scoring
- messaging
- exportable proof
- sealed evidence
- outcome reporting
- multi-activity rollout now
- broad multi-coach structure now

---

## 9. Final rule

This gate exists to stop wasted calls and false-fit pilots.

If the lead needs more than the current bounded v0 pilot truth, reject the fit now.