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