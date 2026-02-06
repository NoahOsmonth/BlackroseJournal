@echo off
echo ==========================================
echo Expo Go Launcher for SDK 54
echo ==========================================
echo.

REM Step 1: Clear Metro cache
echo [1/3] Clearing Metro bundler cache...
if exist .expo (
    rmdir /s /q .expo
    echo      Cache cleared.
) else (
    echo      No cache to clear.
)

REM Step 2: Clear npm cache (optional, uncomment if needed)
REM echo [2/3] Clearing npm cache...
REM call npm cache clean --force

echo.
echo [2/3] Starting Expo with LAN connection...
echo      Make sure your phone is on the SAME Wi-Fi network as this computer.
echo.
echo      If this doesn't work, try:
echo        - Option A: Run 'npx expo start --tunnel' for public Wi-Fi
echo        - Option B: Update Expo Go app to latest version
echo        - Option C: Check Windows Firewall settings
echo.

REM Step 3: Start Expo
echo [3/3] Starting Metro bundler...
call npx expo start --clear

pause
