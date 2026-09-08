# ============================================================
# Auto-backup hàng ngày — Windows (Task Scheduler)
#
# Thiết lập (chạy 1 lần với quyền admin):
#   powershell -ExecutionPolicy Bypass -File deploy\setup-backup-task.ps1
#
# Hoặc tạo Task thủ công trong Task Scheduler:
#   - Trigger: Daily 02:00
#   - Action: powershell.exe -ExecutionPolicy Bypass -File "D:\AI SOFT\CHINCHINSHOP\backend\scripts\auto-backup.ps1"
#
# Đảm bảo mysqldump có trong PATH (MySQL bin) trước khi chạy.
# ============================================================
param(
  [int]$KeepDays = 14
)

$ErrorActionPreference = 'Stop'

# Đọc cấu hình DB từ backend/.env
$envFile = Join-Path $PSScriptRoot '..\.env'
$dbUser = 'root'
$dbPass = ''
$dbName = 'gas_sales'
$dbHost = '127.0.0.1'
$dbPort = '3306'

if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*DB_USER=(.*)$') { $dbUser = $matches[1].Trim() }
    if ($_ -match '^\s*DB_PASSWORD=(.*)$') { $dbPass = $matches[1].Trim() }
    if ($_ -match '^\s*DB_NAME=(.*)$') { $dbName = $matches[1].Trim() }
    if ($_ -match '^\s*DB_HOST=(.*)$') { $dbHost = $matches[1].Trim() }
    if ($_ -match '^\s*DB_PORT=(.*)$') { $dbPort = $matches[1].Trim() }
  }
}

$backupDir = Join-Path $PSScriptRoot '..\backups'
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }

$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$file = Join-Path $backupDir "backup-$ts.sql"

$env:MYSQL_PWD = $dbPass
# mysqldump --single-transaction (backup nhất quán khi MySQL vẫn chạy)
& mysqldump "--host=$dbHost" "--port=$dbPort" "--user=$dbUser" `
  '--default-character-set=utf8mb4' '--single-transaction' '--routines' $dbName |
  Out-File -FilePath $file -Encoding utf8

if ((Get-Item $file).Length -eq 0) {
  Remove-Item $file
  throw 'Backup thất bại: file dump trống.'
}

# Dọn backup cũ
$cutoff = (Get-Date).AddDays(-$KeepDays)
Get-ChildItem $backupDir -Filter '*.sql' | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item

Write-Output "OK backup-$ts.sql ($((Get-Item $file).Length) bytes)"
