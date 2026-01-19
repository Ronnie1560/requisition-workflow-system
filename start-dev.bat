@echo off
REM Development Server Startup Script (Windows Batch)
REM Ensures only the multi-tenant client runs, not the old prototype

echo ========================================
echo   Requisition Workflow - Dev Server
echo ========================================
echo.

echo Step 1: Stopping old prototype server...
echo Checking for processes on port 3000...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo   Killing process PID %%a on port 3000...
    taskkill /PID %%a /F >nul 2>&1
    if errorlevel 1 (
        echo   Warning: Could not kill process %%a
    ) else (
        echo   OK: Killed process %%a
    )
)

echo.
echo Step 2: Stopping any stuck dev servers...
echo Checking for processes on port 5173...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    echo   Killing process PID %%a on port 5173...
    taskkill /PID %%a /F >nul 2>&1
    if errorlevel 1 (
        echo   Warning: Could not kill process %%a
    ) else (
        echo   OK: Killed process %%a
    )
)

echo.
echo Waiting for ports to free up...
timeout /t 2 /nobreak >nul

echo.
echo Step 3: Starting multi-tenant client dev server...
echo.
echo ========================================
echo.

cd client

echo Working directory: %CD%
echo Starting Vite dev server on http://localhost:5173
echo.
echo ========================================
echo.

npm run dev
