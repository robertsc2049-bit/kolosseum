param(
  [int]$Max = 40,
  [string]$BaseRef = "origin/main"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Allow bypass for intentionally large push changesets.
# Usage:
#   $env:ALLOW_LARGE_PUSH="1"; git push; Remove-Item Env:\ALLOW_LARGE_PUSH -ErrorAction SilentlyContinue
$allow = $env:ALLOW_LARGE_PUSH
if ($allow -eq "1" -or $allow -eq "true" -or $allow -eq "TRUE") {
  Write-Host "⚠️  push changeset guard bypassed via ALLOW_LARGE_PUSH=$allow" -ForegroundColor Yellow
  exit 0
}

function Has-Ref([string]$ref) {
  git show-ref --verify --quiet "refs/remotes/$ref" 2>$null
  return ($LASTEXITCODE -eq 0)
}

# Ensure base ref exists locally (pre-push should normally have up-to-date refs, but don't assume)
if (-not (Has-Ref "origin/main")) {
  git fetch --prune origin | Out-Null
}

# Count file changes in what you're about to push compared to base
$files = git diff --name-only "$BaseRef..HEAD"
$count = @($files).Count

if ($count -gt $Max) {
  Write-Host "❌ Too many changed files to push ($count). Max allowed: $Max" -ForegroundColor Red
  Write-Host "Base: $BaseRef" -ForegroundColor Yellow
  Write-Host "Changed files:" -ForegroundColor Yellow
  $files | ForEach-Object { "  $_" }
  Write-Host ""
  Write-Host "If this is intentional, bypass once with:" -ForegroundColor Cyan
  Write-Host '  $env:ALLOW_LARGE_PUSH="1"; git push; Remove-Item Env:\ALLOW_LARGE_PUSH' -ForegroundColor Cyan
  exit 1
}

Write-Host "✅ Push changeset size OK ($count <= $Max) vs $BaseRef" -ForegroundColor Green
