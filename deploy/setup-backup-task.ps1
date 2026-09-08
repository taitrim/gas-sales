# ============================================================
# Tạo Task Scheduler chạy auto-backup.ps1 mỗi ngày 02:00
# Chạy với quyền Admin (1 lần): 
#   powershell -ExecutionPolicy Bypass -File deploy\setup-backup-task.ps1
# ============================================================
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot '..\backend\scripts\auto-backup.ps1'
$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest

Register-ScheduledTask -TaskName 'GAS Sales Pro - Auto Backup' `
  -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null

Write-Output 'OK: Đã tạo Task "GAS Sales Pro - Auto Backup" (hàng ngày 02:00).'
