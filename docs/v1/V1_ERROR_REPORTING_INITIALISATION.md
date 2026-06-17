# S-V1-O-02 Error Reporting Initialisation

## Purpose

S-V1-O-02 initialises factual error reporting for controlled launch.

The slice provides local configuration and a sanitised error-event envelope. It does not configure a provider SDK, send reports, or call a monitoring service.

## Boundary

Included:

- error-reporting initialisation contract.
- local stub transport option.
- sanitised product/runtime error event envelope.
- sensitive field redaction.
- engine payload rejection.
- tests and CI guard.
- documentation of data boundaries.

Not included:

- deterministic engine logic.
- engine output mutation.
- training flow mutation.
- declaration truth mutation.
- Phase 1 declaration mutation.
- provider SDK configuration.
- network transport.
- raw request body storage.
- raw stack storage.
- sensitive payload storage.
- user-facing product claim language.

## Invariants

- Error reporting observes product/runtime errors only.
- No engine output mutation.
- Sensitive data boundaries are documented.
- Error reporting does not change compile output.
- Error reporting does not change training flow.
- Error reporting does not change declaration truth.
- Error reporting does not change Phase 1 declaration records.

## Supported event classes

Supported event classes:

- api_handler_error.
- ui_render_error.
- product_runtime_error.
- product_config_error.

Supported severities:

- info.
- warning.
- error.
- fatal.

## Sensitive data boundary

The event envelope redacts known sensitive fields by key.

Examples of redacted keys include:

- email.
- phone.
- address.
- date_of_birth.
- dob.
- token.
- access_token.
- refresh_token.
- authorization.
- cookie.
- session_cookie.
- password.
- secret.
- api_key.
- jwt.
- stripe.
- payment.
- card.
- medical.
- diagnosis.
- injury.
- health.

Raw request bodies are not stored.

Raw stack traces are not stored.

Known sensitive payload values are replaced with `[redacted]`.

## Engine boundary

The implementation does not import engine code.

The deterministic probe is hashed only to prove pass-through invariance.

The surface returns:

- observes_product_runtime_errors_only: true.
- external_provider_enabled: false.
- network_transport_enabled: false.
- provider_call_performed: false.
- error_report_sent: false.
- raw_stack_storage_enabled: false.
- raw_request_body_storage_enabled: false.
- sensitive_payload_storage_enabled: false.
- engine_visible: false.
- engine_truth_changed: false.
- engine_output_mutated: false.
- compile_output_changed: false.
- training_flow_changed: false.
- declaration_truth_changed: false.
- phase1_declaration_changed: false.
- user_facing_claim_language_changed: false.

## Rejected payload fields

The error-reporting envelope rejects payloads that include deterministic engine, training, declaration, session-plan, or substitution payloads.

Rejected examples include:

- engine_input.
- engine_output.
- engine_truth.
- compile_output.
- training_flow.
- declaration_truth.
- phase1_declaration.
- session_plan.
- session_event.
- substitution_selection.

## CI token

- CI_V1_ERROR_REPORTING_INITIALISATION

## Standard proof sequence

Target proof:

- node --test test/s_v1_o_02_error_reporting_initialisation.test.mjs
- node ci/guards/s_v1_o_02_error_reporting_initialisation_guard.mjs

Generated-file proof:

- node ci/scripts/run_failure_token_index_guard.mjs
- node ci/guards/guards_index_guard.mjs
- node ci/scripts/sha256_guard.mjs

Full proof:

- GitHub PR checks run lint:fast and full suites.