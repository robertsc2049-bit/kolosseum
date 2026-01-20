param(
  [string]$Base = "http://[::1]:3000"
)

$ErrorActionPreference = "Stop"

function Must([bool]$ok, [string]$msg) {
  if (-not $ok) { throw $msg }
}

# Pick a working base URL
try { Invoke-RestMethod "$Base/health" | Out-Null }
catch { $Base = "http://127.0.0.1:3000"; Invoke-RestMethod "$Base/health" | Out-Null }

Write-Host "Base: $Base"

# ---------- 1) Create block ----------
$blockBodyObj = @{
  engine_version     = "EB2-1.0.0"
  canonical_hash     = "demo_hash"
  phase1_input       = @{}
  phase2_canonical   = @{}
  phase3_output      = @{}
  phase4_program     = @{}
  phase5_adjustments = @()
}

$blockBody = $blockBodyObj | ConvertTo-Json -Depth 50 -Compress
# sanity check locally before POST
Must ($blockBody -match '"canonical_hash"\s*:\s*"demo_hash"') "BUG: canonical_hash missing from JSON payload"

$blockResp = Invoke-RestMethod -Method Post `
  -Uri "$Base/blocks" `
  -ContentType "application/json" `
  -Body $blockBody

Must ($null -ne $blockResp.block_id -and $blockResp.block_id.Length -gt 0) "Create block failed: no block_id returned"

$blockId = $blockResp.block_id
Write-Host "block_id: $blockId"

# ---------- 2) Create session from block ----------
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

$sessionResp = Invoke-RestMethod -Method Post `
  -Uri "$Base/blocks/$blockId/sessions" `
  -ContentType "application/json" `
  -Body $planned

Must ($null -ne $sessionResp.session_id -and $sessionResp.session_id.Length -gt 0) "Create session failed: no session_id returned"

$sessionId = $sessionResp.session_id
Write-Host "session_id: $sessionId"

# ---------- 3) Start session ----------
Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/start" | Out-Null

# ---------- 4) Events ----------
$body = @{ event = @{ type="COMPLETE_EXERCISE"; exercise_id="ex_demo_1" } } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null

$body = @{ event = @{ type="SPLIT_SESSION" } } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null

$body = @{ event = @{ type="RETURN_CONTINUE" } } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null

# ---------- 5) State ----------
Invoke-RestMethod "$Base/sessions/$sessionId/state" | ConvertTo-Json -Depth 50
