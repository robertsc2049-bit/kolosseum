# S24 — Live Operator Dashboard Pack

**Document status**  
Draft — proof pack

**Audience**  
Founder / ops / manual v0 operator

**Release applicability**  
v0 Deterministic Execution Alpha only

## Target
Define the minimum live operator view/report needed to run v0 manually.

## Invariant
Operator sees only factual, v0-lawful state and next actions. No analytics, no advisory language.

## Proof
- exact fields
- exact labels
- exact status meanings
- exact "what to do next" wording

## Must include
- pilot status
- coach status
- athlete status
- link status
- declaration status
- compile status
- readiness to start
- blocked reason

## Why now
Without this, founder memory is still the system.

---

## Final rule

This surface is an **operator report**, not a product dashboard.

It may show only:
- factual state
- factual blockers
- exact next manual action

It must not show:
- scores
- trends
- readiness logic
- recommendations
- interpretation
- behavioural judgement
- coaching advice

---

## 1. Purpose

The live operator view exists to answer one question only:

**Can this pilot lawfully be started now, and if not, what exact manual step is next?**

It does not answer:
- whether the pilot is good
- whether the athlete is ready
- whether the coach is effective
- whether the compile is high quality
- whether risk is low or high

---

## 2. Scope lock

This pack applies only to current v0:
- individual_user and coach only
- individual and coach_managed execution only
- powerlifting, rugby_union, and general_strength only
- Phase 1 to Phase 6 only
- factual runtime execution only
- no dashboards
- no analytics
- no rankings
- no messaging
- no readiness scoring

---

## 3. One-record model

One operator row/card = **one pilot**.

The report must not aggregate multiple pilots into a scored summary.

Each pilot record must contain exactly these fields.

---

## 4. Exact fields and labels

### 4.1 Required fields
1. `pilot_status`
2. `coach_status`
3. `athlete_status`
4. `link_status`
5. `declaration_status`
6. `compile_status`
7. `readiness_to_start`
8. `blocked_reason`
9. `what_to_do_next`

### 4.2 Optional factual identifiers allowed
These may appear above the status block, but do not change status logic:
- `pilot_id`
- `coach_id`
- `athlete_id`
- `activity_id`
- `execution_scope`
- `last_updated_at`

No other fields are required for the minimum pack.

---

## 5. Exact field meanings

### 5.1 `pilot_status`
The overall lifecycle state of the pilot container.

Allowed values:
- `commercial_pending`
- `platform_pending`
- `coach_pending`
- `athlete_pending`
- `link_pending`
- `scope_pending`
- `phase1_pending`
- `compile_pending`
- `coach_ready`
- `active`
- `paused`
- `stopped`
- `cancelled`

### 5.2 `coach_status`
The current factual state of the coach account for this pilot.

Allowed values:
- `not_invited`
- `invited`
- `active`
- `revoked`

Meaning:
- `not_invited` = no coach invite has been issued
- `invited` = invite issued, not yet active
- `active` = coach account exists and is usable
- `revoked` = coach access removed

### 5.3 `athlete_status`
The current factual state of the athlete account for this pilot.

Allowed values:
- `not_invited`
- `invited`
- `active`
- `revoked`

Meaning mirrors coach account state.

### 5.4 `link_status`
The factual state of the coach ↔ athlete relationship record.

Allowed values:
- `not_created`
- `invited`
- `accepted`
- `revoked`

Meaning:
- `not_created` = no link record exists
- `invited` = link exists, awaiting acceptance
- `accepted` = link accepted and active
- `revoked` = link no longer active

### 5.5 `declaration_status`
The factual state of athlete declaration for this pilot.

Allowed values:
- `not_started`
- `in_progress`
- `accepted`
- `failed`

Meaning:
- `not_started` = no lawful Phase 1 declaration submitted
- `in_progress` = declaration flow opened but not accepted
- `accepted` = lawful Phase 1 declaration accepted
- `failed` = last declaration attempt failed validation

### 5.6 `compile_status`
The factual state of executable session compilation.

Allowed values:
- `not_requested`
- `pending`
- `passed`
- `failed`

Meaning:
- `not_requested` = compile not yet attempted
- `pending` = compile started, no result yet
- `passed` = first executable session compiled successfully
- `failed` = compile attempted and failed

### 5.7 `readiness_to_start`
Binary operational answer for the operator.

Allowed values:
- `yes`
- `no`

Meaning:
- `yes` = this pilot may be started now
- `no` = this pilot must not be started now

### 5.8 `blocked_reason`
Single closed value explaining why `readiness_to_start = no`.

Allowed values:
- `none`
- `commercial`
- `platform`
- `coach`
- `athlete`
- `link`
- `scope`
- `declaration`
- `compile`
- `stopped`
- `cancelled`

### 5.9 `what_to_do_next`
Single exact action sentence for the operator.

This field must use the controlled wording in section 8.

---

## 6. Status derivation rules

The operator surface must derive `pilot_status`, `readiness_to_start`, `blocked_reason`, and `what_to_do_next` from factual upstream states only.

### 6.1 Readiness to start = `yes` only if all are true
- `coach_status = active`
- `athlete_status = active`
- `link_status = accepted`
- `declaration_status = accepted`
- `compile_status = passed`
- `pilot_status = coach_ready` or `pilot_status = active`

If any of the above is false, `readiness_to_start = no`.

