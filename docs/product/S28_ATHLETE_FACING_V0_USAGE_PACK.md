# S28 — Athlete-facing v0 usage pack

## Target

Give the athlete one exact how-to-use-v0 pack.

## Invariant

The athlete can complete the live path without needing unsupported features.

## v0 boundary

This pack applies only to Kolosseum v0 Deterministic Execution Alpha.

v0 supports:

- athlete account access
- Phase 1 declaration
- session execution
- factual runtime event recording
- split and return
- partial completion
- own history counts
- coach-assigned sessions where a coach-managed link is accepted

v0 does not support:

- messaging
- dashboards
- rankings
- outcome evaluation
- organisation, team, unit, or gym runtime
- Phase 7 truth projection
- Phase 8 evidence sealing
- evidence export
- claim language outside factual v0 boundaries

## Operating rule

Athletes execute sessions and generate factual records.

The system does not coach, judge, advise, or create athlete status.

## 1. Athlete quickstart

### Step 1 — Open account

The athlete signs in and opens their own account.

The athlete may only use their own athlete surface.

### Step 2 — Complete Phase 1 declaration

The athlete completes the required declaration fields shown by the product surface.

The athlete must provide explicit declarations only.

The athlete must not rely on the system to infer missing information.

If required declaration fields are missing, the live path cannot start.

### Step 3 — Open available session

The athlete opens an available session.

A session may be:

- self-available where v0 permits individual execution
- coach-assigned where an accepted coach-managed link exists

If no executable session exists, the athlete cannot start execution.

### Step 4 — Execute session

The athlete follows the displayed session structure.

The athlete records factual actions as shown by the product surface.

### Step 5 — Use split and return if needed

If the athlete leaves the session before completion, the athlete uses split and return where the product surface permits it.

Split and return records the session state so the athlete can return to the live path.

### Step 6 — Finish or leave partial

The athlete may finish the session.

If only part of the session is completed, v0 records partial completion as factual runtime data.

### Step 7 — View own history

The athlete may view their own factual history counts where the product surface permits it.

History is factual only.

## 2. Session execution guide

### Before starting

The athlete should confirm:

- account is active
- Phase 1 declaration has been accepted
- session is available
- session belongs to the athlete
- execution button is available

If any of these are missing, execution does not start.

### During the session

The athlete may record factual session events made available by the product surface.

Examples of factual records include:

- work completed
- work not completed
- extra work recorded
- split point
- return point
- partial completion

The system records what happened.

The system does not convert factual events into athlete judgement.

### After the session

The athlete may view factual session output where the product surface permits it.

The output may include:

- completed items
- non-completed items
- recorded runtime events
- split and return state
- partial completion state
- own history counts

The output must remain factual.

## 3. Split / return guide

### When to use split

Use split when a live session cannot be completed in one continuous run.

Split records where the athlete left the session.

### What split does

Split may record:

- session id
- athlete id
- split point
- current runtime state
- recorded factual events up to that point

Split does not create a new session.

Split does not change Phase 1 declarations.

Split does not change engine legality.

### How to return

The athlete opens the available return surface.

The athlete resumes from the recorded state where the product surface permits it.

### What return does

Return continues the recorded live path.

Return does not regenerate the session.

Return does not reinterpret previous runtime events.

Return does not create athlete status.

### Partial completion

If the athlete does not complete the whole session, v0 records the factual partial completion state.

Partial completion is not a judgement.

Partial completion does not create future engine authority.

## 4. What this system does not do yet

v0 does not provide:

- messaging
- dashboards
- rankings
- outcome evaluation
- organisation runtime
- team runtime
- unit runtime
- gym runtime
- evidence export
- proof envelope export
- Phase 7 truth projection
- Phase 8 evidence sealing
- athlete status judgement
- future session judgement
- claim language outside factual v0 boundaries

If an athlete needs a feature outside this list, it is not part of v0.

## 5. Blocked states

### Phase 1 missing

Message:

Phase 1 declaration is required before execution can start.

### No executable session

Message:

No executable session is available.

### Coach-managed link missing

Message:

Coach-assigned execution requires an accepted coach-managed link.

### Session already completed

Message:

This session is already completed.

### Return unavailable

Message:

No return state is available for this session.

### Out-of-scope session

Message:

This session is not available to this athlete.

## 6. Support response lock

If an athlete asks for messaging, the response is:

Messaging is not available in v0.

If an athlete asks for dashboards or rankings, the response is:

Dashboards and rankings are not available in v0.

If an athlete asks for evidence export, the response is:

Evidence export is not available in v0.

If an athlete asks why the session is unavailable, the response is:

The session is unavailable because a required v0 condition has not been met.

## 7. Proof checklist

This pack is complete only if the repo contains:

- one athlete quickstart
- one session execution guide
- one split and return guide
- one what-this-system-does-not-do-yet section
- explicit Phase 1 missing message
- explicit no executable session message
- explicit coach-managed link missing message
- explicit return unavailable message
- explicit out-of-scope session message
- no analytics language
- no advisory language
- no Phase 7 or Phase 8 capability claim
- no organisation, team, unit, or gym runtime claim

## Final lock

Athlete-facing v0 usage is limited to:

- declare
- execute
- record
- split
- return
- view own factual history

Anything outside that boundary does not exist in v0.