#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Keys that must never exist again.
PATTERN='banned_equipment_ids|available_equipment_ids'

echo "Checking for legacy constraint keys..."
echo "Root: ${ROOT}"

# Search only the repo-relevant sources (expand later if needed)
# Exclude dist/ and node_modules/ because those are build artifacts.
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
  # Fallback to grep if ripgrep isn't available.
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

echo "✅ Constraint key guard passed"
