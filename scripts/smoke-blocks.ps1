param(
  [string]$Base = "http://[::1]:3000"
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

function Pick-Base([string]$base) {
  try { Wait-Health $base; return $base } catch { }
  $fallback = "http://127.0.0.1:3000"
  Wait-Health $fallback
  return $fallback
}

function Read-HttpErrorBody([object]$resp) {
  if ($null -eq $resp) { return $null }

  if ($resp -is [System.Net.Http.HttpResponseMessage]) {
    try { return $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult() } catch { return $null }
  }

  try {
    if ($resp.GetResponseStream) {
      $stream = $resp.GetResponseStream()
      if ($stream) {
        $sr = New-Object System.IO.StreamReader($stream)
        return $sr.ReadToEnd()
      }
    }
  } catch { }

  return $null
}

function Invoke-Json([string]$method, [string]$uri, [string]$bodyJson = $null) {
  try {
    if ($null -eq $bodyJson) {
      return Invoke-RestMethod -Method $method -Uri $uri -TimeoutSec 30
    }
    return Invoke-RestMethod -Method $method -Uri $uri -ContentType "application/json" -Body $bodyJson -TimeoutSec 30
  } catch {
    $payload = $null
    try { $payload = Read-HttpErrorBody $_.Exception.Response } catch { }
    if (-not $payload) { try { $payload = Read-HttpErrorBody $_.Exception.ResponseMessage } catch { } }

    if ($payload) {
      Write-Host "---- HTTP ERROR BODY ----"
      Write-Host $payload
      Write-Host "-------------------------"
    }
    throw
  }
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

  # If consent_granted exists, force true (only if allowed).
  if ($schema.properties.consent_granted) { $p1.consent_granted = $true }

  # ---- Critical: override "string" defaults for known engine-critical keys when schema did NOT constrain them. ----
  # Only override if key exists in output (i.e., schema requires it) and it is currently "x" (our generic string default).
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
      # If schema had enum/const we'd already have a valid value; we only stomp the placeholder.
      if ($p1.$k -is [string] -and $p1.$k -eq "x") {
        $p1.$k = $kv.Value
      }
      # If schema typed it boolean but defaulted false, keep false unless override says false anyway.
      if ($p1.$k -is [bool]) {
        $p1.$k = [bool]$kv.Value
      }
    }
  }

  return $p1
}

function Pick-FirstExerciseId([object]$planned_session) {
  if ($null -eq $planned_session) { throw "compile did not return planned_session" }

  $ex = $planned_session.exercises
  if ($null -eq $ex -or -not ($ex -is [System.Array]) -or $ex.Count -lt 1) {
    throw "planned_session.exercises missing/empty from engine"
  }

  $id = $ex[0].exercise_id
  if (-not $id) { throw "planned_session.exercises[0].exercise_id missing" }

  return [string]$id
}

$Base = Pick-Base $Base
Write-Host "Base: $Base"

$compileUri = "$Base/blocks/compile"
Write-Host "Blocks compile endpoint: $compileUri"

# ---------- 1) Compile block (engine is authoritative) ----------
$phase1Input = Build-Phase1Input
$compileReq = [ordered]@{
  phase1_input   = $phase1Input
  runtime_events = @()  # keep empty; smoke adds events after session start
}

$body = $compileReq | ConvertTo-Json -Depth 80 -Compress
$blockResp = Invoke-Json "Post" $compileUri $body

Must ($null -ne $blockResp.block_id -and $blockResp.block_id.Length -gt 0) "Compile block failed: no block_id returned"
Must ($null -ne $blockResp.planned_session) "Compile block failed: no planned_session returned"

$blockId = $blockResp.block_id
Write-Host "block_id: $blockId"

$planned_session = $blockResp.planned_session
$ex1 = Pick-FirstExerciseId $planned_session
Write-Host "Using exercise_id: $ex1"

# ---------- 2) Create session from block using engine-planned session ----------
$plannedObj = @{ planned_session = $planned_session } | ConvertTo-Json -Depth 80 -Compress
$sessionResp = Invoke-Json "Post" "$Base/blocks/$blockId/sessions" $plannedObj

Must ($null -ne $sessionResp.session_id -and $sessionResp.session_id.Length -gt 0) "Create session failed: no session_id returned"
$sessionId = $sessionResp.session_id
Write-Host "session_id: $sessionId"

# ---------- 3) Start session ----------
Invoke-Json "Post" "$Base/sessions/$sessionId/start" | Out-Null

# ---------- 4) Events ----------
$e = @{ event = @{ type="COMPLETE_EXERCISE"; exercise_id=$ex1 } } | ConvertTo-Json -Compress
Invoke-Json "Post" "$Base/sessions/$sessionId/events" $e | Out-Null

$e = @{ event = @{ type="SPLIT_SESSION" } } | ConvertTo-Json -Compress
Invoke-Json "Post" "$Base/sessions/$sessionId/events" $e | Out-Null

$e = @{ event = @{ type="RETURN_CONTINUE" } } | ConvertTo-Json -Compress
Invoke-Json "Post" "$Base/sessions/$sessionId/events" $e | Out-Null

# ---------- 5) State ----------
Invoke-Json "Get" "$Base/sessions/$sessionId/state" | ConvertTo-Json -Depth 80