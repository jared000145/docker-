@echo off
setlocal
cd /d "%~dp0"
set "PATH=%CD%\.tools;%PATH%"
if exist ".tools\windows-roots.pem" set "NODE_EXTRA_CA_CERTS=%CD%\.tools\windows-roots.pem"
echo Connexion officielle Supabase pour le deploiement de RectorPlus.
echo Ouvrez le lien indique et saisissez le code ici, jamais dans le chat.
".tools\node.exe" ".tools\deploy-tools\node_modules\supabase\dist\supabase.js" login --agent=no --output-format=text
if errorlevel 1 (
  echo La connexion n'a pas abouti. Relancez ce fichier pour reessayer.
) else (
  echo Connexion terminee. Vous pouvez revenir au chat.
)
pause
