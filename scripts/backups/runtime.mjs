import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(path.resolve('.tools/deploy-tools/package.json'));
export const root=path.resolve('.tools/backups');
export const pgBin=path.resolve(process.env.RECTORPLUS_PG_BIN||'.tools/postgresql/pgsql/bin');
export const pgTool=name=>path.join(pgBin,name+(process.platform==='win32'?'.exe':''));
const cli=path.resolve('.tools/deploy-tools/node_modules/supabase/dist/supabase.js');
export function cloud(args){
 const result=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',env:process.env,maxBuffer:16*1024*1024});
 if(result.status!==0)throw Error('Connexion CLI Supabase impossible. Vérifiez la session administrateur.');
 return result.stdout;
}
export async function projectRef(){
 const ref=process.env.RECTORPLUS_PROJECT_REF||(await readFile('supabase/.temp/project-ref','utf8')).trim();
 if(!/^[a-z]{20}$/.test(ref))throw Error('Référence de projet invalide');return ref;
}
export async function key(){
 await mkdir(root,{recursive:true});
 if(process.env.RECTORPLUS_BACKUP_KEY){const result=Buffer.from(process.env.RECTORPLUS_BACKUP_KEY,'base64');if(result.length!==32)throw Error('Clé incorrecte');return result;}
 if(process.platform!=='win32')throw Error('Configurer RECTORPLUS_BACKUP_KEY (32 octets en base64) dans un coffre de secrets.');
 // Only the current Windows user can unprotect this locally stored key.
 const program=`Add-Type -AssemblyName System.Security
$keyPath=Join-Path (Get-Location) '.tools/backups/key.dpapi'
if (-not (Test-Path -LiteralPath $keyPath)) {
 $backupKey=New-Object byte[] 32
 $rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
 $rng.GetBytes($backupKey)
 $protectedKey=[System.Security.Cryptography.ProtectedData]::Protect($backupKey,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)
 $temporaryKey=$keyPath+'.'+[Guid]::NewGuid().ToString()+'.tmp'
 [System.IO.File]::WriteAllBytes($temporaryKey,$protectedKey)
 try { [System.IO.File]::Move($temporaryKey,$keyPath) }
 catch { if (-not (Test-Path -LiteralPath $keyPath)) { throw } }
 finally { if (Test-Path -LiteralPath $temporaryKey) { Remove-Item -LiteralPath $temporaryKey } }
 $rng.Dispose()
}
$savedKey=[System.IO.File]::ReadAllBytes($keyPath)
$clearKey=[System.Security.Cryptography.ProtectedData]::Unprotect($savedKey,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)
[Convert]::ToBase64String($clearKey)`;
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',program],{encoding:'utf8',windowsHide:true});
 if(result.status!==0)throw Error('Protection Windows de la clé impossible');
 const bytes=Buffer.from(result.stdout.trim(),'base64');if(bytes.length!==32)throw Error('Clé locale incorrecte');return bytes;
}
export async function connection(ref){
 const plan=cloud(['db','dump','--remote='+ref,'--dry-run']);
 const caFile=process.env.RECTORPLUS_DB_CA||path.resolve('.tools/supabase-ca.crt');
 const ca=await readFile(caFile,'utf8');
 const env={...process.env,PGSSLMODE:'verify-full',PGSSLROOTCERT:caFile};
 for(const name of ['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE']){
  const match=plan.match(new RegExp('(?:export\\s+)?'+name+'=(?:"([^"\\r\\n]*)"|\'([^\'\\r\\n]*)\'|([^\\s;]+))'));
  if(!match)throw Error('Plan de connexion non reconnu : '+name);
  env[name]=match[1]??match[2]??match[3];
  if(/[\r\n]/.test(env[name]))throw Error('Configuration de connexion invalide');
 }
 const {Client}=require('pg');
 const client=new Client({host:env.PGHOST,port:Number(env.PGPORT),user:env.PGUSER,password:env.PGPASSWORD,database:env.PGDATABASE,ssl:{rejectUnauthorized:true,ca},connectionTimeoutMillis:15_000});
 await client.connect();
 // The CLI temporary login assumes the project's postgres role for dumps.
 try{await client.query('set role postgres');await client.query("set statement_timeout='60s'");}catch(error){await client.end();throw error;}
 return {client,env};
}
export const ident=value=>'"'+value.replaceAll('"','""')+'"';
