# MINIMAL COACH ONBOARDING PACK

Document ID: minimal_coach_onboarding_pack  
Version: 1.0.0  
Status: Draft slice proof  
Scope: Active v0 only  
Rewrite policy: rewrite-only

## Purpose

This document defines the minimum truthful onboarding pack for a coach account or operator entering the active v0 product.

The pack exists to:
- onboard a coach truthfully
- stay commercially usable
- avoid bloated prompts
- map every onboarding step to a current live surface or a current manual operator step

## Active v0 scope lock

Minimal coach onboarding in active v0 is locked to:
- actor_type `coach`
- execution_scope `coach_managed`
- product tier `coach_16`
- assign within system limits
- view factual execution artefacts
- write non-binding coach notes

Minimal coach onboarding MUST NOT imply or require:
- replay access
- evidence access
- registry access
- legality override
- substitution authority
- progression authority
- Phase-1 edit authority
- organisation runtime setup
- team runtime setup
- dashboards
- messaging
- analytics
- readiness scoring
- medical or safety intake

## Binding onboarding sequence

The onboarding pack contains exactly seven steps.

### Step 1 — accept platform legal gate
Type: manual_operator_step or current live auth gate

Purpose:
- confirm access begins behind an explicit legal/terms boundary

### Step 2 — create coach platform identity
Type: live_surface

Purpose:
- create the coach operator account
- capture only identity/contact fields required for account creation

### Step 3 — apply coach role
Type: manual_operator_step

Purpose:
- assign the `coach` role explicitly
- role must not be inferred

### Step 4 — apply coach product entitlement
Type: manual_operator_step

Purpose:
- apply tier `coach_16`
- entitlement controls access only
- entitlement does not grant engine authority

### Step 5 — establish explicit coach-athlete link
Type: manual_operator_step or live_surface

Purpose:
- create an explicit coach-to-athlete relationship
- no implied or inferred relationships are permitted

### Step 6 — confirm active coach surfaces
Type: live_surface

Purpose:
- confirm the coach can access only:
  - assign within system limits
  - view factual execution artefacts
  - write non-binding coach notes

### Step 7 — first lawful coach-managed run entry
Type: live_surface

Purpose:
- enter the first lawful coach-managed path using current v0 surfaces only
- this step must remain a minimal route into current truth capture, not a broad profile interview

## Minimal data rule

Coach onboarding must stay minimal.

Allowed onboarding prompts are limited to:
- account identity fields required to create access
- role and entitlement assignment fields handled manually where needed
- explicit coach-athlete link identifiers
- first-run fields already required by current v0 declaration flow

Coach onboarding MUST NOT collect:
- injury history
- diagnoses
- treatment history
- rehab history
- safety preferences
- readiness questionnaires
- suitability questions
- optimisation goals
- broad coaching philosophy fields
- biography fields for engine use
- outcome promises
- organisation structure data beyond the current manual operator need

## No-bloat rule

The onboarding pack must stay commercially usable.

The pack fails if:
- any extra onboarding step is added
- any onboarding step has no mapped live surface or manual operator step
- any live onboarding step exceeds three prompts
- total live onboarding prompts exceed eight
- any prompt introduces future-scope product surfaces
- any prompt introduces medical, safety, readiness, suitability, optimisation, or compliance semantics

## Required current live surfaces and manual operator steps

Allowed live surfaces:
- `coach_account_create`
- `coach_surface_confirmation`
- `phase1_onboarding_form`

Allowed manual operator steps:
- `legal_gate_acceptance_recorded`
- `coach_role_assignment`
- `coach_16_entitlement_assignment`
- `coach_athlete_link_create`

## Canonical minimal commercial summary

Use only this value frame:

- create coach access
- assign coach role
- apply coach_16 access
- link coach to athlete explicitly
- confirm current coach surfaces
- start first lawful coach-managed run

## Final rule

If coach onboarding asks for more than active v0 requires to create access, link coach to athlete, confirm the live coach surface, and enter the first lawful coach-managed run path, it must fail.