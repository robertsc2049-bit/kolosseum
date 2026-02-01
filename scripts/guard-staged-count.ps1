param(
  [int]$Max = 20
)

$ErrorActionPreference = "Stop"

# Allow bypass for intentionally large changesets.
# Usage (PowerShell):
#   $env:ALLOW_LARGE_STAGE="1"; git commit -m "..."
#   Remove-Item Env:\ALLOW_LARGE_STAGE -ErrorAction SilentlyContinue
$allow = $env:ALLOW_LARGE_STAGE
if ($allow -eq "1" -or $allow -eq "true" -or $allow -eq "TRUE") {
  Write-Host "⚠️  staged-count guard bypassed via ALLOW_LARGE_STAGE=$allow" -ForegroundColor Yellow
  exit 0
}

$staged = git diff --cached --name-only
$count = @($staged).Count

if ($count -gt $Max) {
  Write-Host "❌ Too many staged files ($count) for a normal commit. Max allowed: $Max" -ForegroundColor Red
  Write-Host "Staged files:" -ForegroundColor Yellow
  $staged | ForEach-Object { "  $_" }
  Write-Host ""
  Write-Host "If this is intentional, bypass once with:" -ForegroundColor Cyan
  Write-Host '  $env:ALLOW_LARGE_STAGE="1"; git commit -m "<msg>"; Remove-Item Env:\ALLOW_LARGE_STAGE' -ForegroundColor Cyan
  exit 1
}

Write-Host "✅ Staged file count OK ($count <= $Max)" -ForegroundColor Green