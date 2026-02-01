[CmdletBinding()]
param(
  [switch]$Ci
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section([string]$title) {
  Write-Host ""
  Write-Host "=== $title ==="
}

function Exec([string]$file, [string[]]$args) {
  & $file @args
  if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $file $($args -join ' ')" }
}

function Npm([string[]]$args) { Exec "npm" $args }
function Node([string[]]$args) { Exec "node" $args }
function Git([string[]]$args) { Exec "git" $args }

function Get-RepoRoot() {
  $root = & git rev-parse --show-toplevel
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($root)) {
    throw "Not a git repository (git rev-parse failed)."
  }
  return $root.Trim()
}

function Assert-CleanWorkingTree() {
  $status = & git status --porcelain
  if ($LASTEXITCODE -ne 0) { throw "git status failed" }
  if (-not [string]::IsNullOrWhiteSpace($status)) {
    throw "Working tree not clean. Commit/stash changes first.`n$status"
  }
  Write-Host "OK: working tree clean"
}

function Assert-GitBlob-NoCRLF([string]$repoPath) {
  $text = & git show ("HEAD:" + $repoPath)
  if ($LASTEXITCODE -ne 0) { throw "git show failed for: $repoPath" }
  if ($text.Contains("`r")) { throw "CRLF in Git blob: $repoPath" }
  Write-Host "OK (blob): LF-only: $repoPath"
}

function Assert-GitBlob-NoBOM([string]$repoPath) {
  $raw = & git show ("HEAD:" + $repoPath)
  if ($LASTEXITCODE -ne 0) { throw "git show failed for: $repoPath" }
  if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) { throw "UTF-8 BOM in Git blob: $repoPath" }
  Write-Host "OK (blob): no BOM: $repoPath"
}

function Assert-IfExists([string]$repoPath, [scriptblock]$check) {
  & git cat-file -e ("HEAD:" + $repoPath) 2>$null
  if ($LASTEXITCODE -eq 0) {
    & $check
  } else {
    Write-Host "SKIP (missing in HEAD): $repoPath"
  }
}

function Show-GitEolConfig() {
  $autocrlf = & git config --get core.autocrlf
  $eol      = & git config --get core.eol
  $safecrlf = & git config --get core.safecrlf

  Write-Host ("core.autocrlf = " + ($autocrlf | ForEach-Object { $_ } | Select-Object -First 1))
  Write-Host ("core.eol      = " + ($eol      | ForEach-Object { $_ } | Select-Object -First 1))
  Write-Host ("core.safecrlf = " + ($safecrlf | ForEach-Object { $_ } | Select-Object -First 1))
}

function Install-Dependencies() {
  $hasLock = Test-Path -LiteralPath (Join-Path $PWD "package-lock.json")
  if ($Ci -and $hasLock) {
    Npm @("ci")
  } else {
    Npm @("install")
  }
}

function Require-Path([string]$path, [string]$why) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Required file missing: $path ($why)"
  }
  Write-Host "OK: required present: $path"
}

function Require-RepoFile([string]$relativePath, [string]$why) {
  Require-Path (Join-Path $PWD $relativePath) $why
}

function Run-Golden-Required() {
  $golden = Join-Path $PWD "ci/scripts/e2e_golden.mjs"
  Require-Path $golden "CI requires golden verification script"
  Write-Host "Running golden verification: ci/scripts/e2e_golden.mjs"
  Node @($golden)
}

function Run-Smoke-Required() {
  $cli = Join-Path $PWD "dist/src/run_pipeline_cli.js"
  $example = Join-Path $PWD "examples/hello_world.json"

  Require-Path $example "CI requires examples/hello_world.json"

  # Note: dist CLI is expected to exist after build
  Require-Path $cli "CI requires built CLI at dist/src/run_pipeline_cli.js (build artifact)"

  Write-Host "Running pipeline CLI smoke: examples/hello_world.json"
  Node @($cli, $example)
}

function Run-Golden-Optional() {
  $golden = Join-Path $PWD "ci/scripts/e2e_golden.mjs"
  if (Test-Path -LiteralPath $golden) {
    Write-Host "Running golden verification: ci/scripts/e2e_golden.mjs"
    Node @($golden)
  } else {
    Write-Host "SKIP golden: missing ci/scripts/e2e_golden.mjs"
  }
}

function Run-Smoke-Optional() {
  $cli = Join-Path $PWD "dist/src/run_pipeline_cli.js"
  $example = Join-Path $PWD "examples/hello_world.json"

  if ((Test-Path -LiteralPath $cli) -and (Test-Path -LiteralPath $example)) {
    Write-Host "Running pipeline CLI smoke: examples/hello_world.json"
    Node @($cli, $example)
  } else {
    Write-Host "SKIP smoke: missing dist CLI or examples/hello_world.json"
  }
}

Write-Section "Engine Status Check"

$root = Get-RepoRoot
Set-Location $root

Write-Host "Repo root: $root"
Write-Host ("Mode: " + ($(if ($Ci) { "CI" } else { "LOCAL" })))

Write-Section "Working Tree"
if (-not $Ci) {
  Assert-CleanWorkingTree
} else {
  Write-Host "SKIP: clean working tree requirement in CI mode"
}

Write-Section "Blob Truth: Encoding + EOL"
Assert-IfExists ".gitattributes" { Assert-GitBlob-NoCRLF ".gitattributes"; Assert-GitBlob-NoBOM ".gitattributes" }
Assert-IfExists "scripts/install-hooks.ps1" { Assert-GitBlob-NoCRLF "scripts/install-hooks.ps1"; Assert-GitBlob-NoBOM "scripts/install-hooks.ps1" }
Assert-IfExists "scripts/hooks/pre-commit" { Assert-GitBlob-NoCRLF "scripts/hooks/pre-commit"; Assert-GitBlob-NoBOM "scripts/hooks/pre-commit" }
Assert-IfExists "scripts/hooks/pre-push" { Assert-GitBlob-NoCRLF "scripts/hooks/pre-push"; Assert-GitBlob-NoBOM "scripts/hooks/pre-push" }

Write-Section "Git EOL Config"
Show-GitEolConfig

Write-Section "Dependencies"
Install-Dependencies

Write-Section "Preconditions (CI-required artifacts)"
if ($Ci) {
  Require-RepoFile "ci/scripts/e2e_golden.mjs" "golden verification must exist"
  Require-RepoFile "examples/hello_world.json" "smoke example must exist"
}

Write-Section "Build"
Npm @("run", "build")

Write-Section "Guards + Lint + Tests (authoritative engine gates)"
# Your npm run lint runs guards + npm run test:ci
Npm @("run", "lint")

Write-Section "Golden + Smoke"
if ($Ci) {
  Run-Golden-Required
  Run-Smoke-Required
} else {
  Run-Golden-Optional
  Run-Smoke-Optional
}

Write-Section "DONE"
Write-Host "✅ Engine status: GREEN"