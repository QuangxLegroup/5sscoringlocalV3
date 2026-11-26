$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repoRoot = Split-Path $PSScriptRoot -Parent
$stageRoot = Join-Path $repoRoot "dist\_stage-103"
$zipPath = Join-Path $repoRoot "dist\5sScoring-server-192.168.1.103-pg5433.zip"

if (-not (Test-Path (Join-Path $repoRoot "downloads\LeGroup-5S.apk"))) {
  throw "Missing downloads\LeGroup-5S.apk. Run .\build-apk.bat http://192.168.1.103:5500 first."
}

if (Test-Path $stageRoot) { Remove-Item -Recurse -Force $stageRoot }
New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $zipPath -Parent) | Out-Null

$rootFiles = @(
  "index.html",
  "404.html",
  "app.js",
  "styles.css",
  "standards.js",
  "manifest.json",
  "service-worker.js",
  "server.js",
  "package.json",
  "package-lock.json",
  "Dockerfile.backend",
  "Dockerfile.frontend",
  "docker-compose.yml",
  ".dockerignore",
  ".env.example",
  ".gitignore",
  "README.md",
  "build-apk.bat"
)

foreach ($f in $rootFiles) {
  $src = Join-Path $repoRoot $f
  if (Test-Path $src) {
    Copy-Item -Path $src -Destination (Join-Path $stageRoot $f) -Force
  }
}

foreach ($d in @("modules", "images", "src", "docker", "scripts", "tests")) {
  $srcDir = Join-Path $repoRoot $d
  if (Test-Path $srcDir) {
    Copy-Item -Path $srcDir -Destination (Join-Path $stageRoot $d) -Recurse -Force
  }
}

$stageDownloads = Join-Path $stageRoot "downloads"
New-Item -ItemType Directory -Force -Path $stageDownloads | Out-Null
Copy-Item -Path (Join-Path $repoRoot "downloads\LeGroup-5S.apk") -Destination (Join-Path $stageDownloads "LeGroup-5S.apk") -Force
if (Test-Path (Join-Path $repoRoot "downloads\.gitkeep")) {
  Copy-Item -Path (Join-Path $repoRoot "downloads\.gitkeep") -Destination (Join-Path $stageDownloads ".gitkeep") -Force
}

$stageAndroid = Join-Path $stageRoot "android"
New-Item -ItemType Directory -Force -Path (Join-Path $stageAndroid "app") | Out-Null
foreach ($af in @("build.gradle", "settings.gradle", "gradle.properties")) {
  Copy-Item -Path (Join-Path $repoRoot "android\$af") -Destination (Join-Path $stageAndroid $af) -Force
}
foreach ($aaf in @("build.gradle", "proguard-rules.pro")) {
  Copy-Item -Path (Join-Path $repoRoot "android\app\$aaf") -Destination (Join-Path $stageAndroid "app\$aaf") -Force
}
Copy-Item -Path (Join-Path $repoRoot "android\app\src") -Destination (Join-Path $stageAndroid "app\src") -Recurse -Force

function Replace-InFileUtf8 {
  param([string]$FilePath, [hashtable]$Replacements)
  if (-not (Test-Path $FilePath)) { return }
  $text = [System.IO.File]::ReadAllText($FilePath, [System.Text.UTF8Encoding]::new($false))
  foreach ($k in $Replacements.Keys) {
    $text = $text.Replace($k, $Replacements[$k])
  }
  [System.IO.File]::WriteAllText($FilePath, $text, [System.Text.UTF8Encoding]::new($false))
}

$composePath = Join-Path $stageRoot "docker-compose.yml"
Replace-InFileUtf8 $composePath @{
  "192.168.2.61" = "192.168.1.103"
  "POSTGRES_PORT:-5432" = "POSTGRES_PORT:-5433"
}
$composeText = [System.IO.File]::ReadAllText($composePath, [System.Text.UTF8Encoding]::new($false))
if ($composeText -notmatch "docker/nginx/default\.conf") {
  $composeText = $composeText.Replace(
    "      - ./downloads:/usr/share/nginx/html/downloads:ro",
    "      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro`r`n      - ./downloads:/usr/share/nginx/html/downloads:ro"
  )
  [System.IO.File]::WriteAllText($composePath, $composeText, [System.Text.UTF8Encoding]::new($false))
}

Replace-InFileUtf8 (Join-Path $stageRoot ".env.example") @{
  "192.168.2.61" = "192.168.1.103"
  "POSTGRES_PORT=5432" = "POSTGRES_PORT=5433"
  "POSTGRES_DB=legroup_5s" = "POSTGRES_DB=5sScoring"
  "POSTGRES_USER=app" = "POSTGRES_USER=postgres"
}

