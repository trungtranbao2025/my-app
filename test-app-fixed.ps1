# Test script for IBST BIM App
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  TEST IBST BIM - Quản lý Dự án  " -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if build exists
$setupPath = "dist-electron\IBST BIM - Quản lý Dự án-1.0.0-Setup.exe"
$portablePath = "dist-electron\IBST BIM - Quản lý Dự án-1.0.0-Portable.exe"
$unpackedPath = "dist-electron\win-unpacked\IBST BIM - Quản lý Dự án.exe"

Write-Host "Kiểm tra file build..." -ForegroundColor Yellow

if (Test-Path $setupPath) {
    $setupSize = (Get-Item $setupPath).Length / 1MB
    Write-Host "  ✓ Setup Installer: $([math]::Round($setupSize, 2)) MB" -ForegroundColor Green
} else {
    Write-Host "  ✗ Setup Installer: Không tìm thấy" -ForegroundColor Red
}

if (Test-Path $portablePath) {
    $portableSize = (Get-Item $portablePath).Length / 1MB
    Write-Host "  ✓ Portable: $([math]::Round($portableSize, 2)) MB" -ForegroundColor Green
} else {
    Write-Host "  ✗ Portable: Không tìm thấy" -ForegroundColor Red
}

if (Test-Path $unpackedPath) {
    Write-Host "  ✓ Unpacked: Có sẵn" -ForegroundColor Green
} else {
    Write-Host "  ✗ Unpacked: Không tìm thấy" -ForegroundColor Red
}

Write-Host ""
Write-Host "Chọn cách test:" -ForegroundColor Yellow
Write-Host "  [1] Chạy Portable (Nhanh - Khuyến nghị)" -ForegroundColor Cyan
Write-Host "  [2] Chạy Unpacked (Test trực tiếp)" -ForegroundColor Cyan
Write-Host "  [3] Cài đặt từ Setup Installer" -ForegroundColor Cyan
Write-Host "  [4] Xem log file" -ForegroundColor Cyan
Write-Host "  [Q] Thoát" -ForegroundColor Gray
Write-Host ""

$choice = Read-Host "Nhập lựa chọn"

if ($choice -eq "1") {
    if (Test-Path $portablePath) {
        Write-Host ""
        Write-Host "Đang chạy Portable..." -ForegroundColor Green
        Write-Host "Nhấn F12 trong app để mở DevTools nếu cần debug" -ForegroundColor Yellow
        Start-Process $portablePath
    } else {
        Write-Host "File Portable không tồn tại!" -ForegroundColor Red
    }
}
elseif ($choice -eq "2") {
    if (Test-Path $unpackedPath) {
        Write-Host ""
        Write-Host "Đang chạy Unpacked..." -ForegroundColor Green
        Write-Host "Nhấn F12 trong app để mở DevTools nếu cần debug" -ForegroundColor Yellow
        Start-Process $unpackedPath
    } else {
        Write-Host "File Unpacked không tồn tại!" -ForegroundColor Red
    }
}
elseif ($choice -eq "3") {
    if (Test-Path $setupPath) {
        Write-Host ""
        Write-Host "Đang chạy Setup Installer..." -ForegroundColor Green
        Start-Process $setupPath
    } else {
        Write-Host "File Setup không tồn tại!" -ForegroundColor Red
    }
}
elseif ($choice -eq "4") {
    $logPath = "$env:APPDATA\IBST BIM - Quản lý Dự án\app.log"
    Write-Host ""
    if (Test-Path $logPath) {
        Write-Host "Nội dung app.log:" -ForegroundColor Green
        Write-Host "==================" -ForegroundColor Gray
        Get-Content $logPath
        Write-Host "==================" -ForegroundColor Gray
    } else {
        Write-Host "Chưa có file log. App chưa chạy lần nào." -ForegroundColor Yellow
        Write-Host "Log sẽ được tạo tại: $logPath" -ForegroundColor Gray
    }
}
else {
    Write-Host "Thoát." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Xem hướng dẫn đầy đủ trong file: SUA-LOI-THANH-CONG.md" -ForegroundColor Cyan
