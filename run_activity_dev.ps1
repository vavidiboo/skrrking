$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

$hostIp = if ($env:ACTIVITY_HOST) { $env:ACTIVITY_HOST } else { "0.0.0.0" }
$port = if ($env:ACTIVITY_PORT) { $env:ACTIVITY_PORT } else { "8010" }

python -m uvicorn discord_activity_skullking.api_server:app --host $hostIp --port $port --reload
