param(
  [int]$Max = 20
)

$staged = git diff --cached --name-only
$count = @($staged).Count

if ($count -gt $Max) {
  Write-Host "❌ Too many staged files ($count) for a normal commit. Max allowed: $Max" -ForegroundColor Red
  Write-Host "Staged files:" -ForegroundColor Yellow
  $staged | ForEach-Object { "  $_" }
  Write-Host ""
  Write-Host "If this is intentional, re-run commit after setting: `$env:ALLOW_LARGE_STAGE=1" -ForegroundColor Cyan
  exit 1
}

Write-Host "✅ Staged file count OK ($count <= $Max)" -ForegroundColor Green
