param(
  [Parameter(Mandatory=$false)]
  [string]$BaseRef = "origin/main",

  [Parameter(Mandatory=$false)]
  [int]$Max = 250
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Die([string]$msg) {
  Write-Host ("[pre-push] " + $msg) -ForegroundColor Red
  exit 1
}

function Info([string]$msg) {
  Write-Host ("[pre-push] " + $msg)
}

function Ok([string]$msg) {
  Write-Host ("[pre-push] " + $msg) -ForegroundColor Green
}

# Ensure we are in a git repo
try {
  git rev-parse --is-inside-work-tree *> $null
} catch {
  Die "Not inside a git work tree."
}

# Make sure BaseRef exists (local or remote)
$baseOk = $true
try { git rev-parse --verify "$BaseRef^{commit}" *> $null } catch { $baseOk = $false }

if (-not $baseOk) {
  # Attempt to fetch the ref if it is remote-like
  try { git fetch --prune *> $null } catch {}
  try { git rev-parse --verify "$BaseRef^{commit}" *> $null } catch {
    Die ("BaseRef not found: {0}" -f $BaseRef)
  }
}

# Count changed files between BaseRef and HEAD (merge-base aware via ...)
[string[]]$files = @()
try {
  $files = git diff --name-only "$BaseRef...HEAD"
} catch {
  Die ("Failed to compute diff vs {0}" -f $BaseRef)
}

# Normalize
$files = $files | Where-Object { $_ -and $_.Trim().Length -gt 0 }
$count = @($files).Count

Info ("Push changeset file count = {0}; max = {1}; base = {2}" -f $count, $Max, $BaseRef)

if ($count -gt $Max) {
  Die ("Push changeset too large ({0} > {1}) vs {2}. Split the branch or raise Max deliberately." -f $count, $Max, $BaseRef)
}

Ok ("Push changeset size OK ({0} <= {1}) vs {2}" -f $count, $Max, $BaseRef)
exit 0
