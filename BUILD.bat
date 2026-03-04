@echo off
setlocal

for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set VERSION=%%v

echo Building Stegano v%VERSION%...
call pnpm build

if %errorlevel% neq 0 (
    echo Build failed!
    exit /b 1
)

set ZIPNAME=stegano-chrome-%VERSION%.zip
if exist "%ZIPNAME%" del "%ZIPNAME%"

powershell -Command "Compress-Archive -Path '.output/chrome-mv3/*' -DestinationPath '%ZIPNAME%'"

if %errorlevel% neq 0 (
    echo Zip failed!
    exit /b 1
)

echo Done: %ZIPNAME%
