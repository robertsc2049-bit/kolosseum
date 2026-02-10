param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$Path,

  [Parameter(Mandatory=$true, Position=1)]
  [AllowEmptyString()]
  [string]$Text
)

$ErrorActionPreference = "Stop"

function Normalize-Lf([string]$s) {
  return ($s -replace "`r`n", "`n") -replace "`r", "`n"
}

# Resolve to a repo-rooted absolute path and reject escapes.
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolve = Join-Path $here "Resolve-RepoPath.ps1"
if (-not (Test-Path -LiteralPath $resolve)) { throw "Write-Utf8NoBomLf: missing helper: $resolve" }

$abs = & $resolve $Path

# Ensure parent exists (create it) — preserves historical behavior for callers that expect mkdir.
$parent = Split-Path -Parent $abs
if (-not $parent) { throw "Write-Utf8NoBomLf: cannot determine parent for: $abs" }
if (-not (Test-Path -LiteralPath $parent)) {
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
}

# UTF-8 no BOM + LF only
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($abs, (Normalize-Lf $Text), $utf8NoBom)

# Emit the absolute path for convenience
$abs