# Kolosseum Engine Contract (Phase1 → Phase6)

This document defines the **contractual guarantees** for the deterministic engine spine and its CI runners.
If you change behaviour covered here, you must treat it as an **API/contract change** and update fixtures/goldens intentionally.

---

## Goals

The engine must be:

- **Deterministic**: identical inputs produce identical outputs (including ordering, stable ids, stable notes strings where specified).
- **Schema-driven**: Phase1 validates/normalizes; downstream phases consume canonical forms.
- **Composable**: phases can be run independently in tests but are stable end-to-end.
- **Safety-first**: constraints and substitution logic preserve safety and intent.

---

## Canonical spine

### Phase 1 — Validate + Canonicalize
**Input:** user/runner payload (JSON)  
**Output:** canonical input shape (engine-authoritative)

Guarantees:
- Rejects legacy constraint keys (enforced by guards/tests).
- Produces a canonical structure used as the “fingerprint” for downstream phases.
- Runner-only flags MUST NOT leak into Phase1 (see Runner Flags).

### Phase 2 — Deterministic derived fields
**Input:** Phase1 canonical  
**Output:** deterministic canonical augmentation  
Guarantees:
- Hash/derived values are deterministic.

### Phase 3 — Constraints resolution (authoritative)
**Input:** Phase2 canonical  
**Output:** authoritative constraints model  
Guarantees:
- Constraints precedence rules are deterministic.
- Registry loading is deterministic and versioned (`registry_index_version` present).
- Output must be stable for identical canonical input.

### Phase 4 — Program assembly (v0 contract)
**Input:** Phase2 canonical + Phase3 output  
**Output:** a minimal substitutable program surface

Guarantees (v0):
- Produces a **multi-exercise plan** for supported activities (>=2 planned ids).
- Emits deterministic:
  - `planned_items` (authoritative rich plan surface)
  - `planned_exercise_ids` (legacy plan surface)
  - `exercise_pool` + `exercises` (candidate pool for substitution scoring)
  - `target_exercise_id` (selection hint for Phase5)
- Carries Phase3 constraints on `program.constraints`.

### Phase 5 — Adjustments (substitution envelope)
**Input:** Phase4 program  
**Output:** **envelope** `{ ok:true, adjustments:[...], notes?:[...] }`

Guarantees:
- Envelope must be preserved as an envelope into Phase6 (do not unwrap into raw arrays).
- Substitution decisions must be deterministic for identical inputs.
- Adjustments use structured shapes (e.g. `adjustment_id: "SUBSTITUTE_EXERCISE"`).

### Phase 6 — Session emission (API-stable v1)
**Input:** Phase4 program + Phase1 canonical input + Phase5 envelope  
**Output:** session output envelope `{ ok:true, session:{...}, notes:[...] }`

Guarantees:
- Output is parseable JSON.
- `session.status` is `"ready"`.
- The session is built from the program plan surface with deterministic ordering and dedupe rules.

#### Phase6 plan precedence (authoritative)
1. `program.planned_items` (rich)
2. `program.planned_exercise_ids` (legacy)
3. `program.exercises[]` (legacy fallback)
4. empty plan → stub session

#### Phase6 stub contract
If the plan is empty (after substitution + dedupe), Phase6 must return exactly:

- `session.session_id = "SESSION_STUB"`
- `session.exercises = []`
- `notes = ["PHASE_6_STUB: deterministic empty session shell"]`

This stub is used by fixtures and must not change without intentional contract migration.

#### Phase6 non-empty contract
If the plan is non-empty:

- `session.session_id = "SESSION_V1"`
- `session.exercises` contains one entry per **UNIQUE** final planned exercise id (stable dedupe).
- Each exercise entry includes:
  - `exercise_id` (final id after substitution)
  - `source: "program"`
  - plus optional prescription metadata where available (`block_id`, `item_id`, `sets`, `reps`, `intensity`, `rest_seconds`)
  - `substituted_from` when a Phase5 substitution was applied

Notes:
- Notes strings are treated as part of the **golden output**. If you change them, you are changing the contract snapshots.

---

## Runner Flags (must never reach Phase1)

Runner-only flags exist only for tooling (CI/dev ergonomics). They must be stripped before Phase1 validation.

Current runner-only flags:
- `debug_render_session_text: boolean`

Behaviour:
- If `debug_render_session_text === true`, the runner may attach:
  - `rendered_text: string[]`
- If false or absent, `rendered_text` MUST NOT appear.

---

## CLI runner contract (`dist/src/run_pipeline_cli.js`)

Purpose:
- Provide a stable CI/dev entrypoint that prints JSON only.

Guarantees:
- **stdout is always JSON** (pretty printed is OK).
- If an error occurs, stdout prints a JSON failure object:
  - `{ ok:false, error:"..." }`
- Exit code may be non-zero on failures, but stdout must remain parseable JSON.

---

## Determinism rules (non-negotiable)

For identical inputs:
- output JSON must be equivalent byte-for-byte after stable formatting (pretty printed in runner).
- arrays must be emitted in stable deterministic order.
- any dedupe must be stable (first occurrence wins).
- registry-derived data must be read in deterministic index order.

---

## What counts as a contract change

You must treat these as contract changes (and update goldens intentionally):
- Phase6 stub notes string, session_id, or schema shape changes
- Exercise emission ordering or dedupe behaviour changes
- Any notes strings included in golden outputs
- Runner output keys that appear/disappear (e.g. adding fields without a flag)
- Any change that modifies `e2e:golden` hashes

---

## Golden snapshots policy

`npm run e2e:golden` compares fixture outputs to expected snapshots via sha256.

Rules:
- If snapshots differ: **assume regression first**.
- Only update goldens when you have a deliberate contract change:
  - `UPDATE_GOLDEN=1 npm run e2e:golden`

Never “update to make it pass” without understanding the behavioural change.

---

## Versioning policy

- Engine changes that alter behaviour covered by this contract should be grouped and documented.
- If we need breaking changes, we create a new explicit contract version (e.g. Phase6 v2) rather than silently mutating v1.
