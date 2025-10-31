# Test App Script
# Chạy app để kiểm tra có hoạt động không

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  IBST BIM - Test App" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

$appPath = "c:\Users\Windows\Downloads\app QLDA\dist-electron\win-unpacked\IBST BIM - Quản lý Dự án.exe"

if (Test-Path $appPath) {
    Write-Host "✅ App file found!" -ForegroundColor Green
    Write-Host "📍 Path: $appPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🚀 Starting app..." -ForegroundColor Cyan
    Start-Process $appPath
    Write-Host ""
    Write-Host "✅ App started!" -ForegroundColor Green
    Write-Host "   - Nếu thấy trang đăng nhập → SUCCESS! ✅" -ForegroundColor Green
    Write-Host "   - Nếu màn hình trắng → Nhấn F12 xem lỗi" -ForegroundColor Yellow
} else {
    Write-Host "❌ App not found!" -ForegroundColor Red
    Write-Host "   Build chưa xong hoặc thất bại" -ForegroundColor Yellow
    Write-Host "   Chạy: npm run electron:build:win" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
