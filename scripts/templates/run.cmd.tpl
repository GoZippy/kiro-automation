@echo off
REM run.cmd — convenience wrapper for KiroAutomation executor
REM Usage: run.cmd [--spec <name>] [--workspace <path>] [--resume] [--dry-run] [--verbose] [--force] [--help]
REM The script reads .kiro\config.json for the executorPath and workspace defaults.

SETLOCAL ENABLEDELAYEDEXPANSION
SET SCRIPT_DIR=%~dp0
SET CONFIG_PATH=%SCRIPT_DIR%.kiro\config.json
IF NOT EXIST "%CONFIG_PATH%" (
  echo Missing configuration file: %CONFIG_PATH%
  exit /b 2
)

REM Read executorPath from config.json using Node (handles JSON properly)
for /f "delims=" %%i in ('node -e "try{const c=require('./.kiro/config.json'); console.log(c.executorPath);}catch(e){console.error(e.message); process.exit(2);}"') do set EXEC_PATH=%%i

IF NOT DEFINED EXEC_PATH (
  echo Failed to determine executorPath from .kiro\config.json
  exit /b 3
)

REM If executorPath is relative, resolve it against the project root
for /f "delims=" %%p in ('node -e "const path=require('path'); const p=process.argv[1]; if(path.isAbsolute(p)) console.log(p); else console.log(path.resolve(process.argv[2], p));" "%EXEC_PATH%" "%SCRIPT_DIR%"') do set EXEC_PATH_RESOLVED=%%p

IF NOT DEFINED EXEC_PATH_RESOLVED (
  set EXEC_PATH_RESOLVED=%EXEC_PATH%
)

REM Print help if requested
echo Args: %*

REM Execute the executor via node (so JS files run correctly)
node "%EXEC_PATH_RESOLVED%" --workspace "%SCRIPT_DIR%" %*

ENDLOCAL