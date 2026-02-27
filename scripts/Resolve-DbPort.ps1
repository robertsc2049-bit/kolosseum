param(
  [int]$Preferred = 5432,
  [int]$Fallback = 5433
)

$ErrorActionPreference = "Stop"

function Test-TcpPort([int]$Port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(150)
    if ($ok -and $client.Connected) { $client.EndConnect($iar) | Out-Null; $client.Close(); return $true }
    try { $client.Close() } catch {}
    return $false
  } catch { return $false }
}

# Policy:
# - If Preferred is listening/reachable, we accept it (occupied is fine if it's *our* DB).
# - If not reachable, we use Fallback.
$use = $Preferred
if (-not (Test-TcpPort -Port $Preferred)) { $use = $Fallback }

# Export for current PowerShell session + child processes
$env:KOLOSSEUM_DB_PORT = "$use"

Write-Host "KOLOSSEUM_DB_PORT=$use"
Write-Host "Note: This does NOT stop Postgres. It selects a port for scripts to use."