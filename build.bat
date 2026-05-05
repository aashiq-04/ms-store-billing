@echo off
echo ========================================
echo   Building MS Store Billing System
echo ========================================

echo.
echo [1/3] Building React frontend...
cd frontend
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Building Go backend...
cd ..
go build -o ms-store-billing.exe -ldflags="-s -w -H=windowsgui" main.go
if errorlevel 1 (
    echo ERROR: Backend build failed!
    pause
    exit /b 1
)

echo.
echo [3/3] Cleaning up...
echo.
echo ========================================
echo   BUILD SUCCESSFUL!
echo ========================================
echo.
echo Executable created: ms-store-billing.exe
echo Database will be created on first run.
echo.
echo To run: ms-store-billing.exe
echo.
pause