@echo off
echo ========================================
echo   Building MS Store Billing System
echo ========================================

echo.
echo [0/4] Closing old application...
taskkill /F /IM ms-store-billing.exe >nul 2>&1

echo.
echo [1/4] Removing old executable...
if exist ms-store-billing.exe (
    del /F /Q ms-store-billing.exe
)

echo.
echo [2/4] Cleaning old frontend build...
if exist build (
    rmdir /s /q build
)

echo.
echo [3/4] Building React frontend...
cd frontend
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)

echo.
echo [4/4] Building Go backend...
cd ..
go build -o ms-store-billing.exe -ldflags="-s -w -H=windowsgui" main.go
if errorlevel 1 (
    echo ERROR: Backend build failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   BUILD SUCCESSFUL!
echo ========================================

echo.
echo Executable created: ms-store-billing.exe
echo.
echo To run:
echo ms-store-billing.exe
echo.

pause