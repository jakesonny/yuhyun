param(
  [string]$ServiceName = "YuhyunIngestAgent",
  [string]$NssmPath = "C:\tools\nssm\nssm.exe",
  [string]$AgentExePath = ".\dist\agent.exe",
  [string]$WorkingDirectory = "."
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $NssmPath)) {
  throw "nssm.exe not found: $NssmPath"
}

if (!(Test-Path $AgentExePath)) {
  throw "agent exe not found: $AgentExePath"
}

& $NssmPath install $ServiceName $AgentExePath
& $NssmPath set $ServiceName AppDirectory (Resolve-Path $WorkingDirectory)
& $NssmPath set $ServiceName Start SERVICE_AUTO_START
& $NssmPath start $ServiceName

Write-Host "Service installed and started: $ServiceName"
