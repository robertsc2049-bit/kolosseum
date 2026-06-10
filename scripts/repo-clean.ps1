
# DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
# deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
# failure output readable for PowerShell and CI users.

param(
  [switch]$Hard
)

$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path) | Out-Null
Set-Location .. | Out-Null

Write-Host "== Repo clean =="

# Always safe-clean untracked and build outputs, but preserve env files.
# -Hard additionally resets tracked files.
if ($Hard) {
  Write-Host "Hard reset tracked files..."
  git reset --hard
}

Write-Host "Clean untracked (preserving .env*)..."
git clean -xfd -e .env -e .env.*

Write-Host "OK"
