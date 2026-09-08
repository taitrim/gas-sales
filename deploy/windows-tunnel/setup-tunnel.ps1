param(
  [Parameter(Mandatory = $true)]
  [string]$Domain,
  [string]$TunnelName = 'gas-sales'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw 'Khong tim thay cloudflared. Hay chay install-requirements.ps1 truoc.'
}

$cfDir = Join-Path $env:USERPROFILE '.cloudflared'
if (-not (Test-Path $cfDir)) { New-Item -ItemType Directory -Path $cfDir | Out-Null }

# 1. Dang nhap Cloudflare (luu cert.pem), bat buoc mot lan
if (-not (Test-Path (Join-Path $cfDir 'cert.pem'))) {
  Write-Host 'Chua dang nhap Cloudflare. Trinh duyet se mo ra - hay chon domain roi Dang nhap.' -ForegroundColor Cyan
  cloudflared tunnel login
  if (-not (Test-Path (Join-Path $cfDir 'cert.pem'))) {
    throw 'Dang nhap that bai: khong thay cert.pem trong .cloudflared.'
  }
  Write-Host 'Da dang nhap.' -ForegroundColor Green
}

# 2. Tao tunnel neu chua co
Write-Host '[2/6] Kiem tra tunnel '"'"'$TunnelName'"'"'...' -ForegroundColor Cyan
$listJson = cloudflared tunnel list --output json 2>$null
$tunnel = $null
if ($listJson) {
  $list = $listJson | ConvertFrom-Json
  $tunnel = $list | Where-Object { $_.Name -eq $TunnelName } | Select-Object -First 1
}
if (-not $tunnel) {
  Write-Host '       Tao tunnel moi...' -ForegroundColor Cyan
  $createOut = cloudflared tunnel create $TunnelName
  $createOut
  $listJson = cloudflared tunnel list --output json 2>$null
  $tunnel = ($listJson | ConvertFrom-Json) | Where-Object { $_.Name -eq $TunnelName } | Select-Object -First 1
  if (-not $tunnel) { throw 'Tao tunnel that bai.' }
}
$tunnelId = $tunnel.Id
Write-Host "       Tunnel ID: $tunnelId" -ForegroundColor Green

# 3. Route DNS (CNAME) neu chua co
Write-Host '[3/6] Route DNS...' -ForegroundColor Cyan
cloudflared tunnel route dns $TunnelName $Domain | Out-Host

# 4. Ghi config.yml
Write-Host '[4/6] Ghi config.yml...' -ForegroundColor Cyan
$cfgPath = Join-Path $cfDir 'config.yml'
$credFile = Join-Path $cfDir "$tunnelId.json"
$cfg = @"
tunnel: $TunnelName
credentials-file: $credFile

ingress:
  - hostname: $Domain
    service: http://localhost:4000
  - service: http_status:404
"@
[System.IO.File]::WriteAllText($cfgPath, $cfg, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "       Da ghi: $cfgPath"

# 5. Cai service cloudflared (chay nen)
$svc = Get-Service -Name cloudflared -ErrorAction SilentlyContinue
if (-not $svc) {
  Write-Host '[5/6] Cai service cloudflared...' -ForegroundColor Cyan
  cloudflared service install
  if ($LASTEXITCODE -ne 0) { throw 'cloudflared service install that bai (can quyen Admin).' }
  $svc = Get-Service -Name cloudflared -ErrorAction SilentlyContinue
}

# 6. Khoi dong / khoi dong lai
Write-Host '[6/6] Khoi dong service...' -ForegroundColor Cyan
if ($svc.Status -eq 'Running') {
  Restart-Service -Name cloudflared -Force
} else {
  Start-Service -Name cloudflared
}

Start-Sleep -Seconds 5
Write-Host
Write-Host 'Kiem tra: https://'$Domain'/api/health' -ForegroundColor Green
Write-Host 'Neu chua vao:  cloudflared tunnel info '"'"'$TunnelName'"'"',  Get-Service cloudflared' -ForegroundColor Cyan
Write-Host 'Commandline de go roi cai lai service:  cloudflared service uninstall' -ForegroundColor Cyan