Replace-InFileUtf8 (Join-Path $stageRoot "src\server\config\database-config.js") @{
  'portOverride || "5432"' = 'portOverride || "5433"'
}

Replace-InFileUtf8 (Join-Path $stageRoot "scripts\migrate-json-to-postgres.js") @{
  "localhost:5432" = "localhost:5433"
}

Replace-InFileUtf8 (Join-Path $stageRoot "README.md") @{
  "host.docker.internal:5432" = "host.docker.internal:5433"
  "192.168.2.61" = "192.168.1.103"
}

$updateEnvScript = @'
$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $repoRoot ".env"

if (-not (Test-Path $envPath)) {
  Write-Warning "Khong tim thay file .env tai $envPath. Hay tao .env tu .env.example truoc."
  exit 1
}

$backupPath = "$envPath.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -Path $envPath -Destination $backupPath -Force
Write-Host "Da sao luu .env cu tai: $backupPath"

$lines = Get-Content -Path $envPath
$updates = [ordered]@{
  "APP_URL"       = "http://192.168.1.103:5500"
  "CORS_ORIGIN"   = "http://localhost:5500,http://127.0.0.1:5500,http://192.168.1.103:5500"
  "POSTGRES_PORT" = "5433"
}

$seen = @{}
$newLines = foreach ($line in $lines) {
  $replaced = $false
  foreach ($key in $updates.Keys) {
    if ($line -match "^\s*$key\s*=") {
      "$key=$($updates[$key])"
      $seen[$key] = $true
      $replaced = $true
      break
    }
  }
  if (-not $replaced) {
    if ($line -match '^\s*DATABASE_URL\s*=.*:5432/') {
      $line -replace ':5432/', ':5433/'
    } else {
      $line
    }
  }
}

foreach ($key in $updates.Keys) {
  if (-not $seen.ContainsKey($key)) {
    $newLines += "$key=$($updates[$key])"
  }
}

[System.IO.File]::WriteAllLines($envPath, $newLines, [System.Text.UTF8Encoding]::new($false))
Write-Host "Da cap nhat .env sang IP 192.168.1.103:5500 va PostgreSQL cong 5433!"
'@
[System.IO.File]::WriteAllText((Join-Path $stageRoot "scripts\update-env-103.ps1"), $updateEnvScript, [System.Text.UTF8Encoding]::new($false))

$guideText = @'
HUONG DAN TRIEN KHAI TREN MAY CHU 192.168.1.103 (POSTGRESQL CONG 5433)
=======================================================================

1. GIAI NEN:
   - Giai nen de toan bo file ZIP vao thu muc du an:
     D:\quangnm\5sScoringlocalv3
   - File ZIP KHONG chua .env, data/ (kho anh) va node_modules/, nen du lieu
     va mat khau hien co tren may chu .1.103 duoc giu nguyen an toan.

2. CAP NHAT .env (NEU CHUA CO CONG 5433 HOAC IP .1.103):
   - Chay: powershell -ExecutionPolicy Bypass -File scripts\update-env-103.ps1
   - Dam bao da dien dung POSTGRES_PASSWORD that va de trong DATABASE_URL=.

3. KHOI DONG LAI DOCKER (KHONG CAN INTERNET):
   cd D:\quangnm\5sScoringlocalv3
   docker compose up -d --force-recreate

4. CAI DAT / CAP NHAT APP ANDROID TREN DIEN THOAI NOI BO:
   - Mo trinh duyet vao http://192.168.1.103:5500 va bam "Tai ung dung Android (.apk)"
     (hoac vao thang http://192.168.1.103:5500/downloads/LeGroup-5S.apk).
   - Cai de truc tiep len ban cu tren thiet bi.
'@
[System.IO.File]::WriteAllText((Join-Path $stageRoot "HUONG-DAN-TRIEN-KHAI-103.txt"), $guideText, [System.Text.UTF8Encoding]::new($false))

$leftovers = Get-ChildItem $stageRoot -Recurse -File -Exclude "*.png","*.jpg","*.jpeg","*.apk","*.lock","update-env-103.ps1","package-server-103.ps1" |
  Select-String -Pattern '192\.168\.2\.61|5432' -ErrorAction SilentlyContinue
if ($leftovers) {
  throw ("Found leftover 192.168.2.61 or 5432 in staged files:`n" + ($leftovers | Out-String))
}

if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stageRoot, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
Remove-Item -Recurse -Force $stageRoot

$zipInfo = Get-Item $zipPath
Write-Host "PACKAGED ZIP: $($zipInfo.FullName) ($([math]::Round($zipInfo.Length / 1MB, 2)) MB, $($zipInfo.Length) bytes)"
