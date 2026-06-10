param(
  [string]$Base = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"

function Must([bool]$ok, [string]$msg) { if (-not $ok) { throw $msg } }
function SleepMs([int]$ms) { Start-Sleep -Milliseconds $ms }

function Wait-Health([string]$base, [int]$timeoutSec = 20, [int]$pollMs = 250) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-RestMethod -Method Get -Uri "$base/health" -TimeoutSec 2 | Out-Null
      return
    } catch {
      SleepMs $pollMs
    }
  }
  throw "Health did not return 200 within ${timeoutSec}s: $base/health"
}

function Find-Phase1SchemaFile() {
  $candidates = @("engine","src","dist","ci","registry","registries","schema","schemas") |
    ForEach-Object { Join-Path (Get-Location) $_ } |
    Where-Object { Test-Path -LiteralPath $_ }

  foreach ($root in $candidates) {
    $hit = Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue |
      Select-String -Pattern '"phase1_schema_version"' -List -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($hit -and $hit.Path) { return $hit.Path }
  }

  $hit2 = Get-ChildItem -LiteralPath (Get-Location) -Recurse -File -ErrorAction SilentlyContinue |
    Select-String -Pattern '"phase1_schema_version"' -List -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($hit2 -and $hit2.Path) { return $hit2.Path }

  throw "Could not locate a Phase1 schema file containing phase1_schema_version."
}

function Get-PrimitiveDefault([object]$propSchema) {
  if ($null -eq $propSchema) { return $null }
  if ($propSchema.const) { return $propSchema.const }
  if ($propSchema.enum -and $propSchema.enum.Count -gt 0) { return $propSchema.enum[0] }

  $t = $propSchema.type
  if ($t -is [System.Array]) { $t = $t[0] }

  switch ($t) {
    "boolean" { return $false }
    "integer" { return 0 }
    "number"  { return 0 }
    "string"  { return "x" }
    default   { return "x" }
  }
}

function Build-Phase1Input() {
  $schemaPath = Find-Phase1SchemaFile
  $raw = [System.IO.File]::ReadAllText($schemaPath, [System.Text.UTF8Encoding]::new($false))
  $schema = $raw | ConvertFrom-Json -Depth 200

  if (-not $schema.properties) { throw "Phase1 schema missing properties: $schemaPath" }

  $required = @()
  if ($schema.required) { $required = @($schema.required) }

  # CLOSED WORLD: only required keys + consent_granted if allowed by schema.
  $p1 = [ordered]@{}

  foreach ($k in $required) {
    $prop = $schema.properties.$k
    if (-not $prop) { throw "Phase1 schema required key '$k' missing from properties: $schemaPath" }
    $p1.$k = (Get-PrimitiveDefault $prop)
  }

  if ($schema.properties.consent_granted) { $p1.consent_granted = $true }

  # Known engine-critical keys: replace placeholder "x" only when schema didn't constrain value.
  $overrides = @{
    activity_id              = "general_strength"
    actor_type               = "athlete"
    execution_scope          = "individual"
    instruction_density      = "standard"
    exposure_prompt_density  = "standard"
    bias_mode                = "variety"
    nd_mode                  = $false
  }

  foreach ($kv in $overrides.GetEnumerator()) {
    $k = $kv.Key
    if ($p1.Contains($k)) {
      if ($p1.$k -is [string] -and $p1.$k -eq "x") { $p1.$k = $kv.Value }
      if ($p1.$k -is [bool]) { $p1.$k = [bool]$kv.Value }
    }
  }

  return $p1
}

Write-Host "Base: $Base"
Wait-Health $Base

$compileUri = "$Base/blocks/compile"
Write-Host "Blocks compile endpoint: $compileUri"

$phase1Input = Build-Phase1Input
$compileReq = [ordered]@{
  phase1_input   = $phase1Input
  runtime_events = @()
}

$body = $compileReq | ConvertTo-Json -Depth 80 -Compress
$resp = Invoke-RestMethod -Method Post -Uri $compileUri -ContentType "application/json" -Body $body -TimeoutSec 30

Must ($null -ne $resp.block_id -and $resp.block_id.Length -gt 0) "Compile failed: no block_id returned"
Must ($null -ne $resp.planned_session) "Compile failed: no planned_session returned"

Write-Host "block_id: $($resp.block_id)"
Write-Host "planned_session.exercises.count: $(@($resp.planned_session.exercises).Count)"