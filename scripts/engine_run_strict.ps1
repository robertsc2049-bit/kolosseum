$ErrorActionPreference = "Stop"

function Die([string]$Msg, [int]$Code = 1) {
  Write-Error $Msg
  exit $Code
}

function Require-Tool([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Die "engine_run_strict.ps1: required tool not found on PATH: $Name" 1
  }

  $src = ""
  try { $src = $cmd.Source } catch { $src = "" }
  if (-not $src) {
    try { $src = $cmd.Path } catch { $src = "" }
  }
  if (-not $src) { $src = "<unknown>" }

  Write-Host ("TOOL: {0} => {1}" -f $Name, $src)
}

# ---- tooling sanity (fail fast + print paths) ----
Require-Tool "git"
Require-Tool "npm"
Require-Tool "node"

# Resolve repo root (works from any CWD)
try {
  $repo = (& git rev-parse --show-toplevel).Trim()
  if (-not $repo) { throw "empty repo root" }
} catch {
  Die "engine_run_strict.ps1: failed to resolve repo root via git rev-parse --show-toplevel. Run inside a git repo." 1
}

Set-Location $repo

# ---- version stamps (debugging without guessing) ----
& git --version
& node --version
& npm --version

# ---- repo sanity (avoid running in the wrong folder) ----
if (-not (Test-Path -LiteralPath ".\package.json")) { Die "engine_run_strict.ps1: package.json missing at repo root: $repo" 1 }
if (-not (Test-Path -LiteralPath ".\scripts\run_pipeline_cli_file.mjs")) { Die "engine_run_strict.ps1: scripts/run_pipeline_cli_file.mjs missing at repo root: $repo" 1 }
if (-not (Test-Path -LiteralPath ".\examples\hello_world.json")) { Die "engine_run_strict.ps1: examples/hello_world.json missing at repo root: $repo" 1 }

# Strict clean-tree mode for this process + children
$env:KOLOSSEUM_CLEAN_TREE_STRICT = "1"

# Build fast then run hello_world fixture
& npm run build:fast
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& node scripts/run_pipeline_cli_file.mjs --in examples/hello_world.json
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

exit 0