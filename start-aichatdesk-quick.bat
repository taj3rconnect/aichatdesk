@echo off
title AiChatDesk - Quick Start
echo ============================================
echo   AiChatDesk - Quick Start
echo ============================================
echo.

:: Check if MongoDB is running
echo [1/4] Checking MongoDB...
sc query MongoDB >nul 2>&1
if %errorlevel% neq 0 (
    echo MongoDB service not found. Trying to start mongod...
    start /min mongod
    timeout /t 3 /nobreak >nul
) else (
    echo MongoDB service is running.
)

:: Start server in a new window
echo [2/4] Starting server...
start "AiChatDesk Server" cmd /k "cd /d D:\Claude\AiChatDesk\templates\server && node index.js"

:: Wait for server to start
echo [3/4] Waiting for server to start...
timeout /t 4 /nobreak >nul

:: Open browser tabs
echo [4/4] Opening browser...
start http://localhost:8005/test/dashboard.html

echo.
echo ============================================
echo   AiChatDesk is running!
echo.
echo   Dashboard: http://localhost:8005/test/dashboard.html
echo   Widget:    http://localhost:8005/test/index.html
echo   Health:    http://localhost:8005/health
echo.
echo   Login: admin@aichatdesk.com / changeme123
echo.
echo   Server is running in a separate window.
echo   Close that window to stop the server.
echo ============================================
echo.
pause
