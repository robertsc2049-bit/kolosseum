param(
  [string]$Base
)

$ErrorActionPreference = "Stop"

if (-not $Base) {
  $Base = "http://[::1]:3000"
  try { Invoke-RestMethod "$Base/health" | Out-Null }
  catch { $Base = "http://127.0.0.1:3000" }
}

Write-Host "Base: $Base"

function Must([bool]$ok, [string]$msg) {
  if (-not $ok) { throw $msg }
}

# health
$h = Invoke-RestMethod "$Base/health"
Must ($h.ok -eq $true) "Health failed"

# 1) Create block (minimal persisted shell is fine for runtime smoke)
$canon = "smoke_" + ([guid]::NewGuid().ToString("N"))

$blockBodyObj = @{
  engine_version     = "EB2-1.0.0"
  canonical_hash     = $canon
  phase1_input       = @{}
  phase2_canonical   = @{}
  phase3_output      = @{}
  phase4_program     = @{}
  phase5_adjustments = @()
}

$blockBody = $blockBodyObj | ConvertTo-Json -Depth 50 -Compress
$blockResp = Invoke-RestMethod -Method Post -Uri "$Base/blocks" -ContentType "application/json" -Body $blockBody
$blockId = $blockResp.block_id
Must ($null -ne $blockId -and $blockId.Length -gt 0) "Create block failed: no block_id"
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

# 3) Start
Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/start" | Out-Null

# 4) Events
$body = @{ event = @{ type="COMPLETE_EXERCISE"; exercise_id="ex_demo_1" } } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null

$body = @{ event = @{ type="SPLIT_SESSION" } } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null

$body = @{ event = @{ type="RETURN_CONTINUE" } } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null

# 5) State
Invoke-RestMethod "$Base/sessions/$sessionId/state" | ConvertTo-Json -Depth 50
