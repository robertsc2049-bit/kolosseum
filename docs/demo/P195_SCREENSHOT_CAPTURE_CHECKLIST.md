# P195 — Screenshot Capture Checklist & Procedure

Status: Draft  
Owner: Founder / Ops / Product  
Scope: v0 only  
Rewrite policy: rewrite-only  
Last updated: 2026-04-13

---

## Target

Define the exact checklist and capture procedure for the approved sales follow-up screenshot pack.

This procedure exists to:
- capture only real current v0 surfaces
- keep screenshot evidence clean and repeatable
- prevent scope leakage in sales follow-up
- make screenshot capture a controlled operational task, not an improvised one

---

## Invariant

This procedure MUST remain inside current v0 boundaries.

It MUST:
- capture only real current product surfaces
- use only current workflow states
- keep screenshots operational and truthful
- preserve privacy through redaction where needed
- produce a compact, repeatable screenshot pack for sales follow-up

It MUST NOT:
- capture future-state or dormant surfaces
- use mockups, edited UI, or simulated overlays
- imply unsupported org, team, unit, gym, proof, audit, replay, or evidence features
- use captions that imply safety, readiness, optimisation, or outcome claims
- create screenshots that require scope-expanding explanation to appear valuable

---

## Proof

This procedure is correct only if all of the following are true:

- every captured screenshot is from a real current v0 surface
- every screenshot maps to an approved screenshot category
- every screenshot has a neutral caption
- no personal or sensitive identifiers leak externally
- the full pack can be reused in sales follow-up without widening product scope

---

## Approved screenshot pack

The approved P195 pack contains only these surfaces:

1. athlete onboarding  
2. coach assignment / athlete list  
3. first executable session  
4. split / return or partial completion, if currently available  
5. history counts / factual history  
6. coach notes  

Target pack size:
- 5 to 6 screenshots only

If a surface is not real and currently available, it must be omitted rather than replaced with a mockup or placeholder.

---

## Output location

Recommended capture output folder:

`docs/demo/assets/p195/`

Recommended final screenshot set:

- `docs/demo/assets/p195/p195_01_athlete_onboarding.png`
- `docs/demo/assets/p195/p195_02_coach_assignment.png`
- `docs/demo/assets/p195/p195_03_first_session.png`
- `docs/demo/assets/p195/p195_04_split_return.png`
- `docs/demo/assets/p195/p195_05_history_counts.png`
- `docs/demo/assets/p195/p195_06_coach_notes.png`

If screenshot 4 is not currently available, do not create a placeholder file.

---

## Capture prerequisites

Before capturing anything, confirm all of the following:

- you are using a real current v0 environment or valid current demo environment
- the visible surface is already part of current v0
- the surface does not rely on hidden admin tooling to look complete
- demo data is real current demo data, not fake UI composition
- no unsupported feature flag or dormant surface is being shown
- no personal or sensitive customer data will leak in the capture

If any of these fail, stop.

---

## Capture checklist

### Global checklist

Complete this before any screenshot is approved:

- [ ] real current v0 surface
- [ ] no mockup or edited interface
- [ ] no future-state element visible
- [ ] no unsupported org/team/unit/gym surface
- [ ] no dashboards, rankings, messaging, proof, replay, or evidence surface visible
- [ ] no browser devtools or admin overlays visible
- [ ] no sensitive personal/customer identifiers visible unless redacted
- [ ] screenshot is understandable without scope-expanding explanation
- [ ] screenshot has a neutral caption
- [ ] filename matches P195 naming rule

---

## Per-screenshot checklist

### 1. Athlete onboarding

**Must show**
- real athlete onboarding surface
- current required declaration path
- structured current input flow

**Must not show**
- fake completion states
- hidden defaults
- coach edit path
- safety/readiness/outcome wording

**Approval checklist**
- [ ] onboarding surface is real
- [ ] declaration path is visible
- [ ] no unsupported claims visible
- [ ] no sensitive identifiers visible
- [ ] filename = `p195_01_athlete_onboarding.png`

**Approved caption**
- "Athlete onboarding declaration in the current v0 flow"

---

### 2. Coach assignment / athlete list

**Must show**
- real coach-scoped athlete list or assignment surface
- current linked-athlete view
- scoped current pilot view

**Must not show**
- cross-org visibility
- admin-only controls
- unsupported team/unit/org runtime surfaces
- broad governance controls

**Approval checklist**
- [ ] coach-scoped view is real
- [ ] only current supported scope is shown
- [ ] no wider management surface is implied
- [ ] no sensitive identifiers visible
- [ ] filename = `p195_02_coach_assignment.png`

**Approved caption**
- "Coach-scoped athlete view in the current pilot path"

---

### 3. First executable session

**Must show**
- real session surface
- currently materialised executable session
- visible execution path

**Must not show**
- hidden engine tooling
- unsupported analytics
- adaptive claims
- safety/outcome claims

**Approval checklist**
- [ ] executable session is real
- [ ] screen is part of current v0 execution flow
- [ ] no unsupported explanation is required
- [ ] no sensitive identifiers visible
- [ ] filename = `p195_03_first_session.png`

**Approved caption**
- "Executable session surface from the current v0 build"

---

### 4. Split / return or partial completion

**Must show**
- real current interruption-handling surface if available
- current split, return, or partial completion step

