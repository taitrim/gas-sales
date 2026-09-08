@echo off
chcp 65001 >nul
echo ========================================
echo   GAS Sales Pro - Khoi dong server
echo ========================================

:: Dung process cu tren port 4000, 5173
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":4000" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>nul
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /F /PID %%p >nul 2>nul

:: Khoi dong Backend (port 4000)
echo.
echo [1/2] Khoi dong Backend (port 4000)...
start "Backend" cmd /k "cd /d %~dp0backend && node src/server.js"

:: Khoi dong Frontend (port 5173)
echo [2/2] Khoi dong Frontend (port 5173)...
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Da khoi dong! Truy cap: http://localhost:5173
echo Nhan phim bat ky de dong cua so nay.
pause >nul
