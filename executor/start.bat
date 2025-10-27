@echo off
REM Kiro Task Automation Launcher for Windows

echo.
echo 🚀 Kiro Task Automation System
echo ================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js 14+ first.
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js found: %NODE_VERSION%
echo.

REM Parse arguments
if "%1"=="--help" goto :help
if "%1"=="-h" goto :help
if "%1"=="/?" goto :help

REM Show execution plan
echo 📋 Execution Plan:
echo    1. Sentiment ^& Moderation Service
echo    2. Discord-Reddit Connector
echo    3. Zippy Trivia Show
echo    4. Match-and-Mind Puzzle Suite
echo    5. Community Quest RPG
echo    6. Matchmaking ^& Friend Finder
echo.

REM Confirm execution
set /p CONFIRM="🤔 Start autonomous execution? (y/n) "
if /i not "%CONFIRM%"=="y" (
    echo ❌ Execution cancelled
    exit /b 0
)

echo.
echo 🎯 Starting autonomous executor...
echo 📝 Logs will be saved to: execution.log
echo 💾 State will be saved to: execution-state.json
echo.
echo ⚠️  You can stop execution anytime with Ctrl+C
echo    Progress will be saved and you can resume later
echo.
echo ================================
echo.

REM Run the executor
node autonomous-executor.js %*

echo.
echo ================================
if %ERRORLEVEL% EQU 0 (
    echo ✅ Execution completed!
) else (
    echo ⚠️  Execution finished with errors
)
echo.
echo 📊 Check execution-state.json for summary
echo 📝 Review execution.log for details
echo.

REM Keep window open
pause
exit /b 0

:help
echo Usage: start.bat [options]
echo.
echo Options:
echo   --spec ^<name^>    Execute only the specified spec
echo   --resume         Resume from last checkpoint
echo   --help, -h, /?   Show this help message
echo.
echo Examples:
echo   start.bat                                    # Run all specs
echo   start.bat --spec sentiment-moderation-service
echo   start.bat --resume
echo.
exit /b 0
