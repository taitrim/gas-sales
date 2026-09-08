@echo off
chcp 65001 >nul
echo ============================================================
echo   GAS Sales Pro - HTTPS Tunnel (Cloudflare Quick Tunnel)
echo ============================================================
echo.
echo  Yeu cau: Backend (4000) va Frontend (5173) DANG CHAY.
echo  Cu phap: tunnel.bat [cong]
echo    - tunnel.bat 5173  : HTTPS vao giao dien frontend (mac dinh)
echo    - tunnel.bat 4000  : HTTPS vao API backend
echo.
set PORT=%1
if "%PORT%"=="" set PORT=5173

:: Cai dat cloudflared neu chua co
where cloudflared >nul 2>nul
if errorlevel 1 (
  echo [*] Chua co cloudflared - dang tai x64 Windows...
  powershell -Command "& { $ProgressPreference='SilentlyContinue'; Invoke-WebRequest -UseBasicParsing 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%TEMP%\cloudflared.exe' }" 
  if not exist "%TEMP%\cloudflared.exe" (
    echo [!] Tai that bai. Vui long tai thu cong tai:
    echo     https://github.com/cloudflare/cloudflared/releases
    echo     file: cloudflared-windows-amd64.exe -> de gan nhat voi script
    pause
    exit /b 1
  )
  move /Y "%TEMP%\cloudflared.exe" "%~dp0cloudflared.exe" >nul
)

echo.
echo  Dang mo tunnel HTTPS vao http://localhost:%PORT%
echo  Quet/truy cap URL dang "https://........trycloudflare.com" ben tren
echo  tren dien thoai (cung mang internet).
echo  Nhan Ctrl+C de dung tunnel.
echo ============================================================
"%~dp0cloudflared.exe" tunnel --url http://localhost:%PORT%
pause
