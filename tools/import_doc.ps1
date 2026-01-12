param(
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][string]$DestName
)

$repoRoot = (Get-Location).Path
$docsDir = Join-Path $repoRoot "docs"
$destPath = Join-Path $docsDir $DestName

if (!(Test-Path $docsDir)) { throw "docs folder missing: $docsDir" }
if (!(Test-Path $Source)) { throw "source file not found: $Source" }

Copy-Item -Force $Source $destPath

Write-Host "Copied -> $destPath"

npm run hash:write | Out-Host
npm run lint | Out-Host

Write-Host "OK: imported + checksums + lint passed"