**Must not show**
- hidden future automation
- speculative progression behaviour
- placeholder or mocked return flow

**Approval checklist**
- [ ] surface exists in current live/demo path
- [ ] state occurred naturally or was validly reached
- [ ] no future-state explanation is needed
- [ ] no sensitive identifiers visible
- [ ] filename = `p195_04_split_return.png`

**Approved caption**
- "Split/return handling in the current v0 session flow"

---

### 5. History counts / factual history

**Must show**
- current factual history
- current simple counts
- real recorded history surface

**Must not show**
- readiness dashboards
- rankings
- predictive analytics
- surveillance framing

**Approval checklist**
- [ ] history surface is real
- [ ] only factual history/counts are shown
- [ ] no unsupported analytics layer is implied
- [ ] no sensitive identifiers visible
- [ ] filename = `p195_05_history_counts.png`

**Approved caption**
- "Factual session history and counts in the current athlete flow"

---

### 6. Coach notes

**Must show**
- real non-binding notes surface
- notes attached to current coach workflow
- note UI as it actually exists

**Must not show**
- declaration editing
- engine override
- executable coach control
- notes presented as truth mutation

**Approval checklist**
- [ ] notes surface is real
- [ ] notes are clearly bounded
- [ ] no unsupported authority is implied
- [ ] no sensitive identifiers visible
- [ ] filename = `p195_06_coach_notes.png`

**Approved caption**
- "Non-binding coach notes in the current coach surface"

---

## Capture procedure

### Step 1 — Prepare the environment
Open the real current v0 product surface you intend to capture.

Confirm:
- correct user role
- correct scope
- correct workflow state
- no unsupported feature visible

If the state is not naturally available, do not fake it.

---

### Step 2 — Validate the surface before capture
Before pressing capture, ask:

- is this a real current surface?
- does this sit inside current v0?
- would a reasonable buyer infer unsupported scope from this image?
- would I need verbal caveats to stop this image from overstating the product?

If the answer to the last two is yes, do not capture it.

---

### Step 3 — Capture the raw screenshot
Capture the cleanest full-screen or tightly scoped version of the real surface.

Rules:
- prefer clean crop over cluttered full-window shot
- keep enough surrounding UI to make the screen believable
- do not crop so tightly that the image looks fabricated
- do not capture browser tabs, bookmarks, or irrelevant desktop clutter where avoidable

---

### Step 4 — Redact if needed
Redact only:
- names
- email addresses
- phone numbers
- internal IDs
- sensitive pilot/customer identifiers

Do not redact in a way that changes what the workflow is showing.

Redaction must protect identity, not alter product truth.

---

### Step 5 — Name the file deterministically
Save using the approved filename for that surface.

Do not invent alternative names.
Do not keep vague names like:
- `final.png`
- `new shot.png`
- `sales demo screen.png`

---

### Step 6 — Attach the approved caption
Each screenshot must carry exactly one short neutral caption.

The caption must:
- describe only what is visible
- state only what the surface proves
- remain inside current v0

Do not use marketing adjectives to inflate value.

---

### Step 7 — Run final approval pass
Before the screenshot enters the pack, confirm:

- [ ] real current surface
- [ ] correct filename
- [ ] neutral caption
- [ ] redaction complete where needed
- [ ] no unsupported scope implied
- [ ] screenshot belongs in the approved order
- [ ] screenshot pack still totals only 5–6 images

Only then is the screenshot approved.

---

## Required pack order

Use this order only:

1. athlete onboarding  
2. coach assignment / athlete list  
3. first executable session  
4. split / return or partial completion, if available  
5. history counts / factual history  
6. coach notes  

This order is binding for sales follow-up because it tells the shortest truthful product story:
- entry
- linkage
- execution
- workflow depth
- factual continuity
- bounded coach interaction

---

## Forbidden screenshots

The following are never approved for P195:

- any mockup
- any figma or design concept
- any future-state surface
- any dormant org/team/unit/gym runtime screen
- any dashboard, ranking, messaging, replay, audit, proof, or evidence surface outside current v0
- any dev/admin tool view
- any hand-edited state presented as real product state
- any screenshot that needs heavy explanation to avoid misleading the prospect

---

## Sales handoff rule

When the pack is complete, sales may use it only:
- after a live demo
- in warm follow-up
- in pilot close conversations

Sales may not use it:
- as broad top-of-funnel advertising
- as investor/product-vision shorthand
- as evidence of future scope
- as substitute proof for unsupported claims

---

## Pack acceptance checklist

The pack is accepted only when:

- [ ] all screenshots are real current v0 surfaces
- [ ] all filenames follow the naming rule
- [ ] all captions are neutral and approved
- [ ] all screenshots are redacted where needed
- [ ] no screenshot widens scope
- [ ] pack size is 5–6 screenshots only
- [ ] screenshots are ordered correctly
- [ ] the pack can be sent to a prospect without verbal cleanup

---

## Non-goals

This procedure does not:
- create any new demo surface
- approve mockups
- widen v0 scope
- replace live demo
- define future design direction
- authorise screenshots from dormant platform layers

---

## Final rule

If a screenshot is not from a real current v0 surface, it is not approved.

If a screenshot becomes persuasive only by implying more product than actually exists, it must not be used.
