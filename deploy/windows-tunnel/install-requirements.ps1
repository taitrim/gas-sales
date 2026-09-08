param(
  [switch]$SkipWinget
)

$ErrorActionPreference = 'Stop'

function Test-Cmd($name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

Write-Host "=== Kiem tra moi truong (Node, MySQL, cloudflared) ===" -ForegroundColor Cyan

$node = Test-Cmd node
$mysqlCli = Test-Cmd mysql
if ($node) {
  Write-Host "[OK] Node: $((node -v) 2>$null)" -ForegroundColor Green
} else {
  Write-Host "[THIEU] Node.js" -ForegroundColor Yellow
  Write-Host '       -> Tai LTS tai: https://nodejs.org/en/download'
}

$mysqldump = Test-Cmd mysqldump
if ($mysqldump) {
  Write-Host "[OK] MySQL (mysqldump san sang)" -ForegroundColor Green
} else {
  if ($mysqlCli) {
    Write-Host "[OK] MySQL (mysql) - nhung thieu mysqldump trong PATH" -ForegroundColor Yellow
    Write-Host '       -> Them thu muc bin cua MySQL (chua mysqldump) vao PATH, vi du: C:\Program Files\MySQL\MySQL Server 8.0\bin'
  } else {
    Write-Host "[THIEU] MySQL 8" -ForegroundColor Yellow
  }
}

$cfd = Test-Cmd cloudflared
if ($cfd) {
  Write-Host "[OK] cloudflared: $((cloudflared --version) 2>$null)" -ForegroundColor Green
  $cfdPath = Split-Path (Get-Command cloudflared).Source
  Write-Host "       duong dan: $cfdPath"
} else {
  Write-Host "[THIEU] cloudflared" -ForegroundColor Yellow
  Write-Host '       -> Tai: https://github.com/cloudflare/cloudflared/releases (file cloudflared-windows-amd64.exe)'
  Write-Host '       -> dat ten cloudflared.exe va dua vao thu muc trong PATH'
}

if ($SkipWinget) {
  Write-Host
  Write-Host 'Da chay o che do chi kiem tra.' -ForegroundColor Cyan
  exit 0
}

$hasWinget = Test-Cmd winget
if (-not $hasWinget) {
  Write-Host
  Write-Host 'Winget khong co tren may nay - vui long cai thu cong theo link o tren va chay lai.' -ForegroundColor Red
  exit 1
}

if (-not $node) {
  Write-Host 'Dang cai Node LTS qua winget...' -ForegroundColor Yellow
  winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
}

if (-not $mysqlCli -and -not $mysqldump) {
  Write-Host 'Dang cai MySQL 8 qua winget (trinh cai dat se mo ban setup - nho mat khau root!)...' -ForegroundColor Yellow
  winget install --id Oracle.MySQL --accept-source-agreements --accept-package-agreements
  Write-Host 'QUAN TRONG: mo MySQL Command Line Client va nhap root password de xac nhan da cai xong.' -ForegroundColor Yellow
}

if (-not $cfd) {
  Write-Host 'Dang tai cloudflared ve thu muc hien tai...' -ForegroundColor Yellow
  Invoke-WebRequest -UseBasicParsing 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '.\cloudflared.exe'
  $dir = (Get-Location).Path
  Write-Host "[OK] Da tai cloudflared.exe vao $dir" -ForegroundColor Green
  Write-Host 'Them thu muc nay vao PATH (henvironment variables) hoac copy cloudflared.exe vao C:\Windows\System32' -ForegroundColor Yellow
}

Write-Host
Write-Host 'Kiem tra lai bang cach chay lai script nay (bo -SkipWinget).' -ForegroundColor Cyan