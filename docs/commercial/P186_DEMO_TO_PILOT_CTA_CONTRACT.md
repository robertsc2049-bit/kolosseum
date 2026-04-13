# P186 - Demo-to-Pilot CTA Contract

Status: draft  
Audience: founder / operator / commercial  
Purpose: single exact next-step block for all post-demo follow-ups.

---

## Target

- single exact next-step block used in all follow-ups

## Invariant

- CTA must ask only for activity lane, athlete count, preferred start window, and coach tier

## Proof

- CTA block pinned
- allowed fields pinned
- banned extra asks pinned
- anything beyond the exact next-step contract is excluded

---

## 1. Use rule

Use this CTA block:
- after demo follow-up
- after pricing send
- after sales handoff
- after warm / cold / hesitant follow-up
- after qualification when the lead is still a valid fit

Do not improvise a different close unless product truth changes.

---

## 2. Exact CTA block

Use this exact block:

If you want to move forward, reply with:
- activity lane
- athlete count
- preferred start window
- coach tier

That is the contract.

---

## 3. Allowed values

### Activity lane
Allowed:
- powerlifting
- rugby_union
- general_strength

### Athlete count
Allowed:
- bounded pilot count only
- expected current fit is within current pilot tier limits

### Preferred start window
Allowed:
- a simple start timing answer
- for example: this month, next month, specific week, or specific date window

### Coach tier
Allowed:
- current bounded pilot tier only
- coach_16

---

## 4. Banned extra asks

Do not ask for:
- team structure
- organisation hierarchy
- unit structure
- gym structure
- dashboard requirements
- analytics requirements
- messaging requirements
- readiness requirements
- proof export requirements
- injury / outcome goals
- retention goals
- extra discovery questions inside the CTA block

If those are needed, the lead is either not current v0 fit or the conversation should stay in qualification, not CTA.

---

## 5. Suggested exact send usage

Template:

Hi [Name],

If you want to move forward, reply with:
- activity lane
- athlete count
- preferred start window
- coach tier

Chris

---

## 6. Failure conditions

This CTA fails if:
- it asks for more than four fields
- it asks for fields outside current v0 pilot setup need
- it asks for organisation or team structure
- it asks for unsupported surfaces
- it asks for outcome or readiness information
- it drifts away from coach_16 as the bounded current pilot tier

---

## 7. Final rule

The purpose of this CTA is to remove friction, not reopen discovery.

Ask only for:
- activity lane
- athlete count
- preferred start window
- coach tier