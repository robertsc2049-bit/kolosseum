# LOCKFILE_CHANGE_NOTE.md

## Reason

S31 adds Vitest as a development dependency because the first compile gate includes executable TypeScript test vectors.

## Lockfile impact

package-lock.json changed only to record the Vitest development dependency tree required for:

- npm run test:s31:first-compile-gate

## Runtime impact

None.

Vitest is test tooling only. It does not alter engine behaviour, compile admission logic, Phase 1 input, deterministic output, registry loading, payment/access semantics, or coach metadata boundaries.

## Validation

- npm run test:s31:first-compile-gate
- npm run green:fast