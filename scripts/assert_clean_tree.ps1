function Get-GitStatusShortLines {
  [CmdletBinding()]
  param()

  return @(git status --short)
}

function Assert-CleanGitTree {
  [CmdletBinding()]
  param(
    [string]$Message = "Working tree is not clean. Stop and clean it first."
  )

  $statusLines = Get-GitStatusShortLines
  if ($statusLines.Count -ne 0) {
    throw $Message
  }
}
