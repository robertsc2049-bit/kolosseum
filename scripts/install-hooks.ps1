param()

$ErrorActionPreference = "Stop"

function Write-Utf8NoBomLf {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Text
  )
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $lf = $Text -replace "`r`n", "`n"
  $lf = $lf -replace "`r", "`n"
  if (-not $lf.EndsWith("`n")) { $lf += "`n" }
  [System.IO.File]::WriteAllText($Path, $lf, [System.Text.UTF8Encoding]::new($false))
}

$repo = (git rev-parse --show-toplevel).Trim()
if (-not $repo) { throw "git rev-parse --show-toplevel failed." }
Set-Location $repo

$hookDir = Join-Path $repo ".git\hooks"
if (-not (Test-Path -LiteralPath $hookDir)) { throw "Missing .git\hooks (is this a git repo?)" }

$hookPath = Join-Path $hookDir "pre-push.cmd"

$hookText = @"
@echo off
setlocal

echo [pre-push] smart dispatcher
node ci\scripts\prepush_smart.mjs
if errorlevel 1 exit /b 1

echo [pre-push] OK
exit /b 0
"@

Write-Utf8NoBomLf -Path $hookPath -Text $hookText

Write-Host "OK: installed .git\hooks\pre-push.cmd -> single owner dispatcher" -ForegroundColor Green
