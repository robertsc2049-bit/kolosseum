param([switch]$Ci)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== Engine Health Check ==="

if ($env:KOLOSSEUM_ENGINE_HEALTH_RUNNING -eq "1") {
  throw "Engine health script re-entered (recursion). Aborting."
}
$env:KOLOSSEUM_ENGINE_HEALTH_RUNNING = "1"

try {
  # Resolve real executables (Application only; take first path)
  $gitCmd  = Get-Command git  -CommandType Application -ErrorAction Stop | Select-Object -First 1
  $npmCmd  = Get-Command npm  -CommandType Application -ErrorAction Stop | Select-Object -First 1
  $nodeCmd = Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1

  $git  = $gitCmd.Path
  $npm  = $npmCmd.Path
  $node = $nodeCmd.Path

  if (-not $git)  { throw "Could not resolve git executable path" }
  if (-not $npm)  { throw "Could not resolve npm executable path" }
  if (-not $node) { throw "Could not resolve node executable path" }

  Write-Host "git : $git"
  Write-Host "npm : $npm"
  Write-Host "node: $node"

  $root = & $git rev-parse --show-toplevel
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($root)) { throw "Not a git repo (rev-parse failed)" }
  $root = $root.Trim()
  Set-Location $root

  Write-Host "Repo root: $root"
  Write-Host ("Mode: " + ($(if ($Ci) { "CI" } else { "LOCAL" })))

  Write-Host ""
  Write-Host "=== Working Tree ==="
  if (-not $Ci) {
    $porcelain = & $git status --porcelain
    if ($LASTEXITCODE -ne 0) { throw "git status failed" }
    if (-not [string]::IsNullOrWhiteSpace($porcelain)) { throw "Working tree not clean:`n$porcelain" }
    Write-Host "OK: working tree clean"
  } else {
    Write-Host "SKIP: clean working tree (CI mode)"
  }

  Write-Host ""
  Write-Host "=== Preconditions ==="
  if ($Ci) {
    if (-not (Test-Path -LiteralPath "ci/scripts/e2e_golden.mjs")) { throw "Required file missing: ci/scripts/e2e_golden.mjs" }
    if (-not (Test-Path -LiteralPath "examples/hello_world.json")) { throw "Required file missing: examples/hello_world.json" }
    Write-Host "OK: required golden + example present"
  } else {
    Write-Host "LOCAL: preconditions not enforced"
  }

  Write-Host ""
  Write-Host "=== Dependencies ==="
  if ($Ci -and (Test-Path -LiteralPath "package-lock.json")) {
    & $npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed ($LASTEXITCODE)" }
  } else {
    & $npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed ($LASTEXITCODE)" }
  }

  Write-Host ""
  Write-Host "=== Build ==="
  & $npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed ($LASTEXITCODE)" }

  Write-Host ""
  Write-Host "=== Guards + Tests ==="
  & $npm run lint
  if ($LASTEXITCODE -ne 0) { throw "npm run lint failed ($LASTEXITCODE)" }

  Write-Host ""
  Write-Host "=== Golden ==="
  if (-not (Test-Path -LiteralPath "ci/scripts/e2e_golden.mjs")) { throw "Required file missing: ci/scripts/e2e_golden.mjs" }
  & $node "ci/scripts/e2e_golden.mjs"
  if ($LASTEXITCODE -ne 0) { throw "golden check failed ($LASTEXITCODE)" }

  Write-Host ""
  Write-Host "=== Smoke ==="
  if (-not (Test-Path -LiteralPath "dist/src/run_pipeline_cli.js")) { throw "Required file missing: dist/src/run_pipeline_cli.js" }
  if (-not (Test-Path -LiteralPath "examples/hello_world.json")) { throw "Required file missing: examples/hello_world.json" }
  & $node "dist/src/run_pipeline_cli.js" "examples/hello_world.json"
  if ($LASTEXITCODE -ne 0) { throw "smoke run failed ($LASTEXITCODE)" }

  Write-Host ""
  Write-Host "=== DONE ==="
  Write-Host "OK: Engine health: GREEN"
}
finally {
  $env:KOLOSSEUM_ENGINE_HEALTH_RUNNING = "0"
}
