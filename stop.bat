@echo off
chcp 65001 >nul
echo Dang dung GAS Sales servers (port 4000, 5173)...

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":4000" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%p >nul 2>nul
)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%p >nul 2>nul
)

echo Da dung xong. Nhan phim bat ky de dong cua so.
pause >nul