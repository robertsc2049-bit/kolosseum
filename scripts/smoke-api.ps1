param(
  [string]$Base = "http://[::1]:3000"
)

Write-Host "Base: $Base"

# health
$h = Invoke-RestMethod "$Base/health"
if (-not $h.ok) { throw "Health failed" }

# create
$resp = Invoke-RestMethod -Method Post `
  -Uri "$Base/sessions" `
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

$sessionId = $resp.session_id
Write-Host "session_id: $sessionId"

# start
Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/start" | Out-Null

# events
$body = @{ event = @{ type="COMPLETE_EXERCISE"; exercise_id="ex_demo_1" } } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null

$body = @{ event = @{ type="SPLIT_SESSION" } } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null

$body = @{ event = @{ type="RETURN_CONTINUE" } } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null

# state
$state = Invoke-RestMethod "$Base/sessions/$sessionId/state"
$state | ConvertTo-Json -Depth 50
