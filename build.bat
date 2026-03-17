@echo off
chcp 936 >nul
setlocal EnableDelayedExpansion

echo ==========================================
echo    Localization Tool Build Script
echo ==========================================
echo.

REM Check system Node.js
where node >nul 2>nul
if !errorlevel! neq 0 (
    echo [ERROR] Node.js not found.
    echo.
    echo Please install Node.js from https://nodejs.org
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo [1/4] Checking Node.js version...
node --version
echo.

echo [2/4] Installing dependencies...
call npm install
if !errorlevel! neq 0 (
    echo [ERROR] Failed to install dependencies
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)
echo.

echo [3/4] Compiling TypeScript...
call npm run compile
if !errorlevel! neq 0 (
    echo [ERROR] Compilation failed
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)
echo.

echo [4/4] Packaging extension...
call npx vsce package
if !errorlevel! neq 0 (
    echo [ERROR] Packaging failed
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)
echo.

echo ==========================================
echo    Build Success!
echo ==========================================
echo.
echo Generated file:
for %%f in (*.vsix) do (
    echo   - %%f
)
echo.
echo Install steps:
echo   1. Open VS Code
echo   2. Press Ctrl+Shift+X to open Extensions
echo   3. Click "..." menu on top right
echo   4. Select "Install from VSIX"
echo   5. Choose the generated .vsix file
echo.
echo ==========================================
echo Press any key to close...
pause >nul
