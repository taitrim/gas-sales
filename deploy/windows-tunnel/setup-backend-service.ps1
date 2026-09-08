param(
  [string]$TaskName = 'GAS Sales Backend'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Khong tim thay node trong PATH. Hay cai Node.js va chay lai.'
}

$root = Split-Path -Parent $PSScriptRoot
$root = Split-Path -Parent $root
$backend = Join-Path $root 'backend'

if (-not (Test-Path (Join-Path $backend 'src\server.js'))) {
  throw "Khong thay src\server.js trong $backend"
}

$nodePath = (Get-Command node).Source
if (-not $nodePath -or -not (Test-Path $nodePath)) {
  throw 'Khong xac dinh duoc duong dan node.exe (duong dan tuong doi tu shim). Dung nvm/nvm-windows? Neu dung, hay cai Node LTS binh thuong.'
}

Write-Host "[i] node.exe: $nodePath"
Write-Host "[i] backend:  $backend"

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "[i] Task '$TaskName' da ton tai - se ghi de." -ForegroundColor Yellow
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute $nodePath -Argument 'src/server.js' -WorkingDirectory $backend
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Seconds 0) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'GAS Sales Pro backend (Express, port 4000)' -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 4

$health = $null
try {
  $health = Invoke-RestMethod 'http://127.0.0.1:4000/api/health' -TimeoutSec 5
} catch {
  Write-Host 'WARN: chua nhan duoc health sau 4 giay - kiem tra Task Scheduler log.' -ForegroundColor Yellow
}

if ($health -and $health.success) {
  Write-Host "[OK] Backend da chay: $($health.data.status) / db=$($health.data.db) / v$($health.data.version)" -ForegroundColor Green
} else {
  Write-Host 'Chay lai khi can: Start-ScheduledTask -TaskName "'$TaskName'"' -ForegroundColor Cyan
  Write-Host 'Xem log server: Task Scheduler -> task -> "Run level" log console cua task.' -ForegroundColor Cyan
}