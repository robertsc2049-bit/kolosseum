Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$src = Join-Path (Get-Location) "githooks\pre-commit"
$dst = Join-Path (Get-Location) ".git\hooks\pre-commit"

if (!(Test-Path ".git")) { throw "Not at repo root (missing .git)." }
if (!(Test-Path $src)) { throw "Missing $src" }

# Write UTF-8 no BOM
$content = Get-Content -Raw $src
[System.IO.File]::WriteAllText($dst, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Installed pre-commit hook -> $dst"

# Best-effort chmod for Git Bash users
$bash = "C:\Program Files\Git\bin\bash.exe"
if (Test-Path $bash) {
  & $bash -lc "chmod +x .git/hooks/pre-commit" | Out-Null
  Write-Host "chmod +x applied via Git Bash"
} else {
  Write-Host "Git Bash not found at '$bash' (chmod skipped). If you use WSL/Git Bash, run chmod +x manually."
}
