param(
  [Parameter(Mandatory=$true)][string]$Js
)

$ErrorActionPreference = "Stop"

# Encode JS as UTF-8 base64 so quotes/newlines survive argument parsing
$b64 = [Convert]::ToBase64String(
  [System.Text.Encoding]::UTF8.GetBytes($Js)
)

# Invoke internal runner and capture stdout
$out = pwsh -NoProfile -ExecutionPolicy Bypass `
  -File (Join-Path $PSScriptRoot "_internal_node_runner.ps1") `
  -JsB64 $b64

# Emit stdout to caller
$out
