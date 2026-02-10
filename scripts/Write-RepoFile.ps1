param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$Path,

  [Parameter(Mandatory=$true, Position=1)]
  [AllowEmptyString()]
  [string]$Text,

  # If set, the target file must already exist.
  [switch]$MustExist,

  # If set, create the parent directory if missing.
  [switch]$CreateParent
)

$ErrorActionPreference = "Stop"

function Normalize-Lf([string]$s) {
  return ($s -replace "`r`n", "`n") -replace "`r", "`n"
}

# Resolve path to repo-rooted absolute path; reject escapes.
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolve = Join-Path $here "Resolve-RepoPath.ps1"
if (-not (Test-Path -LiteralPath $resolve)) { throw "Write-RepoFile: missing helper: $resolve" }

$abs = if ($MustExist) { & $resolve -Path $Path -MustExist } else { & $resolve -Path $Path }

# Parent policy
$parent = Split-Path -Parent $abs
if (-not $parent) { throw "Write-RepoFile: cannot determine parent for: $abs" }

if (-not (Test-Path -LiteralPath $parent)) {
  if ($CreateParent) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  } else {
    throw "Write-RepoFile: parent directory missing (refusing). parent='$parent' path='$abs'"
  }
}

# MustExist policy (after resolve, to keep error message clean)
if ($MustExist -and -not (Test-Path -LiteralPath $abs)) {
  throw "Write-RepoFile: target does not exist (-MustExist set): $abs"
}

# Write UTF-8 no BOM + LF only
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($abs, (Normalize-Lf $Text), $utf8NoBom)

# Emit absolute path for callers
$abs