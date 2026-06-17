# S-V1-L-04 Cookie and Consent Surface

## Purpose

S-V1-L-04 implements the controlled-launch cookie and consent surface.

The surface renders cookie consent copy and records cookie consent state for product/legal presentation only.

## Boundary

Included:

- cookie consent render model.
- cookie consent state record.
- strictly necessary cookie category.
- preference storage category.
- API adapter.
- factual copy IDs.
- tests and CI guard.

Not included:

- deterministic engine behaviour.
- training flow behaviour.
- declaration truth changes.
- Phase 1 declaration consent.
- compile admission logic.
- provider calls.
- external script activation.
- broad reporting surface.

## Invariants

- Cookie consent is presentation/legal state only.
- It cannot alter engine output.
- Copy is factual.
- Cookie consent state does not change compile output.
- Cookie consent state does not change training flow.
- Cookie consent state does not change declaration truth.
- Cookie consent state does not change Phase 1 declaration records.

## Consent states

Supported consent states:

- notice_acknowledged.
- necessary_only.
- necessary_and_preferences.
- withdrawn_to_necessary.

Supported categories:

- strictly_necessary.
- preference_storage.

strictly_necessary is always required.

preference_storage may be selected only with necessary_and_preferences.

## Engine boundary

The implementation does not import engine code.

The deterministic probe is hashed only to prove pass-through invariance.

The surface returns:

- engine_visible: false.
- engine_truth_changed: false.
- compile_output_changed: false.
- training_flow_changed: false.
- declaration_truth_changed: false.
- phase1_declaration_changed: false.
- external_script_activation: false.
- provider_call_performed: false.

## UI/API boundary

GET renders the cookie consent view model.

POST records cookie consent state.

No request mutates deterministic engine truth, training flow, declaration truth, or Phase 1 declaration records.

## CI token

- CI_V1_COOKIE_CONSENT_SURFACE

## Standard proof sequence

Target proof:

- node --test test/s_v1_l_04_cookie_consent_surface.test.mjs
- node ci/guards/s_v1_l_04_cookie_consent_surface_guard.mjs

Generated-file proof:

- node ci/scripts/run_failure_token_index_guard.mjs
- node ci/guards/guards_index_guard.mjs
- node ci/scripts/sha256_guard.mjs

Full proof:

- GitHub PR checks run lint:fast and full suites.