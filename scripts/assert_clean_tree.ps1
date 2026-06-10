
# DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
# deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
# failure output readable for PowerShell and CI users.

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
