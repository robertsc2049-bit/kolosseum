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
    "fixtures"
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
  if ($maybe -and (Test-Path -LiteralPath $maybe)) { return (Resolve-Path -LiteralPath $maybe).Path }

  $hits = Find-VanillaMinimal
  if ($hits.Count -gt 0) { return $hits[0].FullName }

  throw "No default fixture found. Pass -Fixture <path>."
}

$fixturePath = Pick-Fixture $Fixture

Write-Host "== engine demo =="
Write-Host "fixture: $fixturePath"
Write-Host ""

npm run build:fast

$runner = "dist/src/run_pipeline.js"
if (-not (Test-Path -LiteralPath $runner)) {
  throw "Missing $runner. build:fast should produce it."
}

# Load fixture JSON (jsonc/txt not supported yet—enforce json)
if (-not ($fixturePath.ToLower().EndsWith(".json"))) {
  throw "Fixture must be .json for now. Pass a .json fixture via -Fixture."
}

# Execute via Node, but require dist using an absolute path (temp script runs from %TEMP%)
$node = @"
const fs = require("fs");
const path = require("path");

(async () => {
  const fixturePath = process.argv[2];
  const input = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

  const runnerPath = path.join(process.cwd(), "dist", "src", "run_pipeline.js");
  const mod = require(runnerPath);
  const fn = mod.runPipeline || (mod.default && mod.default.runPipeline);

  if (!fn) {
    console.error("Missing export: runPipeline in " + runnerPath);
    process.exit(2);
  }

  const out = await fn(input);
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
})().catch((e) => {
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
"@

$tmp = Join-Path $env:TEMP ("kolosseum_engine_demo_" + [Guid]::NewGuid().ToString("N") + ".cjs")
[System.IO.File]::WriteAllText($tmp, $node, (New-Object System.Text.UTF8Encoding($false)))

try {
  node $tmp $fixturePath
} finally {
  Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
}