param([int]$Port = 4173)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($npmCommand) {
  if (!(Test-Path -LiteralPath node_modules)) { & $npmCommand.Source ci; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
  & $npmCommand.Source run dev -- --host 127.0.0.1 --port $Port --strictPort
} else {
  $runtimePath = Join-Path $PSScriptRoot '.tools/node.exe'
  $npmPath = Join-Path $PSScriptRoot '.tools/package/bin/npm-cli.js'
  if (!(Test-Path -LiteralPath $runtimePath) -or !(Test-Path -LiteralPath $npmPath)) { throw 'Installez Node 22 ou supérieur, puis relancez ce script.' }
  $env:PATH = (Split-Path $runtimePath) + ';' + $env:PATH
  $certificatePath = Join-Path $PSScriptRoot '.tools/windows-roots.pem'
  if (Test-Path -LiteralPath $certificatePath) { $env:NODE_EXTRA_CA_CERTS = $certificatePath }
  if (!(Test-Path -LiteralPath node_modules)) { & $runtimePath $npmPath ci; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
  & $runtimePath $npmPath run dev -- --host 127.0.0.1 --port $Port --strictPort
}
