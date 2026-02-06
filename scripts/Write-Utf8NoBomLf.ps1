[CmdletBinding(DefaultParameterSetName='Lines')]
param(
  [Parameter(Mandatory=$true)]
  [ValidateNotNullOrEmpty()]
  [string] $Path,

  [Parameter(ParameterSetName='Lines', Mandatory=$true)]
  [AllowEmptyCollection()]
  [string[]] $Lines,

  [Parameter(ParameterSetName='Text', Mandatory=$true)]
  [AllowEmptyString()]
  [string] $Text,

  [switch] $NoFinalNewline
)

function Normalize-ToLf([string] $s) {
  if ($null -eq $s) { return '' }
  return (($s -replace "
", "
") -replace "", "
")
}

$outDir = Split-Path -Parent $Path
if ($outDir -and -not (Test-Path -LiteralPath $outDir)) {
  New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

if ($PSCmdlet.ParameterSetName -eq 'Lines') {
  $text = [string]::Join("
", $Lines)
} else {
  $text = $Text
}

$text = Normalize-ToLf $text

if (-not $NoFinalNewline) {
  if ($text.Length -eq 0) { $text = "
" }
  elseif (-not $text.EndsWith("
")) { $text += "
" }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($Path, $text, $utf8NoBom)
