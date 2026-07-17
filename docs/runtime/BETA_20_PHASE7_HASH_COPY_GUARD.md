# BETA-20 Phase 7 Hash and Copy Guard

## Status

BETA-20 hardens the BETA-19 factual Phase 7 projection for byte stability and controlled presentation copy.

Phase 7 input remains the closed BETA-18 Phase 6 truth envelope.

No product, coach, payment, organisation, UI, Copy Registry, or presentation state becomes engine truth.

## JSON-only beta format

The beta content-format set is exactly:

`application/json`

PDF is not enabled.

No PDF renderer, browser renderer, canvas dependency, font renderer, system-font dependency, or PDF output is introduced by this slice.

Any future PDF surface must separately pin:

- exact renderer package and version;
- every font by repository path and SHA-256;
- locale;
- timezone;
- deterministic document metadata;
- prohibition of system fonts.

An unpinned PDF, font, or render stack fails closed.

## Canonical rendered bytes

The root rendered section order is fixed as:

1. `projection_metadata`
2. `program_summary`
3. `block_summary`, when present
4. `session_list`
5. `event_digest`

Each section value is canonicalised through the existing beta canonical JSON helper.

The root section order is then serialised explicitly.

Identical admitted Phase 6 truth therefore produces identical UTF-8 `rendered_output` bytes.

## Projection hash

`projection_hash` is SHA-256 over the exact UTF-8 bytes of `rendered_output`.

It does not hash a reconstructed object.

It does not hash presentation copy.

It does not hash product state.

It does not hash coach notes.

Any rendered-byte change changes the projection hash.

Any mismatch emits:

`phase7_projection_hash_mismatch`

## Copy Registry

The factual engine projection contains no user-facing labels or narrative.

Every Phase 7 user-facing label is held in:

`copy/beta_20_phase7_projection_copy.json`

Presentation code receives Copy Registry identifiers only.

The registry controls labels for:

- projection details;
- programme summary;
- block summary;
- sessions;
- event record;
- factual boundary.

Inline copy inside the factual projection or presentation reference descriptor is forbidden.

## Claim boundary

The Phase 7 copy and rendered-output guards reject advisory, recommendation, readiness, safety, suitability, ranking, inference, optimisation, effectiveness, or judgement language.

The factual projection remains identifiers, hashes, recorded status values, booleans, nulls, arrays, and mechanically derived counts only.

## Validation

BETA-20 validation rebuilds the BETA-19 factual projection from admitted Phase 6 truth.

It then:

1. verifies the exact section set;
2. verifies root section ordering;
3. verifies canonical section bytes;
4. rejects inline copy;
5. rejects forbidden claim language;
6. verifies `application/json`;
7. computes SHA-256 directly from rendered UTF-8 bytes;
8. compares the recorded projection hash.

## V0 compatibility

The legacy v0 scope scanner excludes only these exact new BETA-20 engine paths:

`engine/src/phases/beta20Phase7HashCopyGuard.ts`

`engine/contracts/beta20_phase7_render_stack.json`

No directory, wildcard, Phase 7 family, or general engine-contract exclusion is permitted.
