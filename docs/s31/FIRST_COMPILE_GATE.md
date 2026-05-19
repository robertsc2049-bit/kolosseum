# FIRST_COMPILE_GATE.md

Project: Kolosseum
Slice: S31 — First Compile Gate
Status: v0 Deterministic Execution Alpha
Document Type: Platform Admission Contract
Engine Compatibility: EB2-1.0.0
Rewrite Policy: rewrite_only
Scope Class: closed_world

## 1. Purpose

canStartFirstCompile(input) is the platform admission gate that decides whether the first executable session may be compiled.

It exists to ensure that the first compile only starts after all v0 platform and Phase 1 prerequisites are satisfied.

The gate may only return allowed or blocked.

The gate must not modify Phase 1 input, enrich Phase 1 input, infer missing values, alter engine legality, alter engine output, read coach notes as engine input, read payment state inside the engine, or allow unknown state.

Payment, access, and workspace state may control admission to the compile action. They must not alter compiled engine output.

Coach relationship metadata may control whether coach-managed compile is admitted. It must not alter compiled engine output.

## 2. v0 Scope

This gate applies only to Kolosseum v0.

Supported execution scopes:

- individual
- coach_managed

Supported activities:

- powerlifting
- rugby_union
- general_strength

Supported engine compatibility:

- EB2-1.0.0

Supported Phase 1 schema version:

- kolosseum.master.phase1.input.schema.v1_0_1

Anything outside the supported v0 scope fails closed.

## 3. Gate Function

canStartFirstCompile(input: FirstCompileGateInput): FirstCompileGateResult

The function is pure and deterministic.

Given identical input, it must return identical output.

The function performs platform admission checks only. It does not call the engine. It does not generate a session. It does not compile.

## 4. Input Contract

TypeScript contract:

    type FirstCompileGateInput = {
      paymentAccess: PaymentAccessStatus;
      workspace: WorkspaceStatus;
      coachAccount: AccountStatus | "not_required";
      athleteAccount: AccountStatus;
      coachAthleteLink: CoachAthleteLinkStatus | "not_required";
      scopeLock: ScopeLockStatus;
      phase1Declaration: Phase1DeclarationAdmission;
      activity: ActivityAdmission;
      engineCompatibility: EngineCompatibilityAdmission;
      compileStatus: CompileStatus;
    };

## 5. Blocked Reason Enum

The closed blocked reason enum is:

    type FirstCompileBlockedReason =
      | "payment_missing"
      | "workspace_missing"
      | "coach_missing"
      | "athlete_missing"
      | "link_not_accepted"
      | "scope_not_locked"
      | "phase1_missing"
      | "phase1_invalid"
      | "phase1_refused"
      | "compile_failed"
      | "unsupported_scope"
      | "unsupported_activity"
      | "version_mismatch";

No other blocked reasons are valid for S31.

## 6. Gate Inputs

The gate accepts:

- payment/access status
- workspace status
- coach account status
- athlete account status
- coach-athlete link status when coach_managed
- scope lock
- accepted Phase 1 declaration
- declaration schema/version pins
- activity validity
- engine compatibility
- compile status

## 7. Evaluation Order

The gate evaluates checks in this fixed order:

1. payment/access status
2. workspace status
3. Phase 1 declaration existence/status
4. declaration version pins
5. execution scope support
6. activity support
7. engine compatibility
8. athlete account status
9. coach account status when coach_managed
10. coach-athlete link when coach_managed
11. scope lock
12. compile status

The first failing check determines the returned blockedReason.

## 8. Unknown State Rule

Unknown state fails closed.

Examples:

- unknown payment status -> payment_missing
- unknown workspace status -> workspace_missing
- unknown coach account status under coach-managed scope -> coach_missing
- unknown athlete status -> athlete_missing
- unknown coach-athlete link status under coach-managed scope -> link_not_accepted
- unknown Phase 1 status -> phase1_invalid
- unknown activity -> unsupported_activity
- unknown engine compatibility -> version_mismatch
- unknown compile status -> compile_failed

## 9. Engine Neutrality Rules

canStartFirstCompile() must not pass payment state to the engine.

canStartFirstCompile() must not pass coach account status to the engine.

canStartFirstCompile() must not pass coach-athlete link metadata to the engine.

canStartFirstCompile() must not pass workspace metadata to the engine.

The only lawful engine input remains the accepted Phase 1 declaration and canonical downstream artefacts.

## 10. Payment Neutrality Acceptance Rule

Payment/access state may cause admission refusal.

Payment/access state must not change compiled output.

Required test:

- same valid engine input
- payment active versus payment missing
- engine compile must not run when payment missing
- when compile is run with identical accepted Phase 1 input, output identity must not include payment state
- payment status must not appear in the engine input payload

## 11. Coach Metadata Neutrality Acceptance Rule

Coach metadata may cause admission refusal for coach-managed execution.

Coach metadata must not change compiled output.

Required test:

- same accepted Phase 1 input
- different coach account IDs or link IDs
- same accepted link status
- gate result remains allowed
- engine input projection remains byte-identical
- coach metadata must not appear in the engine input payload

## 12. Pilot State Machine Integration

The first compile gate sits between Phase 1 Accepted and Compilation Passed.

Pilot state integration:

| Gate Result | Pilot State Effect |
|---|---|
| allowed | transition from compile_pending to compile attempt |
| blocked: payment_missing | Blocked — Commercial |
| blocked: workspace_missing | Blocked — Platform |
| blocked: coach_missing | Blocked — Platform |
| blocked: athlete_missing | Blocked — Platform |
| blocked: link_not_accepted | Blocked — Platform |
| blocked: scope_not_locked | Blocked — Declaration |
| blocked: phase1_missing | Phase 1 Pending |
| blocked: phase1_invalid | Blocked — Declaration |
| blocked: phase1_refused | Blocked — Declaration |
| blocked: compile_failed | Blocked — Compile |
| blocked: unsupported_scope | Blocked — Declaration |
| blocked: unsupported_activity | Blocked — Declaration |
| blocked: version_mismatch | Blocked — Compile |

The pilot state machine may store the blocked reason for operator visibility.

The engine must not receive the blocked reason as a control input.

## 13. Negative Test Requirements

The following cases must return blocked:

1. missing payment/access
2. missing workspace
3. missing coach for coach-managed execution
4. missing athlete
5. non-accepted coach-athlete link for coach-managed execution
6. missing scope lock
7. missing Phase 1 declaration
8. invalid Phase 1 declaration
9. refused Phase 1 declaration
10. unsupported execution scope
11. unsupported activity
12. version mismatch
13. compile already failed
14. compile already running
15. compile already succeeded
16. unknown state in any required field

## 14. Positive Test Requirements

The valid individual case returns allowed when payment/access is active, workspace is active, athlete is active, coach is not required, coach-athlete link is not required, scope is locked, Phase 1 is accepted, declaration schema/version pins are valid, execution scope is individual, activity is supported, engine compatibility is exact, and compile status is not_started.

The valid coach-managed case returns allowed when payment/access is active, workspace is active, coach is active, athlete is active, coach-athlete link is accepted, scope is locked, Phase 1 is accepted, declaration schema/version pins are valid, execution scope is coach_managed, activity is supported, engine compatibility is exact, and compile status is not_started.

## 15. Final Rule

If canStartFirstCompile() cannot prove all prerequisites explicitly, it must return blocked.

No inference.

No default admission.

No engine mutation.

No payment-to-output coupling.

No coach-metadata-to-output coupling.