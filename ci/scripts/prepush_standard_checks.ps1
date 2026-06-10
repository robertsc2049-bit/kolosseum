
# DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
# deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
# failure output readable for PowerShell and CI users.

param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repo = (git rev-parse --show-toplevel).Trim()
if (-not $repo) { throw "prepush_standard_checks: git rev-parse --show-toplevel failed." }
Set-Location $repo

if (-not (Test-Path -LiteralPath ".\scripts\standard-checks.ps1")) {
  throw "prepush_standard_checks: missing scripts/standard-checks.ps1"
}

# Must stay cheap: standard checks include gh run list + origin canonicalization.
& .\scripts\standard-checks.ps1 -SkipGreenFast
