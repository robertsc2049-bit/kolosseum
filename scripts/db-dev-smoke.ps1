param(
  [int]$Preferred = 5432,
  [int]$Fallback = 5433
)

$ErrorActionPreference = "Stop"

# Resolve port selection policy
& "$PSScriptRoot/Resolve-DbPort.ps1" -Preferred $Preferred -Fallback $Fallback | Out-Null
$port = [int]$env:KOLOSSEUM_DB_PORT

Write-Host "== db smoke =="
Write-Host "Using port: $port"
Write-Host ""

# TCP reachability is the minimum viable contract without assuming psql tooling
function Test-TcpPort([int]$Port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(200)
    if ($ok -and $client.Connected) { $client.EndConnect($iar) | Out-Null; $client.Close(); return $true }
    try { $client.Close() } catch {}
    return $false
  } catch { return $false }
}

if (-not (Test-TcpPort -Port $port)) {
  throw "Postgres not reachable on port $port. Start it, or change Preferred/Fallback."
}

Write-Host "OK: Postgres reachable on 127.0.0.1:$port"
Write-Host "Contract: scripts should consume KOLOSSEUM_DB_PORT and never assume 5432 is free."