@echo off
title Habit Tracker v3
color 0C
echo.
echo   ====================================
echo       HABIT TRACKER v3
echo   ====================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERRO] Node.js nao encontrado!
    echo   Baixe em: https://nodejs.org
    echo.
    pause
    exit /b
)

:: Verifica se a porta 3030 ja esta em uso e encerra o processo
echo   Verificando porta 3030...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3030" ^| findstr "LISTENING"') do (
    echo   Porta 3030 em uso pelo PID %%a. Encerrando...
    taskkill /PID %%a /F >nul 2>&1
    timeout /t 2 /nobreak >nul
)
echo   Iniciando servidor...
echo.

node server.js

echo.
echo   Servidor encerrado.
pause
