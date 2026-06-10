function Invoke-GhJson {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  $json = & gh @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "gh command failed: gh $($Arguments -join ' ')"
  }

  if ($null -eq $json) {
    throw "gh command returned no JSON output: gh $($Arguments -join ' ')"
  }

  return ($json | ConvertFrom-Json)
}

function Get-GhPullRequestSummary {
  [CmdletBinding(DefaultParameterSetName = "ByNumber")]
  param(
    [Parameter(Mandatory = $true)][string]$Repo,

    [Parameter(Mandatory = $true, ParameterSetName = "ByNumber")][int]$PrNumber,

    [Parameter(Mandatory = $true, ParameterSetName = "ByBranch")][string]$Branch
  )

  if ($PSCmdlet.ParameterSetName -eq "ByNumber") {
    return Invoke-GhJson -Arguments @(
      "pr", "view", "$PrNumber",
      "--repo", $Repo,
      "--json", "number,state,title,url"
    )
  }

  return Invoke-GhJson -Arguments @(
    "pr", "view", $Branch,
    "--repo", $Repo,
    "--json", "number,state,title,url"
  )
}

function Get-GhPullRequestNumberFromBranch {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][string]$Repo,
    [Parameter(Mandatory = $true)][string]$Branch
  )

  $pr = Invoke-GhJson -Arguments @(
    "pr", "view", $Branch,
    "--repo", $Repo,
    "--json", "number"
  )

  if ($null -eq $pr.number) {
    throw "Failed to resolve PR number from branch '$Branch'."
  }

  return [int]$pr.number
}

function Format-GhPullRequestSummary {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][psobject]$PullRequest
  )

  return ("#{0} {1} {2} {3}" -f $PullRequest.number, $PullRequest.state, $PullRequest.title, $PullRequest.url)
}
