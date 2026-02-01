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