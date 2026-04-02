param(
  [string]$ServiceName = "YuhyunIngestAgent",
  [string]$NssmPath = "",
  [string]$AgentExePath = ".\dist\agent.exe",
  [string]$WorkingDirectory = "."
)

$ErrorActionPreference = "Stop"

function Resolve-NssmPath {
  param([string]$Requested)
  if ($Requested -and (Test-Path $Requested)) {
    return (Resolve-Path $Requested).Path
  }

  $candidates = @(
    ".\nssm.exe",
    ".\tools\nssm.exe",
    "C:\tools\nssm\nssm.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }

  throw "nssm.exe not found. Put nssm.exe in agent folder or pass -NssmPath."
}

if (!(Test-Path $AgentExePath)) {
  throw "agent exe not found: $AgentExePath"
}

$resolvedNssmPath = Resolve-NssmPath -Requested $NssmPath
$resolvedAgentExePath = (Resolve-Path $AgentExePath).Path
$resolvedWorkDir = (Resolve-Path $WorkingDirectory).Path

& $resolvedNssmPath stop $ServiceName | Out-Null
& $resolvedNssmPath remove $ServiceName confirm | Out-Null

& $resolvedNssmPath install $ServiceName $resolvedAgentExePath
& $resolvedNssmPath set $ServiceName AppDirectory $resolvedWorkDir
& $resolvedNssmPath set $ServiceName Start SERVICE_AUTO_START

# Restart automatically on unexpected failures.
sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null
sc.exe failureflag $ServiceName 1 | Out-Null

& $resolvedNssmPath start $ServiceName

Write-Host "Service installed and started: $ServiceName"
Write-Host "nssm: $resolvedNssmPath"
Write-Host "agent: $resolvedAgentExePath"
