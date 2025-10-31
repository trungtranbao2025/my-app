# Remove old installed app data to ensure fresh install
$localAppData = $env:LOCALAPPDATA
$programsPath = Join-Path $localAppData "Programs"
$ibstApp = Join-Path $programsPath "IBST BIM - Quản lý Dự án"

Write-Host "Removing installed app (if exists): $ibstApp"
if (Test-Path $ibstApp) {
  try {
    Remove-Item -Recurse -Force -LiteralPath $ibstApp
    Write-Host "Removed: $ibstApp"
  } catch {
    Write-Warning "Failed to remove: $ibstApp"
  }
}

# Optional: clean user data folder if app created one under AppData\Roaming
$roaming = $env:APPDATA
$ibstData = Join-Path $roaming "IBST BIM - Quản lý Dự án"
Write-Host "Removing app data (if exists): $ibstData"
if (Test-Path $ibstData) {
  try {
    Remove-Item -Recurse -Force -LiteralPath $ibstData
    Write-Host "Removed: $ibstData"
  } catch {
    Write-Warning "Failed to remove: $ibstData"
  }
}

exit 0
