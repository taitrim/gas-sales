param(
  [Parameter(Mandatory = $true)]
  [string]$RootPassword,
  [string]$DumpPath = '',
  [string]$AdminPassword = '',
  [string]$AdminUsername = 'admin'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$root = Split-Path -Parent $root
$backend = Join-Path $root 'backend'
$envPath = Join-Path $backend '.env'

function Get-Env($key) {
  if (-not (Test-Path $envPath)) { return $null }
  $line = Get-Content $envPath | Where-Object { $_ -match '^' + [regex]::Escape($key) + '=' } | Select-Object -First 1
  if (-not $line) { return $null }
  return $line.Substring($line.IndexOf('=') + 1).Trim()
}

$dbHost = Get-Env 'DB_HOST'
if (-not $dbHost) { $dbHost = '127.0.0.1' }
$dbPort = Get-Env 'DB_PORT'
if (-not $dbPort) { $dbPort = '3306' }
$dbName = Get-Env 'DB_NAME'
if (-not $dbName) { $dbName = 'gas_sales' }
$gasUser = Get-Env 'DB_USER'
if (-not $gasUser) { $gasUser = 'gas' }
$gasPass = Get-Env 'DB_PASSWORD'
if (-not $gasPass) { throw 'Chua co DB_PASSWORD trong backend\.env. Hay chay configure-env.ps1 truoc.' }

$mysqlOpts = @('--host=127.0.0.1', '--port=3306', '--protocol=TCP')

# 1. Tao user 'gas' + grants (bang root)
Write-Host '[1/4] Tao user MySQL "gas" + grants...' -ForegroundColor Cyan
$sql = @'
CREATE USER IF NOT EXISTS '__USER__'@'localhost' IDENTIFIED BY '__PASS__';
ALTER USER '__USER__'@'localhost' IDENTIFIED BY '__PASS__';
GRANT ALL PRIVILEGES ON `__DB__`.* TO '__USER__'@'localhost';
GRANT SELECT, RELOAD, LOCK TABLES, REPLICATION CLIENT ON *.* TO '__USER__'@'localhost';
FLUSH PRIVILEGES;
'@
$sql = $sql.Replace('__USER__', $gasUser).Replace('__PASS__', $gasPass).Replace('__DB__', $dbName)
$oldPwd = $env:MYSQL_PWD
$env:MYSQL_PWD = $RootPassword
& mysql @mysqlOpts '--user=root' "--execute=$sql"
if ($LASTEXITCODE -ne 0) { $env:MYSQL_PWD = $oldPwd; throw 'Khong tao duoc user gas. Kiem tra lai RootPassword.' }

# 2. Tao schema (dung user gas vua tao - backend/.env da tro toi user nay)
Write-Host '[2/4] Tao database + schema (db/setup.js)...' -ForegroundColor Cyan
$env:MYSQL_PWD = $gasPass
Push-Location $backend
try {
  node db/setup.js
  if ($LASTEXITCODE -ne 0) { throw 'db/setup.js that bai.' }
} finally {
  Pop-Location
}

# 3. Import dump hoac seed
if ($DumpPath) {
  if (-not (Test-Path $DumpPath)) {
    Write-Host 'WARN: -DumpPath ton tai nhung file khong tim thay - bo qua import.' -ForegroundColor Yellow
  } else {
    Write-Host '[3/4] Import du lieu tu dump...' -ForegroundColor Cyan
    $dumpForMysql = ((Resolve-Path $DumpPath).Path).Replace('\', '/')
    & mysql @mysqlOpts "--user=$gasUser" '--default-character-set=utf8mb4' "--execute=source $dumpForMysql"
    if ($LASTEXITCODE -ne 0) { Remove-Item Env:MYSQL_PWD; throw 'Import dump that bai.' }
    Write-Host '       Da import xong.' -ForegroundColor Green
  }
} else {
  Write-Host '[3/4] Khong co dump - chay db/seed.js (tao admin mac dinh neu chua co)...' -ForegroundColor Cyan
  Push-Location $backend
  try {
    node db/seed.js
    if ($LASTEXITCODE -ne 0) { throw 'db/seed.js that bai.' }
  } finally {
    Pop-Location
  }
}

# 4. Dat lai mat khau admin
if ($AdminPassword) {
  Write-Host '[4/4] Dat lai mat khau admin...' -ForegroundColor Cyan
  $env:ADMIN_RESET_USER = $AdminUsername
  $env:ADMIN_PW = $AdminPassword
  Push-Location $backend
  try {
    node "$($root)\deploy\windows-tunnel\reset-admin.js"
    if ($LASTEXITCODE -ne 0) { throw 'Reset mat khau admin that bai.' }
  } finally {
    Remove-Item Env:ADMIN_RESET_USER, Env:ADMIN_PW -ErrorAction SilentlyContinue
    Pop-Location
  }
} else {
  Write-Host '[4/4] Bo qua doi mat khau admin (khong truyen -AdminPassword).' -ForegroundColor Yellow
  Write-Host '       QUAN TRONG: hay doi mat khau admin tren http://localhost:4000 truoc khi mo tunnel!' -ForegroundColor Yellow
}

Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
Write-Host '[OK] Database san sang.' -ForegroundColor Green