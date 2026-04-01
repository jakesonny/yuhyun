param(
  [string]$ServiceName = "YuhyunIngestAgent",
  [string]$NssmPath = "C:\tools\nssm\nssm.exe"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $NssmPath)) {
  throw "nssm.exe not found: $NssmPath"
}

& $NssmPath stop $ServiceName
& $NssmPath remove $ServiceName confirm

Write-Host "Service removed: $ServiceName"
