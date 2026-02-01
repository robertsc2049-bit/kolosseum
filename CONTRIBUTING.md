## Mandatory Checks (No Exceptions)

This repository enforces strict invariants.

Before any commit or push:
- `ci/guards/repo_contract.mjs` MUST pass
- `npm run lint` MUST pass

Local hooks are provided for convenience.
CI is authoritative.

Commits pushed with `--no-verify` that fail CI will not be merged.

If CI fails, the fix is required — not optional.
