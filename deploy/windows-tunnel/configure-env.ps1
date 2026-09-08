param(
  [Parameter(Mandatory = $true)]
  [string]$Domain,
  [int]$JwtDays = 7
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$root = Split-Path -Parent $root
$backend = Join-Path $root 'backend'
$envPath = Join-Path $backend '.env'

if (-not $Domain -match '^[a-zA-Z0-9.-]+\.[a-z]{2,}$') {
  throw "Domain khong hop le: $Domain (vi du: shop.example.com)"
}

function New-Hex([int]$prefix, [int]$bytes) {
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $buf = New-Object byte[] $bytes
  $rng.GetBytes($buf)
  return $prefix + (($buf | ForEach-Object { $_.ToString('x2') }) -join '')
}

function New-Alnum([int]$len) {
  $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $buf = New-Object byte[] $len
  $rng.GetBytes($buf)
  $out = -join ($buf | ForEach-Object { $chars[$_ % $chars.Length] })
  return $out
}

$old = @{}
if (Test-Path $envPath) {
  Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      $old[$matches[1]] = $matches[2]
    }
  }
  Write-Host '[i] Da doc .env cu - giu lai cac gia tri khong liên quan den production.' -ForegroundColor Cyan
}

$jwtSecret = New-Hex '' 64
$dbPassword = New-Alnum 24

$lines = @()
$lines += '# ===== GAS Sales Pro - production ===='
$lines += 'NODE_ENV=production'
$lines += 'PORT=4000'
$lines += ('JWT_SECRET=' + $jwtSecret)
$lines += ('JWT_EXPIRES_IN=' + $JwtDays + 'd')
$lines += ''
$lines += 'DB_HOST=127.0.0.1'
$lines += 'DB_PORT=3306'
$lines += 'DB_USER=gas'
$lines += ('DB_PASSWORD=' + $dbPassword)
$lines += 'DB_NAME=gas_sales'
$lines += 'DB_CONNECTION_LIMIT=10'
$lines += ''
$lines += ('CORS_ORIGIN=https://' + $Domain.Trim())
$lines += ''
if ($old.ContainsKey('GEMINI_API_KEY')) { $lines += 'GEMINI_API_KEY=' + $old['GEMINI_API_KEY'] } else { $lines += 'GEMINI_API_KEY=' }
$lines += 'GEMINI_MODEL=' + $(if ($old.ContainsKey('GEMINI_MODEL')) { $old['GEMINI_MODEL'] } else { 'gemini-1.5-flash' })
$lines += ''
$lines += 'GOOGLE_CREDENTIALS_JSON=' + $(if ($old.ContainsKey('GOOGLE_CREDENTIALS_JSON')) { $old['GOOGLE_CREDENTIALS_JSON'] } else { '' })
$lines += 'GOOGLE_API_KEY=' + $(if ($old.ContainsKey('GOOGLE_API_KEY')) { $old['GOOGLE_API_KEY'] } else { '' })
$lines += 'IMPORT_MODE=' + $(if ($old.ContainsKey('IMPORT_MODE')) { $old['IMPORT_MODE'] } else { '' })
$lines += 'GOOGLE_SHEET_ID=' + $(if ($old.ContainsKey('GOOGLE_SHEET_ID')) { $old['GOOGLE_SHEET_ID'] } else { '' })

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($envPath, $lines, $utf8NoBom)

Write-Host "[OK] Da ghi backend\.env (production)." -ForegroundColor Green
Write-Host "     JWT_SECRET: da sinh ngau nhien 64 hex."
Write-Host "     DB_USER=gas / DB_PASSWORD: da sinh ngau nhien."
Write-Host "     CORS_ORIGIN=https://$Domain"