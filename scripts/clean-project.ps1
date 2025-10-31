# Clean project artifacts (node_modules optional, dist, caches)
$ErrorActionPreference = 'SilentlyContinue'

Write-Host "Cleaning dist folders..."
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "dist" | Out-Null
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "dist-electron" | Out-Null

Write-Host "Cleaning vite cache..."
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue ".vite" | Out-Null
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "node_modules/.cache" | Out-Null

Write-Host "Cleaning logs/temp..."
Get-ChildItem -Path . -Recurse -Force -Include "*.log","*.tmp" | Remove-Item -Force -ErrorAction SilentlyContinue

exit 0
