# Package essential SQLs into a zip for sharing/import
param(
  [string]$OutFile = "deploy-sql.zip"
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $root "..")

$files = @(
  'supabase-schema.sql',
  'create-project-documents.sql',
  'create-task-reports-storage.sql',
  'create-task-multi-assignees.sql',
  'create-task-recurring-reminders.sql',
  'enable-realtime.sql',
  'RUN-THIS-IN-SUPABASE.sql'
) | Where-Object { Test-Path $_ }

$staging = "deploy/_staging"
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Path $staging | Out-Null

foreach ($f in $files) {
  Copy-Item $f $staging -Force
}

# Include order and README
Copy-Item "deploy/README-DEPLOY.md" $staging -Force
Copy-Item "deploy/SQL-ORDER.md" $staging -Force

if (Test-Path (Join-Path "deploy" $OutFile)) { Remove-Item (Join-Path "deploy" $OutFile) -Force }
Compress-Archive -Path "$staging/*" -DestinationPath (Join-Path "deploy" $OutFile)

Write-Host "Packed SQLs to deploy/$OutFile"
