@echo off
title AiChatDesk Server
echo ============================================
echo   AiChatDesk Server - Starting...
echo ============================================
echo.

:: Check if MongoDB is running
echo [1/3] Checking MongoDB...
sc query MongoDB >nul 2>&1
if %errorlevel% neq 0 (
    echo MongoDB service not found. Trying to start mongod...
    start /min mongod
    timeout /t 3 /nobreak >nul
) else (
    echo MongoDB service is running.
)

:: Navigate to server directory
echo [2/3] Navigating to server directory...
cd /d D:\Claude\AiChatDesk\templates\server

:: Start the server
echo [3/3] Starting AiChatDesk server on port 8005...
echo.
echo ============================================
echo   Server URLs:
echo   Health:    http://localhost:8005/health
echo   Widget:    http://localhost:8005/test/index.html
echo   Dashboard: http://localhost:8005/test/dashboard.html
echo   Signup:    http://localhost:8005/test/signup.html
echo ============================================
echo.
echo   Login: admin@aichatdesk.com / changeme123
echo ============================================
echo.
echo Press Ctrl+C to stop the server.
echo.

node index.js

pause
