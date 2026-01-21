param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"

function Find-RepoRoot {
  $p = (Get-Location).Path
  while ($true) {
    if (Test-Path (Join-Path $p ".git")) { return $p }
    $parent = Split-Path -Parent $p
    if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $p) { break }
    $p = $parent
  }
  throw "Not inside a git repo (could not find .git). cd into the repo root and retry."
}

$repoRoot = Find-RepoRoot
Set-Location $repoRoot

# Ensure Git uses repo hooks
git config core.hooksPath .git/hooks | Out-Null

$hookDir  = Join-Path $repoRoot ".git/hooks"
$hookPath = Join-Path $hookDir "pre-push"

if (-not (Test-Path $hookDir)) {
  New-Item -ItemType Directory -Path $hookDir | Out-Null
}

if ((Test-Path $hookPath) -and (-not $Force)) {
  Write-Host "[install-hooks] pre-push already exists. Use -Force to overwrite."
  exit 0
}

# IMPORTANT: single-quoted here-string => PowerShell will NOT expand $?, $rc
$hook = @'
#!/usr/bin/env sh
# pre-push: schema drift guard (local throwaway DB)

echo "[pre-push] schema check"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/schema-check.ps1 -Quiet
rc=$?
if [ "$rc" -ne 0 ]; then
  echo "[pre-push] schema check FAILED (exit=$rc)"
  exit "$rc"
fi
echo "[pre-push] OK"
exit 0
'@

# Write LF only (sh is happier). UTF-8 no BOM.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($hookPath, ($hook -replace "`r`n","`n"), $utf8NoBom)

Write-Host "[install-hooks] installed: .git/hooks/pre-push"
