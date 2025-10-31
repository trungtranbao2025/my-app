# Kill running IBST processes to avoid file locks before rebuild
Get-Process | Where-Object { $_.ProcessName -like "*IBST*" -or $_.ProcessName -like "*QLDA*" -or $_.ProcessName -like "*app-qlda*" } | ForEach-Object {
  try {
    Stop-Process -Id $_.Id -Force -ErrorAction Stop
    Write-Host "Stopped process: $($_.ProcessName) ($($_.Id))"
  } catch {
    Write-Host "Skip/Failed stopping: $($_.ProcessName) ($($_.Id))"
  }
}
exit 0
