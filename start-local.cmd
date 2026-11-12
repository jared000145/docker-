@echo off
setlocal
cd /d "%~dp0"
if exist ".tools\node.exe" goto bundled
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo Installez Node 22 ou superieur pour lancer RectorPlus.
  exit /b 1
)
if not exist node_modules (
  call npm.cmd ci
  if errorlevel 1 exit /b 1
)
call npm.cmd run dev -- --host 127.0.0.1 --port 4173 --strictPort
exit /b
:bundled
set "PATH=%CD%\.tools;%PATH%"
if exist ".tools\windows-roots.pem" set "NODE_EXTRA_CA_CERTS=%CD%\.tools\windows-roots.pem"
if not exist node_modules (
  ".tools\node.exe" ".tools\package\bin\npm-cli.js" ci
  if errorlevel 1 exit /b 1
)
".tools\node.exe" ".tools\package\bin\npm-cli.js" run dev -- --host 127.0.0.1 --port 4173 --strictPort
