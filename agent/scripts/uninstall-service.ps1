param(
  [string]$ServiceName = "YuhyunIngestAgent",
  [string]$NssmPath = ""
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

$resolvedNssmPath = Resolve-NssmPath -Requested $NssmPath

& $resolvedNssmPath stop $ServiceName | Out-Null
& $resolvedNssmPath remove $ServiceName confirm | Out-Null

Write-Host "Service removed: $ServiceName"
