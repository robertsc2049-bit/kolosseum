param(
  [Parameter(Mandatory=$true)][string]$Path,
  [Parameter(Mandatory=$true)][string]$Content
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$resolved = (Resolve-Path $Path).Path
[System.IO.File]::WriteAllText($resolved, $Content, (New-Object System.Text.UTF8Encoding($false)))