
# DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
# deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
# failure output readable for PowerShell and CI users.

param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$Path,

  [Parameter(Mandatory=$true, Position=1)]
  [AllowEmptyString()]
  [string]$Text
)

$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$wr = Join-Path $here "Write-RepoFile.ps1"
if (-not (Test-Path -LiteralPath $wr)) { throw "Write-Utf8NoBomLf: missing Write-RepoFile.ps1: $wr" }

# Preserve historical behavior: create parent dirs as needed.
& $wr -Path $Path -Text $Text -CreateParent
