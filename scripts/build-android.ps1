# Builds a Debug APK with Gradle and optionally serves it over HTTP for direct download
param(
  [switch]$Serve,
  [int]$Port = 5555,
  [switch]$Release,
  [switch]$Bundle,
  [string]$KeystorePath,
  [string]$KeystorePassword,
  [string]$KeyAlias,
  [string]$KeyPassword
)

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[ERR ] $msg" -ForegroundColor Red }

$ErrorActionPreference = 'Stop'

Push-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
try {
  Pop-Location
} catch {}

$repoRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $repoRoot

Write-Info "Project root: $repoRoot"

# 1) Ensure Android platform exists
if (-not (Test-Path "$repoRoot/android")) {
  Write-Info "Capacitor Android project not found. Adding..."
  npx cap add android
}

# 2) Ensure web assets are built and synced
Write-Info "Building web bundle (vite build)"
npm run build
Write-Info "Syncing to Android"
npx cap sync android

# 3) Check Java/JDK
function Test-Java {
  try {
    $v = (& java -version) 2>&1 | Select-Object -First 1
    return $true
  } catch {
    return $false
  }
}

if (-not (Test-Java)) {
  Write-Err "JAVA_HOME not set or Java not found in PATH."
  Write-Warn "Install a JDK (e.g. Temurin 17) and re-run."
  Write-Host "Download: https://adoptium.net/temurin/releases/?version=17"
  exit 1
}

# 4) Build Debug APK
if ($Release) {
  Write-Info "Building Android Release (Gradle)"
  if (-not $env:ANDROID_KEYSTORE -and $KeystorePath) { $env:ANDROID_KEYSTORE = (Resolve-Path $KeystorePath) }
  if (-not $env:ANDROID_KEYSTORE_PASSWORD -and $KeystorePassword) { $env:ANDROID_KEYSTORE_PASSWORD = $KeystorePassword }
  if (-not $env:ANDROID_KEY_ALIAS -and $KeyAlias) { $env:ANDROID_KEY_ALIAS = $KeyAlias }
  if (-not $env:ANDROID_KEY_PASSWORD -and $KeyPassword) { $env:ANDROID_KEY_PASSWORD = $KeyPassword }
} else {
  Write-Info "Building Android Debug APK (Gradle)"
}
Set-Location "$repoRoot/android"
if ($IsWindows) {
  if ($Release) { if ($Bundle) { ./gradlew.bat bundleRelease } else { ./gradlew.bat assembleRelease } } else { ./gradlew.bat assembleDebug }
} else {
  if ($Release) { if ($Bundle) { ./gradlew bundleRelease } else { ./gradlew assembleRelease } } else { ./gradlew assembleDebug }
}

$apkPath = if ($Release) { if ($Bundle) { Join-Path $repoRoot "android/app/build/outputs/bundle/release/app-release.aab" } else { Join-Path $repoRoot "android/app/build/outputs/apk/release/app-release.apk" } } else { Join-Path $repoRoot "android/app/build/outputs/apk/debug/app-debug.apk" }
if (-not (Test-Path $apkPath)) {
  Write-Err "APK not found at: $apkPath"
  exit 1
}

Write-Host "\n✅ APK built: $apkPath" -ForegroundColor Green

if ($Serve) {
  Write-Info "Starting simple HTTP server on port $Port for direct download"
  # Use Node to serve APK with Content-Disposition: attachment
  $nodeScript = @"
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const apkPath = path.resolve(process.argv[2]);
const port = parseInt(process.argv[3] || '5555', 10);

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/app-debug.apk') {
    const stat = fs.statSync(apkPath);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', 'attachment; filename="app-debug.apk"');
    res.setHeader('Access-Control-Allow-Origin', '*');
    fs.createReadStream(apkPath).pipe(res);
    return;
  }
  res.statusCode = 404;
  res.end('Not Found');
});

server.listen(port, () => {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const name of Object.keys(nets))
    for (const ni of nets[name] || [])
      if (ni.family === 'IPv4' && !ni.internal) addrs.push(ni.address);
  console.log('\nDirect download links:');
  for (const a of addrs) {
    console.log(`  http://${a}:${port}/app-debug.apk`);
  }
  console.log('\nPress Ctrl+C to stop.');
});
"@

  $tmp = New-TemporaryFile
  $tmpJs = [System.IO.Path]::ChangeExtension($tmp.FullName, '.js')
  Move-Item $tmp.FullName $tmpJs -Force
  Set-Content -LiteralPath $tmpJs -Value $nodeScript -Encoding UTF8

  node $tmpJs $apkPath $Port
}

exit 0
