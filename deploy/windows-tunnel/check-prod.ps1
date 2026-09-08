param(
  [Parameter(Mandatory = $true)]
  [string]$Domain
)

$ErrorActionPreference = 'Stop'

function Say($ok, $msg) {
  if ($ok) { Write-Host "[OK]   $msg" -ForegroundColor Green }
  else { Write-Host "[FAIL] $msg" -ForegroundColor Red }
}

Write-Host '=== Kiem tra production ===' -ForegroundColor Cyan
Write-Host

# 1. Health local
$local = $null
try { $local = Invoke-RestMethod 'http://127.0.0.1:4000/api/health' -TimeoutSec 5 } catch {}
Say ($local -and $local.success -and $local.data.db -eq 'connected'), "Backend local :4000 (db=$(if($local){$local.data.db}else{'KHONG TRA LOI'}))"

# 2. Health qua HTTPS (tunnel)
$remote = $null
try { $remote = Invoke-RestMethod ('https://' + $Domain + '/api/health') -TimeoutSec 15 } catch {}
Say ($remote -and $remote.success -and $remote.data.db -eq 'connected'), "Tunnel HTTPS https://$Domain "

# 3. Frontend qua HTTPS
$web = $null
try { $web = Invoke-WebRequest ('https://' + $Domain + '/') -UseBasicParsing -TimeoutSec 15 } catch {}
Say ($web -and $web.StatusCode -eq 200 -and $web.Content -match 'id="root"'), 'Frontend render (index.html) tai /'

# 4. Login - ma password admin mac dinh KHONG duoc con
$login = $null
try { $login = Invoke-RestMethod -Method Post -Uri ('https://' + $Domain + '/api') -ContentType 'application/json' -Body '{"action":"loginUser","username":"admin","password":"admin123"}' -TimeoutSec 15 } catch {}
Say (-not $login -or -not $login.success), 'admin/admin123 KHONG dang nhap duoc (da doi mat khau)'

# 5. Login bang tai khoan khac thi cung kiem tra service
$body = Read-Host 'Nhap username admin de test login (Enter neu bo qua)'
if ($body) {
  $pw = Read-Host -AsSecureString 'Nhap mat khau admin'
  $plain = [System.Net.NetworkCredential]::new('', $pw).Password
  $login2 = $null
  try {
    $payload = @{ action = 'loginUser'; username = $body; password = $plain } | ConvertTo-Json -Compress
    $login2 = Invoke-RestMethod -Method Post -Uri ('https://' + $Domain + '/api') -ContentType 'application/json' -Body $payload -TimeoutSec 15
  } catch {}
  Say ($login2 -and $login2.success), "Login OK: $body (role=$(if($login2.data){$login2.data.role}))"
}

Write-Host
Write-Host '=== Xong. Neu dong [FAIL] nao do, xem runbook de xu ly. ===' -ForegroundColor Cyan