param(
  [string]$Base = "http://[::1]:3000"
)

Write-Host "Base: $Base"

$h = Invoke-RestMethod "$Base/health"
if (-not $h.ok) { throw "Health failed" }

# Create a block (phase1_input is placeholder for now)
$blockResp = Invoke-RestMethod -Method Post `
  -Uri "$Base/blocks" `
  -ContentType "application/json" `
  -Body (@{
    engine_version = "EB2-1.0.0"
    phase1_input   = @{ demo = "phase1_placeholder" }
  } | ConvertTo-Json -Depth 50)

$blockId = $blockResp.block_id
Write-Host "block_id: $blockId"

# Create a session for the block (planned_session drives runtime now)
$sessionResp = Invoke-RestMethod -Method Post `
  -Uri "$Base/blocks/$blockId/sessions" `
  -ContentType "application/json" `
  -Body (@{
    planned_session = @{
      status    = "ready"
      exercises = @(
        @{ exercise_id = "ex_demo_1"; source = "program" }
        @{ exercise_id = "ex_demo_2"; source = "program" }
      )
      notes = @()
    }
  } | ConvertTo-Json -Depth 50)

$sessionId = $sessionResp.session_id
Write-Host "session_id: $sessionId"

# Start
Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/start" | Out-Null

# COMPLETE ex_demo_1
$body = @{ event = @{ type="COMPLETE_EXERCISE"; exercise_id="ex_demo_1" } } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null

# SPLIT then RETURN_CONTINUE (keeps remaining)
$body = @{ event = @{ type="SPLIT_SESSION" } } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null

$body = @{ event = @{ type="RETURN_CONTINUE" } } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null

# State
$state = Invoke-RestMethod "$Base/sessions/$sessionId/state"
$state | ConvertTo-Json -Depth 50
