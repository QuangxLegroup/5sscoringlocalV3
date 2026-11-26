param(
  [string]$SdkRoot = "$env:LOCALAPPDATA\Android\Sdk",
  [string]$GradleVersion = "8.10.2"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$androidBase = Split-Path $SdkRoot -Parent
New-Item -ItemType Directory -Force -Path $androidBase | Out-Null
New-Item -ItemType Directory -Force -Path $SdkRoot | Out-Null

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

function Download-Fast {
  param([string]$Url, [string]$OutFile)
  $curlExe = "$env:SystemRoot\System32\curl.exe"
  if (Test-Path $curlExe) {
    $prevEap = $ErrorActionPreference
    try {
      $ErrorActionPreference = "Continue"
      & $curlExe -fL --http1.1 --retry 5 --retry-delay 2 --connect-timeout 20 -sS -o $OutFile $Url
      if ($LASTEXITCODE -eq 0) {
        return
      }
      Write-Warning "curl.exe failed with exit code $LASTEXITCODE, retrying with Invoke-WebRequest..."
    } finally {
      $ErrorActionPreference = $prevEap
    }
  }
  Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
}

$javaHome = Find-JavaHome
if (-not $javaHome) {
  $portableJdkDir = Join-Path $androidBase "jdk-21"
  $jdkZip = Join-Path $androidBase "temurin-jdk21.zip"
  $jdkTmp = Join-Path $androidBase "jdk21-tmp"
  $jdkUrl = "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse"

  Write-Host "JDK 17/21 not found on this machine. Downloading portable Eclipse Temurin JDK 21..."
  Download-Fast -Url $jdkUrl -OutFile $jdkZip

  Write-Host "Extracting portable JDK 21..."
  if (Test-Path $jdkTmp) { Remove-Item -Recurse -Force $jdkTmp }
  Expand-Archive -Path $jdkZip -DestinationPath $jdkTmp -Force

  $extractedSub = Get-ChildItem $jdkTmp -Directory | Select-Object -First 1
  if (-not $extractedSub) {
    throw "Failed to extract JDK 21 archive."
  }
  if (Test-Path $portableJdkDir) { Remove-Item -Recurse -Force $portableJdkDir }
  Move-Item -Path $extractedSub.FullName -Destination $portableJdkDir
  Remove-Item -Recurse -Force $jdkTmp -ErrorAction SilentlyContinue
  Remove-Item -Force $jdkZip -ErrorAction SilentlyContinue

  $javaHome = $portableJdkDir
  if (-not (Test-ValidJdk17Plus $javaHome)) {
    throw "Downloaded JDK 21 appears invalid at $javaHome"
  }
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $SdkRoot
$env:ANDROID_SDK_ROOT = $SdkRoot
$env:PATH = "$javaHome\bin;$env:PATH"

Write-Host "Using JAVA_HOME: $javaHome"
Write-Host "Using ANDROID_HOME: $SdkRoot"

$sdkManager = Join-Path $SdkRoot "cmdline-tools\latest\bin\sdkmanager.bat"
if (-not (Test-Path $sdkManager)) {
  $zipPath = Join-Path $SdkRoot "cmdline-tools.zip"
  $urls = @(
    "https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip",
    "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
  )
  $downloaded = $false
  foreach ($url in $urls) {
    try {
      Write-Host "Downloading Android Command-Line Tools from $url ..."
      Download-Fast -Url $url -OutFile $zipPath
      $downloaded = $true
      break
    } catch {
      Write-Warning "Failed to download from ${url}: $($_.Exception.Message)"
    }
  }
  if (-not $downloaded) {
    throw "Could not download Android Command-Line Tools."
  }

  Write-Host "Extracting Android Command-Line Tools..."
  $extractTmp = Join-Path $SdkRoot "cmdline-tools-tmp"
  if (Test-Path $extractTmp) { Remove-Item -Recurse -Force $extractTmp }
  Expand-Archive -Path $zipPath -DestinationPath $extractTmp -Force

  $targetLatest = Join-Path $SdkRoot "cmdline-tools\latest"
  New-Item -ItemType Directory -Force -Path (Split-Path $targetLatest -Parent) | Out-Null
  if (Test-Path $targetLatest) { Remove-Item -Recurse -Force $targetLatest }
  Move-Item -Path (Join-Path $extractTmp "cmdline-tools") -Destination $targetLatest
  Remove-Item -Recurse -Force $extractTmp
  Remove-Item -Force $zipPath
}

$hasSdkPackages = (Test-Path (Join-Path $SdkRoot "platform-tools\adb.exe")) -and
  (Test-Path (Join-Path $SdkRoot "platforms\android-35\android.jar")) -and
  (Test-Path (Join-Path $SdkRoot "build-tools\35.0.0\apksigner.bat"))

if (-not $hasSdkPackages) {
  Write-Host "Accepting Android SDK licenses and installing platform-tools, android-35, build-tools;35.0.0 ..."
  $yesFile = Join-Path $SdkRoot "yes.txt"
  Set-Content -Path $yesFile -Value (("y`r`n" * 50)) -Encoding ASCII
  cmd /c "`"$sdkManager`" --sdk_root=`"$SdkRoot`" --licenses < `"$yesFile`" >nul 2>&1"
  Remove-Item -Force $yesFile -ErrorAction SilentlyContinue

  $prevEap = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    & $sdkManager --sdk_root="$SdkRoot" "platform-tools" "platforms;android-35" "build-tools;35.0.0"
    $sdkExit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prevEap
  }
  if ($sdkExit -ne 0) {
    throw "sdkmanager package installation failed with exit code $sdkExit"
  }
} else {
  Write-Host "Android SDK packages already installed."
}

$gradleDir = Join-Path $androidBase "gradle-$GradleVersion"
$gradleBat = Join-Path $gradleDir "bin\gradle.bat"
if (-not (Test-Path $gradleBat)) {
  $gradleZip = Join-Path $androidBase "gradle-$GradleVersion-bin.zip"
  $gradleUrl = "https://services.gradle.org/distributions/gradle-$GradleVersion-bin.zip"
  Write-Host "Downloading Gradle $GradleVersion from $gradleUrl ..."
  Download-Fast -Url $gradleUrl -OutFile $gradleZip
  Write-Host "Extracting Gradle $GradleVersion..."
  Expand-Archive -Path $gradleZip -DestinationPath $androidBase -Force
  Remove-Item -Force $gradleZip
} else {
  Write-Host "Gradle $GradleVersion already installed."
}

Write-Host "Android toolchain ready!"
Write-Host "JDK:    $javaHome"
Write-Host "SDK:    $SdkRoot"
Write-Host "Gradle: $gradleBat"
