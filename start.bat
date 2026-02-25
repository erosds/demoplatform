@echo off
setlocal

echo === Avvio DemoPlatform ===

set PROJECT_DIR=%~dp0
set VENV_PYTHON=%PROJECT_DIR%backend\.venv\Scripts\python.exe

:: ── Pulizia processi ──────────────────────────────────────────
echo [0/2] Pulizia processi residui...

:: Kill TUTTI i python.exe con "uvicorn" nella command line
:: (copre sia il reloader che il worker di --reload)
powershell -NoProfile -Command ^
  "Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'python*' -and $_.CommandLine -like '*uvicorn*' } | ForEach-Object { Write-Host ('  stop PID ' + $_.ProcessId + ' (uvicorn)'); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

:: Kill TUTTI i node.exe con "vite" nella command line (frontend)
powershell -NoProfile -Command ^
  "Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'node*' -and $_.CommandLine -like '*vite*' } | ForEach-Object { Write-Host ('  stop PID ' + $_.ProcessId + ' (vite)'); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

:: Fallback: killa per porta nel caso ci fosse qualcosa rimasto
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    echo   stop PID %%a ^(porta 8000 fallback^)
    taskkill /PID %%a /F /T >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    echo   stop PID %%a ^(porta 5173 fallback^)
    taskkill /PID %%a /F /T >nul 2>&1
)

:: Attesa rilascio porte (max 10s)
set _w=0
:wait_ports
powershell -NoProfile -Command ^
  "if ((Get-NetTCPConnection -LocalPort 8000 -EA SilentlyContinue) -or (Get-NetTCPConnection -LocalPort 5173 -EA SilentlyContinue)) { exit 1 } else { exit 0 }"
if %errorlevel% equ 0 goto ports_ok
set /a _w+=1
if %_w% lss 10 ( timeout /t 1 /nobreak >nul & goto wait_ports )
echo   Attenzione: porte ancora occupate, procedo comunque.
:ports_ok
echo   Porte liberate.

:: ── Backend (FastAPI nel venv) ────────────────────────────────
echo [1/2] Avvio backend ^(.venv^)...
start "Backend - DemoPlatform" cmd /k "cd /d %PROJECT_DIR%backend && %VENV_PYTHON% -m uvicorn app.main:app --reload --port 8000"

:: Health-check backend (max 20s)
set _t=0
:wait_backend
timeout /t 1 /nobreak >nul
curl -s -o nul http://localhost:8000/ 2>nul
if %errorlevel% equ 0 ( echo   Backend pronto. & goto start_frontend )
set /a _t+=1
if %_t% lss 20 goto wait_backend
echo   Backend non risponde in 20s — controlla la finestra Backend.

:: ── Frontend (React/Vite) ─────────────────────────────────────
:start_frontend
echo [2/2] Avvio frontend...
start "Frontend - DemoPlatform" cmd /k "cd /d %PROJECT_DIR% && npm start"

echo.
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:8000
echo.

endlocal
