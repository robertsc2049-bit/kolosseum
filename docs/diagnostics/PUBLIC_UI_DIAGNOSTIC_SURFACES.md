<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# PUBLIC UI DIAGNOSTIC SURFACES

## Status

Diagnostic-only.

The files listed here are retained for explicit local inspection of factual API and runtime behaviour. They are not part of the active v0 application flow and do not define engine, API, registry, CI, or commercial authority.

## Covered files

- `public/session.html`
- `public/session.js`
- `public/session.css`
- `public/decision-summary.html`
- `public/decision-summary.js`
- `public/decision-summary.css`
- `public/v0-session-runner.html`
- `public/v0-session-runner.js`

## Route boundary

The `/ui/*` routes are disabled by default.

They may only be enabled locally with:

`KOLOSSEUM_ENABLE_DIAGNOSTIC_UI=true`

This flag controls only whether the diagnostic files are reachable over HTTP. It must not affect engine inputs, engine outputs, compilation, session execution, registry loading, or CI checks.

## Handling rule

Do not expand these files during engine, schema, registry, API, or CI slices.

Future work may either keep them fenced for local inspection or remove them once no local workflow depends on them.
