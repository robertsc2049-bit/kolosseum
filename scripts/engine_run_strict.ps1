$ErrorActionPreference = "Stop"

function Die([string]$Msg, [int]$Code = 1) {
  Write-Error $Msg
  exit $Code
}

# Resolve repo root (works from any CWD)
try {
  $repo = (& git rev-parse --show-toplevel).Trim()
  if (-not $repo) { throw "empty repo root" }
} catch {
  Die "engine_run_strict.ps1: failed to resolve repo root via git rev-parse --show-toplevel. Run inside a git repo." 1
}

Set-Location $repo

# Strict clean-tree mode for this process + children
$env:KOLOSSEUM_CLEAN_TREE_STRICT = "1"

# Build fast then run hello_world fixture
& npm run build:fast
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& node scripts/run_pipeline_cli_file.mjs --in examples/hello_world.json
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

exit 0