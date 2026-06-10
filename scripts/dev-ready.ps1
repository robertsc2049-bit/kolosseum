param(
  [switch]$RunGreen
)

$ErrorActionPreference = "Stop"

function Sh([string]$Cmd) {
  $out = & cmd /c "$Cmd 2>&1"
  $code = $LASTEXITCODE
  if ($code -ne 0) { throw "Command failed ($code): $Cmd`n$out" }
  return ($out | ForEach-Object { $_.ToString() })
}

# Must run from repo root.
if (-not (Test-Path -LiteralPath ".\package.json")) { throw "Not in repo root (package.json missing)." }

$repo = (git rev-parse --show-toplevel).Trim()
if (-not $repo) { throw "git rev-parse --show-toplevel failed." }
Set-Location $repo

$branch = (git rev-parse --abbrev-ref HEAD).Trim()

$up = ""
try { $up = (git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null).Trim() } catch { $up = "" }

$porcelain = git status --porcelain=v1 --untracked-files=normal
$clean = (-not $porcelain)

Write-Host "== Dev Ready Check =="
Write-Host ("branch:   {0}" -f $branch)
Write-Host ("upstream: {0}" -f ($(if ($up) { $up } else { "<none>" } )))
Write-Host ("tree:     {0}" -f ($(if ($clean) { "CLEAN" } else { "DIRTY" } )))

if (-not $up) {
  Write-Host "RESULT: NOT READY (no upstream). Fix: git push -u origin HEAD"
  exit 2
}

if (-not $clean) {
  Write-Host "RESULT: NOT READY (working tree dirty). Fix: stage/commit or git restore -- ."
  exit 2
}

$head = (git rev-parse HEAD).Trim()
$base = (git merge-base HEAD $up).Trim()

Write-Host ("BASE_SHA: {0}" -f $base)
Write-Host ("HEAD_SHA: {0}" -f $head)

if ($RunGreen) {
  Write-Host "running: npm run green"
  $env:BASE_SHA = $base
  $env:HEAD_SHA = $head
  try {
    Sh "npm run green" | ForEach-Object { $_ }
    Write-Host "RESULT: READY (green passed)"
  } finally {
    Remove-Item Env:BASE_SHA, Env:HEAD_SHA -ErrorAction SilentlyContinue
  }
} else {
  Write-Host "RESULT: READY (structural checks passed)."
  Write-Host "Tip: npm run dev:ready:green  (runs green with BASE/HEAD set)"
}