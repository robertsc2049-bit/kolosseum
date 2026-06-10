param(
  [Parameter(Mandatory=$true, Position=0, ValueFromPipeline=$true, ValueFromPipelineByPropertyName=$true)]
  [Alias("FullName")]
  [string]$Path,

  [switch]$MustExist
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  $r = (git rev-parse --show-toplevel 2>$null)
  if (-not $r) { throw "Resolve-RepoPath: not inside a git repo (git rev-parse failed)." }
  return $r.Trim()
}

function Normalize-Abs([string]$p) {
  # GetFullPath normalizes .. and returns an absolute path
  return [System.IO.Path]::GetFullPath($p)
}

$repo = Get-RepoRoot
$repoAbs = Normalize-Abs $repo

# Join relative paths to repo root
if ([System.IO.Path]::IsPathRooted($Path)) {
  $abs = Normalize-Abs $Path
} else {
  $abs = Normalize-Abs (Join-Path $repoAbs $Path)
}

# Enforce "inside repo"
# Use case-insensitive comparison on Windows.
$repoPrefix = $repoAbs.TrimEnd('\') + '\'
$absNorm = $abs.TrimEnd('\') + '\'
if (-not $absNorm.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Resolve-RepoPath: path escapes repo. repo='$repoAbs' path='$abs'"
}

# Optional existence check
if ($MustExist -and -not (Test-Path -LiteralPath $abs)) {
  throw "Resolve-RepoPath: path does not exist: $abs"
}

# Emit absolute path (no trailing slash)
$abs.TrimEnd('\')
