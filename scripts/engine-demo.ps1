param(
  [string]$Fixture = ""
)

$ErrorActionPreference = "Stop"

function Find-VanillaMinimal {
  $roots = @(
    "test/fixtures",
    "ci/fixtures",
    "test",
    "ci",
    "fixtures",
    "ci/scripts",
    "ci/fixtures",
    "test/fixtures"
  ) | Select-Object -Unique

  $hits = @()

  foreach ($r in $roots) {
    if (-not (Test-Path -LiteralPath $r)) { continue }

    try {
      $found = Get-ChildItem -LiteralPath $r -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
          $_.Name -match 'vanilla[_-]?minimal' -and $_.Extension -match '^\.(json|jsonc|txt)$'
        } |
        Select-Object -First 25

      if ($found) { $hits += $found }
    } catch {}
  }

  # Prefer json/jsonc over txt, and shorter paths (more "canonical")
  $hits = $hits |
    Sort-Object @{
      Expression = { if ($_.Extension -match '\.jsonc?$') { 0 } else { 1 } }
    }, @{
      Expression = { $_.FullName.Length }
    }, @{
      Expression = { $_.FullName }
    } |
    Select-Object -Unique

  return $hits
}

function Pick-Fixture([string]$maybe) {
  if ($maybe -and (Test-Path -LiteralPath $maybe)) { return $maybe }

  $hits = Find-VanillaMinimal
  if ($hits.Count -gt 0) { return $hits[0].FullName }

  throw "No default fixture found. Pass -Fixture <path>. Also ensure a file named like 'vanilla_minimal.*' exists under test/fixtures or ci/fixtures."
}

$fixturePath = Pick-Fixture $Fixture

Write-Host "== engine demo =="
Write-Host "fixture: $fixturePath"
Write-Host ""

npm run build:fast

$cli = "dist/src/run_pipeline_cli_file.js"
if (-not (Test-Path -LiteralPath $cli)) {
  throw "Missing $cli. build:fast should produce it."
}

node $cli --in $fixturePath