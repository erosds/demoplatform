@echo off
setlocal

echo === Avvio VideDemo ===

set PROJECT_DIR=%~dp0

:: Killa eventuali processi residui sulla porta 8000
echo [0/2] Pulizia porta 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    echo     Termino processo PID %%a
    taskkill /PID %%a /F >nul 2>&1
)

:: Backend (FastAPI)
echo [1/2] Avvio backend FastAPI...
start "Backend" cmd /k "cd /d %PROJECT_DIR%backend && python -m uvicorn app.main:app --reload --port 8000"

:: Breve attesa per lasciare partire il backend
timeout /t 2 /nobreak >nul

:: Frontend (React/Vite)
echo [2/2] Avvio frontend...
start "Frontend" cmd /k "cd /d %PROJECT_DIR% && npm start"

echo.
echo App in esecuzione:
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo.
echo Chiudi le finestre del terminale per fermare i processi.

endlocal
