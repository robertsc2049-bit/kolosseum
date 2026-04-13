# P188 - Pilot Eligibility Matrix

Status: draft
Audience: founder / operator / commercial
Purpose: green / yellow / red matrix for deciding quickly whether a lead is an acceptable current v0 pilot type.

---

## Target

- green / yellow / red matrix of acceptable pilot types

## Invariant

- matrix must classify only against current v0 truth

## Proof

- matrix pinned
- green / yellow / red rules pinned
- hard red exclusions pinned
- anything outside current v0 truth is excluded

---

## 1. Use rule

Use this matrix before:
- second demo call
- pricing send
- pilot offer
- proposal or handoff send

If the lead is red, stop trying to force fit.

---

## 2. Green

A lead is GREEN if all of the following are true:

- one coach
- one activity lane
- 3 to 16 athletes
- bounded early pilot is acceptable
- current v0 surfaces are enough
- no requirement for team, unit, gym, or organisation runtime
- no requirement for dashboards
- no requirement for messaging
- no requirement for analytics
- no requirement for proof export

Green result:
- proceed now

---

## 3. Yellow

A lead is YELLOW if the core fit is still current-v0-safe but there is scope friction.

Typical yellow examples:
- athlete count is not exact yet but likely within range
- one coach now, broader expansion later
- one activity lane now, broader use later
- future questions exist, but the lead still accepts the bounded current pilot
- current v0 pilot is acceptable as a narrow starting step

Yellow result:
- proceed only with explicit scope lock

---

## 4. Red

A lead is RED if any of the following are true:

- needs organisation runtime
- needs dashboards
- needs messaging
- needs analytics
- needs proof exports
- needs team runtime now
- needs unit runtime now
- needs gym runtime now
- needs more than one coach operating the pilot now
- needs more than one activity lane now
- needs athlete comparison, rankings, or outcome tracking as a core requirement
- only wants to proceed if broader capability is implied as current truth

Red result:
- do not proceed as current v0 pilot

---

## 5. Matrix

| Dimension | Green | Yellow | Red |
| --- | --- | --- | --- |
| Coach model | one coach | one coach now, possible later expansion | multi-coach now |
| Activity lane | one supported lane | one lane now, broader later | multi-activity now or unsupported |
| Athlete count | 3 to 16 | likely within range but not locked | requires larger rollout now |
| Runtime need | none beyond bounded coach pilot | broader later but not now | team / unit / gym / organisation runtime now |
| Reporting need | history counts only | accepts counts now | dashboards / analytics / rankings now |
| Proof need | no proof export need | accepts current limitation | proof export / sealed evidence now |
| Outcome need | factual execution only | accepts no outcome layer now | wants outcome tracking now |

---

## 6. Fast decision rule

Ask:

1. Is this one coach only?
2. Is this one activity lane only?
3. Is this 3 to 16 athletes?
4. Is a bounded current v0 pilot enough right now?
5. Do they need dashboards, messaging, analytics, or proof export now?

Decision:
- all five fit current truth -> GREEN
- core fit holds but scope tension remains -> YELLOW
- any hard red exclusion appears -> RED

---

## 7. Hard red exclusions

Immediate RED if the lead requires:

- organisation runtime
- dashboards
- messaging
- analytics
- proof exports
- team runtime
- unit runtime
- gym runtime
- multi-coach pilot now
- multi-activity pilot now
- athlete comparison as a must-have
- rankings as a must-have
- outcome tracking as a must-have

---

## 8. Final rule

This matrix exists to save time.

If a lead needs more than one coach, one activity lane, 3 to 16 athletes, and current v0 surfaces only, treat that as a boundary problem first, not a sales problem.