### 6.2 Block precedence
If more than one block exists, show only the first lawful block in this order:

1. `cancelled`
2. `stopped`
3. `commercial`
4. `platform`
5. `coach`
6. `athlete`
7. `link`
8. `scope`
9. `declaration`
10. `compile`

This keeps one blocker, one next action, no ambiguity.

### 6.3 No inference rule
The surface must not infer missing state.
Examples:
- missing declaration record does not mean accepted
- missing link row does not mean invited
- missing compile result does not mean failed
- absent data must stay absent and resolve to the earlier blocking state

---

## 7. Exact status meanings

### `pilot_status`
- `commercial_pending` — pilot exists but commercial access is not complete
- `platform_pending` — commercial state complete; workspace/platform setup not complete
- `coach_pending` — platform ready; coach account not active
- `athlete_pending` — coach active; athlete account not active
- `link_pending` — athlete active; coach-athlete link not accepted
- `scope_pending` — link accepted; scope/activity boundary not yet locked for this pilot
- `phase1_pending` — scope locked; athlete Phase 1 declaration not accepted
- `compile_pending` — Phase 1 accepted; first executable session not yet passed compile
- `coach_ready` — compile passed; pilot ready for coach-run start
- `active` — pilot started and operating
- `paused` — pilot temporarily paused by operator
- `stopped` — pilot permanently stopped
- `cancelled` — pilot cancelled before operation

### `coach_status`
- `not_invited` — no invite sent
- `invited` — invite sent, account not active
- `active` — account active
- `revoked` — access removed

### `athlete_status`
- `not_invited` — no invite sent
- `invited` — invite sent, account not active
- `active` — account active
- `revoked` — access removed

### `link_status`
- `not_created` — no relationship record exists
- `invited` — relationship invite exists, not accepted
- `accepted` — relationship active
- `revoked` — relationship removed

### `declaration_status`
- `not_started` — no accepted declaration exists
- `in_progress` — declaration process opened but not accepted
- `accepted` — lawful accepted Phase 1 exists
- `failed` — latest declaration attempt failed

### `compile_status`
- `not_requested` — compile not yet run
- `pending` — compile in progress
- `passed` — first executable session compiled
- `failed` — compile failed

### `readiness_to_start`
- `yes` — operator may start pilot now
- `no` — operator must not start pilot now

### `blocked_reason`
- `none` — no current block
- all other values mean exact current blocker

---

## 8. Exact "what to do next" wording

This field must be one of the following exact strings only.

### When blocked by commercial
`Complete commercial setup.`

### When blocked by platform
`Complete workspace setup.`

### When blocked by coach
`Activate coach account.`

### When blocked by athlete
`Activate athlete account.`

### When blocked by link
`Accept coach-athlete link.`

### When blocked by scope
`Lock pilot scope.`

### When blocked by declaration
`Complete Phase 1 declaration.`

### When blocked by compile
`Run first compile.`

### When stopped
`Do not start. Pilot is stopped.`

### When cancelled
`Do not start. Pilot is cancelled.`

### When ready
`Start pilot.`

### When already active
`Continue active pilot.`

### When paused
`Resume paused pilot or stop pilot.`

No other wording is allowed in the minimum pack.

---

## 9. Minimum operator card

Use this exact display order:

**Pilot**
- Pilot status: `{pilot_status}`
- Coach status: `{coach_status}`
- Athlete status: `{athlete_status}`
- Link status: `{link_status}`
- Declaration status: `{declaration_status}`
- Compile status: `{compile_status}`
- Readiness to start: `{readiness_to_start}`
- Blocked reason: `{blocked_reason}`
- What to do next: `{what_to_do_next}`

This is intentionally flat and factual. No extra commentary.

---

## 10. Lawful examples

### Example A — not ready, declaration missing
- Pilot status: `phase1_pending`
- Coach status: `active`
- Athlete status: `active`
- Link status: `accepted`
- Declaration status: `not_started`
- Compile status: `not_requested`
- Readiness to start: `no`
- Blocked reason: `declaration`
- What to do next: `Complete Phase 1 declaration.`

### Example B — not ready, compile failed
- Pilot status: `compile_pending`
- Coach status: `active`
- Athlete status: `active`
- Link status: `accepted`
- Declaration status: `accepted`
- Compile status: `failed`
- Readiness to start: `no`
- Blocked reason: `compile`
- What to do next: `Run first compile.`

### Example C — ready
- Pilot status: `coach_ready`
- Coach status: `active`
- Athlete status: `active`
- Link status: `accepted`
- Declaration status: `accepted`
- Compile status: `passed`
- Readiness to start: `yes`
- Blocked reason: `none`
- What to do next: `Start pilot.`

---

## 11. Hard prohibitions

This surface must not include:
- readiness score
- risk label
- coach quality label
- athlete quality label
- "healthy"
- "safe"
- "good to go"
- "needs attention"
- trend arrows
- heatmaps
- confidence scores
- recommendations
- compile quality judgements
- free-text operator interpretation

---

## 12. Acceptance lock

This pack is satisfied only if:
- every pilot can be represented using the exact required fields
- every field uses only the allowed values
- blocked reason resolves through the fixed precedence order
- "what to do next" uses only the exact approved wording
- readiness to start is binary and factual
- no analytics or advisory language appears anywhere

If any extra interpretation is needed, the pack is incomplete.
