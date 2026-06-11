# V0 Canonical JSON and Hash Stability Proof

Status: active v0 release record.
Slice: S-V0-04 Canonical JSON and Hash Stability Proof.

## DEV NOTE: purpose

This record documents the S-V0-04 canonical JSON and hash stability proof.

The proof does not change canonicalisation semantics. It records the discovered canonical/hash source surface, adds a guard around stable identity behaviour, and checks repeat execution so future drift is caught before v0 release.

## DEV NOTE: primary source candidate

Primary canonical/hash source candidate:

- engine/session/firstExecutableSessionStub.ts

The full candidate list is recorded in:

- ci/contracts/v0_canonical_json_hash_stability_contract.json

## DEV NOTE: boundary invariant

Canonical JSON and SHA/hash behaviour define v0 identity.

The identity path must not depend on timestamps, random values, locale-specific formatting, environment-specific paths, filesystem location, object insertion order, or hidden runtime state.

Identical v0 inputs must produce identical canonical bytes and identical hash values. Equivalent object key ordering must produce the same canonical bytes and hash. Different values must produce different canonical bytes and hash.

## DEV NOTE: failure behaviour

The guard at ci/scripts/run_v0_canonical_json_hash_stability_guard.mjs fails when:

- canonical/hash source files disappear
- a temporary generated script is recorded as a source
- key ordering is unstable
- arrays are reordered
- nested objects are not canonicalised recursively
- explicit null handling drifts
- strings, numbers, or booleans drift
- repeated execution produces different canonical bytes or hash values

Do not fix a failure by updating golden values casually. A changed canonical output is a release-boundary decision.

## Completion condition

S-V0-04 is complete only when:

- canonical/hash source files are located
- the contract JSON exists
- the guard script exists
- the guard passes
- all required repo gates pass
- the working tree is clean
- local main is pushed to origin/main after successful gates
