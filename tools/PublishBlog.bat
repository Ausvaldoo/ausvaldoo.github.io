@echo off
chcp 65001 >nul
cd /d "E:\Git_Repos\blog-vitepress"

echo.
echo ============================================
echo   Publish Blog  /  一键发布博客
echo ============================================
echo.

echo [1/4] Changed files:
echo --------------------------------------------
git status --short
echo --------------------------------------------
echo.

for /f %%i in ('git status --porcelain ^| find /c /v ""') do set CHANGES=%%i
if "%CHANGES%"=="0" (
    echo No changes. Nothing to publish.
    echo.
    pause
    exit /b 0
)

set /p MSG=Commit message (press Enter for auto): 
if "%MSG%"=="" set MSG=update %date% %time%

echo.
echo [2/4] Staging...
git add -A

echo [3/4] Committing: %MSG%
git commit -m "%MSG%"
if errorlevel 1 (
    echo.
    echo Commit failed - nothing committed.
    pause
    exit /b 1
)

echo.
echo [4/4] Pushing to GitHub...
git push origin main
if errorlevel 1 (
    echo.
    echo Push FAILED. Check your network / SSH key.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Done! Live in about 1-2 minutes:
echo   https://ausvaldoo.github.io
echo ============================================
echo.
pause
