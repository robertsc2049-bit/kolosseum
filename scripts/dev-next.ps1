param(
  [switch]$Full
)

$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path) | Out-Null
Set-Location .. | Out-Null

Write-Host "== dev:next =="

$branch = (git branch --show-current).Trim()
Write-Host "branch: $branch"

$last = (git log -1 --oneline).Trim()
Write-Host "last:   $last"

Write-Host ""
Write-Host "status:"
git status --short

Write-Host ""
Write-Host "diff:summary:"
node ci/scripts/diff_summary.mjs

if ($Full) {
  Write-Host ""
  Write-Host "running: npm run dev:fast"
  npm run dev:fast
}