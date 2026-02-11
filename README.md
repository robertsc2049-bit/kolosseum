# Kolosseum

## How to validate changes

Run this manually when you want a single authoritative verification signal:

```bash
npm run verify
```

## Dev workflow (authoritative)

This repo has **one supported way** to run checks.

- **Fast local checks (default):**
```
npm run verify
```

- **Pre-PR / CI parity checks:**
```
npm run verify
```

### Rules
- `verify` commands enforce repo hygiene and CI guardrails.
- If a guard fails, **fix the guard failure**. Do not bypass it.
- Directly invoking lower-level scripts (`lint:fast`, `test:unit`, etc.) is for debugging only.

## Canonical local check

Run this manually when you want a single authoritative verification signal:

```bash
npm run verify
```

Do not run random scripts. If you need a verification signal, run `npm run verify`.
