@echo off
title AiChatDesk - Stop Server
echo ============================================
echo   Stopping AiChatDesk Server...
echo ============================================
echo.

:: Find and kill node process on port 8005
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8005 ^| findstr LISTENING') do (
    echo Stopping process %%a on port 8005...
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo AiChatDesk server stopped.
echo.
pause
