param(
  [string]$DbUrl = "postgres://postgres:KolosseumPgPass_2026%21@localhost:5432/kolosseum",
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

# repo root
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path) | Out-Null
Set-Location .. | Out-Null

$env:DATABASE_URL = $DbUrl
$env:PORT = "$Port"

npm run build
if ($LASTEXITCODE -ne 0) { throw "build failed" }

node .\dist\src\server.js
