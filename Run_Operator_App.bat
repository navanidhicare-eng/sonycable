@echo off
title Starting Android 13 Emulator & Sony Cable App
echo ========================================================
echo   Starting Android 13 Emulator for Sony Cable Operator
echo ========================================================
set ANDROID_HOME=C:\AndroidSdk
set ANDROID_SDK_ROOT=C:\AndroidSdk

echo Launching Emulator...
start "" "C:\AndroidSdk\emulator\emulator.exe" -avd Android_13_Test

echo Waiting for emulator to connect...
"S:\platform-tools\adb.exe" wait-for-device

echo Waiting for boot to complete...
:wait_boot
for /f "tokens=*" %%a in ('"S:\platform-tools\adb.exe" shell getprop sys.boot_completed') do set BOOT=%%a
if not "%BOOT%"=="1" (
    timeout /t 2 /nobreak >nul
    goto wait_boot
)

echo Installing latest Sony Cable Operator App...
"S:\platform-tools\adb.exe" install -r "Y:\sonycable\public\downloads\SonyCable_Operator.apk"

echo Opening Sony Cable Operator App...
"S:\platform-tools\adb.exe" shell am start -n com.sonycable.operator.flutter_operator_app/.MainActivity

echo ========================================================
echo   Done! Sony Cable Operator app is open on the emulator!
echo ========================================================
pause

