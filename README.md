![Engine Status](https://github.com/robertsc2049-bit/kolusseum/actions/workflows/engine-status.yml/badge.svg)

# Kolosseum

## How to validate changes

Use the canonical green chain before committing or pushing:

```bash
npm run green
```

What it runs (fast -> slow):

- `npm run lint:fast`
- `npm run test:unit`
- `npm run build:fast`
- `npm run dev:fast`

Rules:
- Must start CLEAN and end CLEAN (no dirty tree after running checks).
- If `package-lock.json` changes, you must also add `LOCKFILE_CHANGE_NOTE.md` (LF-only) and stage both.
