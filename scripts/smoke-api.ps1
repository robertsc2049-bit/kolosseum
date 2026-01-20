param(
  [string]$Base,
  [ValidateSet("idempotent","fresh")]
  [string]$Mode = "idempotent"
)

$ErrorActionPreference = "Stop"

if (-not $Base) {
  $Base = "http://[::1]:3000"
  try { Invoke-RestMethod "$Base/health" | Out-Null }
  catch { $Base = "http://127.0.0.1:3000" }
}

Write-Host "Base: $Base"
Write-Host "Mode: $Mode"

function Must([bool]$ok, [string]$msg) { if (-not $ok) { throw $msg } }

# health
$h = Invoke-RestMethod "$Base/health"
Must ($h.ok -eq $true) "Health failed"

# 1) Compile block
$phase1 = @{
  consent_granted         = $true
  engine_version          = "EB2-1.0.0"
  enum_bundle_version     = "EB2-1.0.0"
  phase1_schema_version   = "1.0.0"
  actor_type              = "athlete"
  execution_scope         = "individual"
  activity_id             = "powerlifting"
  nd_mode                 = $false
  instruction_density     = "standard"
  exposure_prompt_density = "standard"
  bias_mode               = "variety"
}

$compileBodyObj = @{ phase1_input = $phase1 }

if ($Mode -eq "fresh") {
  $compileBodyObj.canonical_hash = ("smoke_" + ([guid]::NewGuid().ToString("N")))
}

$compileBody = $compileBodyObj | ConvertTo-Json -Depth 50 -Compress
$blockResp = Invoke-RestMethod -Method Post -Uri "$Base/blocks/compile" -ContentType "application/json" -Body $compileBody

$blockId = $blockResp.block_id
Must ($null -ne $blockId -and $blockId.Length -gt 0) "Compile block failed: no block_id"
Write-Host "block_id: $blockId"

# 2) Create session from block
$plannedObj = @{
  planned_session = @{
    status    = "ready"
    exercises = @(
      @{ exercise_id="ex_demo_1"; source="program" }
      @{ exercise_id="ex_demo_2"; source="program" }
    )
    notes = @()
  }
}

$planned = $plannedObj | ConvertTo-Json -Depth 50 -Compress
$sessionResp = Invoke-RestMethod -Method Post -Uri "$Base/blocks/$blockId/sessions" -ContentType "application/json" -Body $planned
$sessionId = $sessionResp.session_id
Must ($null -ne $sessionId -and $sessionId.Length -gt 0) "Create session failed: no session_id"
Write-Host "session_id: $sessionId"

# 3) Start (now persists START_SESSION)
Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/start" | Out-Null

# 4) Events (persisted append-only)
$body = @{ event = @{ type="COMPLETE_EXERCISE"; exercise_id="ex_demo_1" } } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null

$body = @{ event = @{ type="SPLIT_SESSION" } } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null

$body = @{ event = @{ type="RETURN_CONTINUE" } } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null

# 5) Verify events are in DB
$events = Invoke-RestMethod "$Base/sessions/$sessionId/events"
Must ($events.events.Count -ge 4) "Expected >= 4 events persisted (START + 3 runtime)"
Write-Host ("events persisted: " + $events.events.Count)

# 6) State (rebuilt from plan + events)
Invoke-RestMethod "$Base/sessions/$sessionId/state" | ConvertTo-Json -Depth 50


# eol-check

# eol-check

# eol-check
