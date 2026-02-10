param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$Path,

  [Parameter(Mandatory=$true, Position=1)]
  [AllowEmptyString()]
  [string]$Text,

  # If set, the target file must already exist (prevents accidental new files).
  [switch]$MustExist,

  # If set, create the parent directory if missing.
  # Default behavior is to FAIL if parent is missing (safer against typos).
  [switch]$CreateParent
)

$ErrorActionPreference = "Stop"

# Locate sibling helpers reliably.
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolve = Join-Path $here "Resolve-RepoPath.ps1"
$writeLf = Join-Path $here "Write-Utf8NoBomLf.ps1"

if (-not (Test-Path -LiteralPath $resolve)) { throw "Write-RepoFile: missing helper: $resolve" }
if (-not (Test-Path -LiteralPath $writeLf)) { throw "Write-RepoFile: missing helper: $writeLf" }

# Resolve to absolute repo-rooted path; optionally enforce existence.
$abs = & $resolve $Path -MustExist:$MustExist

# Parent dir policy: default fail, opt-in create.
$parent = Split-Path -Parent $abs
if (-not $parent) { throw "Write-RepoFile: cannot determine parent directory for: $abs" }

if (-not (Test-Path -LiteralPath $parent)) {
  if ($CreateParent) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  } else {
    throw "Write-RepoFile: parent directory does not exist: $parent (use -CreateParent to allow mkdir)"
  }
}

# Always write UTF-8 no BOM + LF (delegate to canonical helper).
& $writeLf -Path $abs -Text $Text | Out-Null

# Emit absolute path (useful for piping / logs).
$abs
