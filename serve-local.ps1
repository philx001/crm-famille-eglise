# Static server for local CRM testing (avoids file:// and IPv4/IPv6 quirks).
#
# From this folder in PowerShell:
#   .\serve-local.ps1
#   .\serve-local.ps1 8080
#
# If scripts are blocked:
#   powershell -ExecutionPolicy Bypass -File .\serve-local.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$port = 5500
if ($args.Count -ge 1 -and [int]::TryParse($args[0], [ref]$null)) {
  $port = [int]$args[0]
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ' CRM Famille - local server' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host " Folder: $PSScriptRoot"
Write-Host " URL:    http://127.0.0.1:$port/"
Write-Host "         http://localhost:$port/"
Write-Host ''
Write-Host ' Stop: Ctrl+C in this window.' -ForegroundColor Yellow
Write-Host ''

if (Get-Command py -ErrorAction SilentlyContinue) {
  & py -m http.server $port --bind 127.0.0.1
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  & python -m http.server $port --bind 127.0.0.1
} else {
  Write-Host 'Error: neither py nor python found in PATH.' -ForegroundColor Red
  Write-Host 'Install Python from https://www.python.org/ or Microsoft Store.' -ForegroundColor Red
  exit 1
}
