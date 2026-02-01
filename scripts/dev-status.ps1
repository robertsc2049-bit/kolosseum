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

# Quick gates
if ($Full) {
  Say "Running: npm run ci"
  & npm run ci
} else {
  Say "Running: npm run dev:fast"
  & npm run dev:fast
}

Say "OK"