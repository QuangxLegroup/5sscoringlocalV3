param(
  [string]$ServerUrl = "",
  [string]$SdkRoot = "$env:LOCALAPPDATA\Android\Sdk",
  [string]$GradleVersion = "8.10.2"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$androidDir = Join-Path $repoRoot "android"
$downloadsDir = Join-Path $repoRoot "downloads"
$keystoreDir = Join-Path $androidDir "keystore"
$keystorePath = Join-Path $keystoreDir "legroup-5s-release.jks"
$androidBase = Split-Path $SdkRoot -Parent

function Detect-DefaultServerUrl {
  $envFile = Join-Path $repoRoot ".env"
  if (Test-Path $envFile) {
    $appUrlLine = Get-Content $envFile -ErrorAction SilentlyContinue |
      Where-Object { $_ -match '^\s*APP_URL\s*=\s*(.+?)\s*$' } |
      Select-Object -First 1
    if ($appUrlLine -and $appUrlLine -match '^\s*APP_URL\s*=\s*(.+?)\s*$') {
      $val = $Matches[1].Trim().Trim('"').Trim("'")
      if ($val) { return $val }
    }
  }

  try {
    $lanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object {
        $_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)' -and
        $_.InterfaceAlias -notmatch 'WSL|vEthernet|Docker|Loopback'
      } |
      Select-Object -First 1 -ExpandProperty IPAddress
    if ($lanIp) {
      return "http://${lanIp}:5500"
    }
  } catch {}

  return "http://192.168.1.103:5500"
}

function Normalize-ServerUrl {
  param([string]$RawUrl)
  $u = [string]$RawUrl
  $u = $u.Trim()
  if ([string]::IsNullOrWhiteSpace($u)) {
    $u = Detect-DefaultServerUrl
  }
  if ($u -notmatch '^https?://') {
    $u = "http://$u"
  }
  return $u.TrimEnd("/")
}

function Test-ValidJdk17Plus {
  param([string]$JdkDir)
  if ([string]::IsNullOrWhiteSpace($JdkDir)) { return $false }
  $javaExe = Join-Path $JdkDir "bin\java.exe"
  $javacExe = Join-Path $JdkDir "bin\javac.exe"
  if (-not (Test-Path $javaExe) -or -not (Test-Path $javacExe)) { return $false }

  $releaseFile = Join-Path $JdkDir "release"
  if (Test-Path $releaseFile) {
    $releaseText = Get-Content $releaseFile -Raw -ErrorAction SilentlyContinue
    if ($releaseText -match 'JAVA_VERSION="(\d+)') {
      return ([int]$Matches[1]) -ge 17
    }
  }

  $prevEap = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $verLine = (& $javaExe -version 2>&1 | Out-String)
    if ($verLine -match 'version "(\d+)') {
      return ([int]$Matches[1]) -ge 17
    }
  } catch {
  } finally {
    $ErrorActionPreference = $prevEap
  }
  return $false
}

function Find-JavaHome {
  $roots = @()
  if ($env:JAVA_HOME) { $roots += $env:JAVA_HOME }
  $roots += (Join-Path $androidBase "jdk-21")

  $searchDirs = @(
    $androidBase,
    "C:\Program Files\Java",
    "C:\Program Files\Eclipse Adoptium",
    "C:\Program Files\Microsoft",
    "C:\Program Files\Zulu",
    "C:\Program Files\Amazon Corretto",
    "C:\Program Files\BellSoft",
    "C:\Program Files\Android\Android Studio"
  )

  foreach ($parent in $searchDirs) {
    if (Test-Path $parent) {
      Get-ChildItem $parent -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        ForEach-Object { $roots += $_.FullName }
    }
  }

  $javacCmd = Get-Command javac.exe -ErrorAction SilentlyContinue
  if ($javacCmd) {
    $roots += (Split-Path (Split-Path $javacCmd.Source -Parent) -Parent)
  }

  foreach ($candidate in ($roots | Select-Object -Unique)) {
    if (Test-ValidJdk17Plus $candidate) {
      return $candidate
    }
  }
  return $null
}

