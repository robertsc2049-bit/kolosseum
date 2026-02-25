param(
  [string]$Fixture = ""
)

$ErrorActionPreference = "Stop"

function Pick-Fixture([string]$maybe) {
  if ($maybe -and (Test-Path -LiteralPath $maybe)) { return $maybe }

  $candidates = @(
    "test/fixtures/vanilla_minimal.json",
    "ci/fixtures/vanilla_minimal.json",
    "test/fixtures/vanilla_minimal.jsonc",
    "ci/fixtures/vanilla_minimal.jsonc",
    "test/fixtures/vanilla_minimal.txt",
    "ci/fixtures/vanilla_minimal.txt"
  )

  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath $c) { return $c }
  }

  throw "No default fixture found. Pass -Fixture <path>. Tried: $($candidates -join ', ')"
}

$fixturePath = Pick-Fixture $Fixture

Write-Host "== engine demo =="
Write-Host "fixture: $fixturePath"
Write-Host ""

# Build deterministic dist (fast)
npm run build:fast

# Prefer the file-based CLI runner you just merged in
$cli = "dist/src/run_pipeline_cli_file.js"
if (-not (Test-Path -LiteralPath $cli)) {
  throw "Missing $cli. build:fast should produce it. If it moved, update this script once and we're done."
}

node $cli --in $fixturePath