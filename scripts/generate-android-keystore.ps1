param(
  [string]$OutDir = "android/keystore",
  [string]$Alias = "qlda",
  [int]$ValidityDays = 36500
)

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Err($m){ Write-Host "[ERR ] $m" -ForegroundColor Red }

$ErrorActionPreference = 'Stop'

if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
  Write-Err "keytool not found. Please install Java JDK (Temurin 17)."
  exit 1
}

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$keystore = Join-Path $OutDir "qlda-release.keystore"

Write-Info "Keystore output: $keystore"

# Prompt secrets
$storePass = Read-Host -AsSecureString "Enter Keystore Password"
$keyPass   = Read-Host -AsSecureString "Enter Key Password (can be same as Keystore)"
$storePassPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($storePass))
$keyPassPlain   = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($keyPass))

Write-Info "Generating keystore via keytool..."
$keytoolArgs = @(
  '-genkeypair','-v',
  '-storetype','PKCS12',
  '-keystore', $keystore,
  '-alias', $Alias,
  '-keyalg','RSA','-keysize','2048',
  '-validity', "$ValidityDays"
)

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'keytool'
$psi.Arguments = ($keytoolArgs -join ' ')
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $false
$psi.RedirectStandardError = $false
$psi.UseShellExecute = $false

$p = New-Object System.Diagnostics.Process
$p.StartInfo = $psi
$p.Start() | Out-Null

# keytool prompts: keystore pwd, re-enter, name/org/location, key pwd
$p.StandardInput.WriteLine($storePassPlain)
$p.StandardInput.WriteLine($storePassPlain)
$p.StandardInput.WriteLine('Your Name')
$p.StandardInput.WriteLine('Your Org Unit')
$p.StandardInput.WriteLine('Your Org')
$p.StandardInput.WriteLine('Your City')
$p.StandardInput.WriteLine('Your State')
$p.StandardInput.WriteLine('VN')
$p.StandardInput.WriteLine('yes')
$p.StandardInput.WriteLine($keyPassPlain)
$p.StandardInput.WriteLine($keyPassPlain)
$p.WaitForExit()

if (-not (Test-Path $keystore)) {
  Write-Err "Keystore generation failed."
  exit 1
}

Write-Info "Keystore created: $keystore"
Write-Host "\nSet these environment variables for release build:" -ForegroundColor Yellow
Write-Host "  setx ANDROID_KEYSTORE \"$keystore\"" 
Write-Host "  setx ANDROID_KEYSTORE_PASSWORD <your_keystore_password>" 
Write-Host "  setx ANDROID_KEY_ALIAS $Alias" 
Write-Host "  setx ANDROID_KEY_PASSWORD <your_key_password>" 
Write-Host "\nThen open a NEW PowerShell and run: npm run android:build:release" -ForegroundColor Yellow