$ServerUrl = Normalize-ServerUrl $ServerUrl
$gradleBat = Join-Path $androidBase "gradle-$GradleVersion\bin\gradle.bat"
$javaHome = Find-JavaHome
$hasSdk = (Test-Path (Join-Path $SdkRoot "platforms\android-35\android.jar")) -and
  (Test-Path (Join-Path $SdkRoot "build-tools\35.0.0\apksigner.bat"))

if (-not $javaHome -or -not $hasSdk -or -not (Test-Path $gradleBat)) {
  Write-Host "Missing Android build toolchain (JDK 17+/SDK 35/Gradle). Running setup automatically..."
  & (Join-Path $PSScriptRoot "setup-android-sdk.ps1") -SdkRoot $SdkRoot -GradleVersion $GradleVersion
  $javaHome = Find-JavaHome
}

if (-not $javaHome) {
  throw "JDK 17/21 still not found after setup."
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot
$env:PATH = "$javaHome\bin;$env:PATH"

Write-Host "Using JAVA_HOME: $javaHome"
Write-Host "Using SERVER_URL: $ServerUrl"

$hasIcons = Test-Path (Join-Path $androidDir "app\src\main\res\mipmap-xxxhdpi\ic_launcher.png")
$hasSharp = Test-Path (Join-Path $repoRoot "node_modules\sharp")
if ($hasSharp) {
  Write-Host "1/4 Generating Android launcher icons..."
  node (Join-Path $repoRoot "scripts\generate-android-icons.js")
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to generate Android launcher icons."
  }
} elseif ($hasIcons) {
  Write-Host "1/4 Reusing existing Android launcher icons."
} else {
  throw "Launcher icons missing and node_modules/sharp not installed. Run 'npm.cmd install' first."
}

if (-not (Test-Path $keystorePath)) {
  Write-Host "2/4 Generating release signing keystore..."
  New-Item -ItemType Directory -Force -Path $keystoreDir | Out-Null
  $prevEap = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & "$javaHome\bin\keytool.exe" -genkeypair `
      -keystore $keystorePath `
      -storepass "LeGroup5S#2026" `
      -alias "legroup5s" `
      -keypass "LeGroup5S#2026" `
      -keyalg RSA `
      -keysize 2048 `
      -validity 10000 `
      -dname "CN=LeGroup 5S, OU=Operations, O=LeGroup, L=Hanoi, C=VN"
    $ktExit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prevEap
  }
  if ($ktExit -ne 0) {
    throw "Failed to generate signing keystore (exit code $ktExit)."
  }
} else {
  Write-Host "2/4 Reusing existing release keystore."
}

$escapedSdk = $SdkRoot.Replace("\", "\\").Replace(":", "\:")
Set-Content -Path (Join-Path $androidDir "local.properties") -Value "sdk.dir=$escapedSdk" -Encoding ASCII

Write-Host "3/4 Building release APK (default LAN server: $ServerUrl)..."
$buildLogPath = Join-Path $androidDir "build-apk.log"
Push-Location $androidDir
$prevEap = $ErrorActionPreference
try {
  $ErrorActionPreference = "Continue"
  cmd /c "`"$gradleBat`" assembleRelease -PSERVER_URL=$ServerUrl --no-daemon --console=plain 2>&1" | Tee-Object -FilePath $buildLogPath
  $gradleExit = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $prevEap
  Pop-Location
}
if ($gradleExit -ne 0) {
  throw "Gradle assembleRelease failed with exit code $gradleExit (xem chi tiet tai $buildLogPath)"
}

$builtApk = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $builtApk)) {
  throw "Expected APK not found at $builtApk"
}

Write-Host "4/4 Copying signed APK to downloads\LeGroup-5S.apk..."
New-Item -ItemType Directory -Force -Path $downloadsDir | Out-Null
$destApk = Join-Path $downloadsDir "LeGroup-5S.apk"
Copy-Item -Path $builtApk -Destination $destApk -Force

$apkInfo = Get-Item $destApk
Write-Host ""
Write-Host "SUCCESS! APK built at: $($apkInfo.FullName) ($([math]::Round($apkInfo.Length / 1MB, 2)) MB)"
Write-Host "Default LAN Server URL: $ServerUrl"
