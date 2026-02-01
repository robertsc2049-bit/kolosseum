param(
  [switch]$Full
)

$ErrorActionPreference = "Stop"

function Say($msg) { Write-Host $msg }

Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path) | Out-Null
Set-Location .. | Out-Null

Say "== Kolosseum Dev Status =="

# Node + npm
$node = (& node -v) 2>$null
if (-not $node) { throw "Node.js not found on PATH." }
Say "Node: $node"

$npm = (& npm -v) 2>$null
if (-not $npm) { throw "npm not found on PATH." }
Say "npm : $npm"

# Git status
$st = (& git status --porcelain=v1) 2>$null
if ($LASTEXITCODE -ne 0) { throw "git not available or repo not healthy." }

if ($st) {
  Say "WORKING TREE: DIRTY"
  Say $st
} else {
  Say "WORKING TREE: CLEAN"
}

# Useful git config checks
function GitCfg($k) { (git config --global --get $k) 2>$null }
Say "git core.editor:     $(GitCfg core.editor)"
Say "git core.autocrlf:   $(GitCfg core.autocrlf)"
Say "git core.eol:        $(GitCfg core.eol)"
Say "git core.longpaths:  $(GitCfg core.longpaths)"
Say "git rerere.enabled:  $(GitCfg rerere.enabled)"
Say "git pull.rebase:     $(GitCfg pull.rebase)"
Say "git rebase.autoStash:$(GitCfg rebase.autoStash)"

# Port sanity (optional but catches 'why won't server start')
function PortOpen($p) {
  try {
    $r = Test-NetConnection 127.0.0.1 -Port $p -WarningAction SilentlyContinue
    return [bool]$r.TcpTestSucceeded
  } catch { return $false }
}
Say "port 3000 open: $(PortOpen 3000)"
Say "port 5432 open: $(PortOpen 5432)"

# Quick gates
if ($Full) {
  Say "Running: npm run ci"
  & npm run ci
} else {
  Say "Running: npm run dev:fast"
  & npm run dev:fast
}

Say "OK"