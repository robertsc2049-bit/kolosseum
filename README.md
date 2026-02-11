# Kolosseum

## How to validate changes

Run the full local green gate:

- npm run green

CI runs the CI-parity green gate:

- npm run green:ci

## Dev workflow (authoritative)

This repo has **one supported way** to run checks.

- **Fast local checks (default):**
```
npm run green:local
```

- **Pre-PR / CI parity checks:**
```
npm run green:pr
```

### Rules
- `green:*` commands enforce repo hygiene and CI guardrails.
- If a guard fails, **fix the guard failure**. Do not bypass it.
- Directly invoking lower-level scripts (`lint:fast`, `test:unit`, etc.) is for debugging only.
## Canonical local check

Run this manually when you want a single authoritative “is the repo green?” signal:

```bash
npm run green:dev
```

Do not run random scripts. If you need a green signal, run `npm run green:dev`.

This is the fastest strict chain (via `green:fast`): lint:fast + unit tests + build:fast, with BASE_SHA/HEAD_SHA exported for diff-aware guards.
