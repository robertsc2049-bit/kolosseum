# scripts/Write-Utf8NoBomLf.ps1
# Writes UTF-8 (no BOM) with LF-only line endings.
# Usage:
#   .\scripts\Write-Utf8NoBomLf.ps1 -Path "LOCKFILE_CHANGE_NOTE.md" -Text "hello`n"
#   .\scripts\Write-Utf8NoBomLf.ps1 -Path "LOCKFILE_CHANGE_NOTE.md" -Append -Text "more`n"

[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [string]$Path,

  [Parameter(Mandatory=$true)]
  [string]$Text,

  [switch]$Append
)

$ErrorActionPreference = "Stop"

function Normalize-ToLf([string]$s) {
  $s = $s -replace "`r`n", "`n"
  $s = $s -replace "`r", "`n"
  return $s
}

# Resolve absolute path (create parent dir if needed)
$resolved = Resolve-Path -LiteralPath $Path -ErrorAction SilentlyContinue
if ($null -eq $resolved) {
  $absPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Path))
} else {
  $absPath = $resolved.Path
}

$dir = Split-Path -Parent $absPath
if ($dir -and -not (Test-Path -LiteralPath $dir)) {
  New-Item -ItemType Directory -Path $dir | Out-Null
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$out = Normalize-ToLf $Text

if ($Append -and (Test-Path -LiteralPath $absPath)) {
  $existing = Get-Content -Raw -LiteralPath $absPath
  $existing = Normalize-ToLf $existing
  [System.IO.File]::WriteAllText($absPath, ($existing + $out), $utf8NoBom)
} else {
  [System.IO.File]::WriteAllText($absPath, $out, $utf8NoBom)
}

# Hard assert: file contains no CR
$probe = Get-Content -Raw -LiteralPath $absPath
if ($probe -match "`r") {
  throw "Write-Utf8NoBomLf: CRLF/CR detected after write (should be LF-only): $absPath"
}