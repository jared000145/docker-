$ErrorActionPreference='Stop'
$workspace=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$cacheRoot=[IO.Path]::GetFullPath((Join-Path $workspace '.tools/gradle/caches/8.14.3'))
$fixed=0
foreach($kind in @('transforms','groovy-dsl')) {
 $parent=Join-Path $cacheRoot $kind
 foreach($folder in (Get-ChildItem -LiteralPath $parent -Directory -ErrorAction SilentlyContinue)) {
  if($folder.Name -notmatch '^([a-f0-9]{32})-[a-f0-9-]{36}$'){continue}
  $hash=$Matches[1]
  if($kind -eq 'transforms' -and -not(Test-Path -LiteralPath (Join-Path $folder.FullName 'metadata.bin'))){continue}
  $source=[IO.Path]::GetFullPath($folder.FullName);$target=[IO.Path]::GetFullPath((Join-Path $parent $hash))
  if(-not $source.StartsWith($cacheRoot+[IO.Path]::DirectorySeparatorChar) -or -not $target.StartsWith($cacheRoot+[IO.Path]::DirectorySeparatorChar)){throw 'Unsafe Gradle cache path'}
  if(Test-Path -LiteralPath $target){continue}
  for($attempt=0;$attempt -lt 6;$attempt++) {try{Move-Item -LiteralPath $source -Destination $target;$fixed++;break}catch{if($attempt -eq 5){throw};Start-Sleep -Milliseconds 500}}
 }
}
Write-Output $fixed
