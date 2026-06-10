# @law: Repo Governance
# @severity: medium
# @scope: repo

# DEV NOTE: Legacy constraint shell guard. This Bash entrypoint blocks deprecated
# constraint keys from reappearing in repo-authored source surfaces. It is a small
# shell wrapper around text search only; the canonical JavaScript guard owns the
# more precise allowlist-based legacy constraint proof.
#!/usr/bin/env bash
set -euo pipefail

# DEV NOTE: Resolve the repo root relative to this guard file so the script can be
# invoked from any working directory without accidentally scanning the caller's
# current folder.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# DEV NOTE: Pattern contains legacy keys that must not exist again in live repo
# surfaces. Keep this list narrow; broad matching here can create noisy failures,
# while the JavaScript guard covers the fuller canonical legacy-key set.
PATTERN='banned_equipment_ids|available_equipment_ids'

echo "Checking for legacy constraint keys..."
echo "Root: ${ROOT}"

# DEV NOTE: Prefer ripgrep when available because it is faster and has clear glob
# exclusion support. The scan excludes generated/dependency surfaces so build
# output and installed packages do not satisfy or fail the source contract.
if command -v rg >/dev/null 2>&1; then
  if rg -n "${PATTERN}" "${ROOT}" \
    --glob '!dist/**' \
    --glob '!node_modules/**' \
    --glob '!**/*.map' \
    --hidden; then
    echo ""
    echo "❌ Legacy constraint keys found. Replace with canonical keys:"
    echo "   - banned_equipment"
    echo "   - available_equipment"
    exit 1
  fi
else
  # DEV NOTE: grep fallback keeps the guard usable on minimal environments where
  # ripgrep is unavailable. Keep exclusions aligned with the rg path above.
  if grep -RInE "${PATTERN}" "${ROOT}" \
    --exclude-dir=dist \
    --exclude-dir=node_modules \
    --exclude='*.map'; then
    echo ""
    echo "❌ Legacy constraint keys found. Replace with canonical keys:"
    echo "   - banned_equipment"
    echo "   - available_equipment"
    exit 1
  fi
fi

# DEV NOTE: Success means the shell search did not find the listed legacy keys in
# scanned repo surfaces. It does not validate the full constraint schema or replace
# the canonical JavaScript legacy-constraint guard.
echo "✅ Constraint key guard passed"
