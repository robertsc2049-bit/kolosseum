param(
  [string]$DbUrl,
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

# repo root
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path) | Out-Null
Set-Location .. | Out-Null

function Load-DotEnv([string]$Path) {
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0) { return }
    if ($line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $k = $line.Substring(0, $idx).Trim()
    $v = $line.Substring($idx + 1).Trim()
    # strip optional surrounding quotes
    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    if ($k.Length -gt 0) { Set-Item -Path "Env:$k" -Value $v }
  }
}

# Load .env if present (kept out of git)
Load-DotEnv ".\.env"

if (-not $DbUrl) {
  $DbUrl = $env:DATABASE_URL
}

if (-not $DbUrl) {
  throw "DATABASE_URL not set. Provide -DbUrl or set DATABASE_URL (or create .env)."
}

$env:DATABASE_URL = $DbUrl
$env:PORT = "$Port"

npm run build
if ($LASTEXITCODE -ne 0) { throw "build failed" }

node .\dist\src\server.js
