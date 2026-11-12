import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,readdir,mkdir,writeFile,unlink} from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import {key,root,pgTool,ident} from './runtime.mjs';
import {decrypt,readVerified} from './crypto.mjs';

// Intentionally accepts no target database URL. This command can only restore
// into a fresh loopback PostgreSQL instance created by this process.
const directory=path.resolve(process.argv[2]||(await readdir(root,{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>path.join(root,e.name)).sort().at(-1)||'');
if(!directory.startsWith(root+path.sep))throw Error('Archive hors du répertoire de sauvegardes');
const secret=await key();let started=false;let client;let reportPath;
const lab=path.resolve('.tools/restore-labs',new Date().toISOString().replaceAll(':','-'));
const dataDir=path.join(lab,'database');
const require=createRequire(path.resolve('.tools/deploy-tools/package.json'));
const run=(name,args,options={})=>spawnSync(pgTool(name),args,{windowsHide:true,maxBuffer:64*1024*1024,...options});
try{
 const status=JSON.parse(await readFile(path.join(directory,'status.json'),'utf8'));
 if(status.state!=='captured')throw Error('Capture incomplète');
 const manifest=JSON.parse(decrypt(await readFile(path.join(directory,'manifest.enc')),secret,status.project+'/manifest.enc').toString());
 if(manifest.project!==status.project||manifest.format!==1)throw Error('Manifeste incorrect');
 reportPath=path.join(directory,'restore-check.json');
 await writeFile(reportPath,JSON.stringify({checkedAt:new Date().toISOString(),applicationDatabaseRestore:'running',productionTouched:false}));
 for(const record of manifest.records)if(!/^(database|object-\d+)\.enc$/.test(record.file))throw Error('Fichier non autorisé');
 const record=manifest.records.find(r=>r.kind==='postgres');if(!record)throw Error('Base absente de l’archive');
 const dump=await readVerified(path.join(directory,record.file),secret,status.project+'/'+record.file,record);
 await mkdir(lab,{recursive:true});
 if(process.platform==='win32'){
  const acl=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$labPath=$env:RECTORPLUS_RESTORE_LAB; $labSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; & icacls.exe $labPath /inheritance:r /grant:r ('*'+$labSid+':(OI)(CI)F') | Out-Null; exit $LASTEXITCODE`],{windowsHide:true,env:{...process.env,RECTORPLUS_RESTORE_LAB:lab}});
  if(acl.status!==0)throw Error('Protection du dossier de restauration impossible');
 }
 const password=randomBytes(32).toString('base64url'),passwordFile=path.join(lab,'init-password');
 await writeFile(passwordFile,password,{mode:0o600,flag:'wx'});
 let initialized;
 try{initialized=run('initdb',['-D',dataDir,'--username=postgres','--auth-host=scram-sha-256','--auth-local=trust','--encoding=UTF8','--locale=C','--pwfile='+passwordFile]);}
 finally{await unlink(passwordFile);}
 if(initialized.status!==0)throw Error('Initialisation du laboratoire impossible');
 const port=await new Promise((resolve,reject)=>{const server=net.createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const number=server.address().port;server.close(()=>resolve(number));});});
 const launched=run('pg_ctl',['-D',dataDir,'-o',`-h 127.0.0.1 -p ${port}`,'-l',path.join(lab,'postgres.log'),'-w','start'],{stdio:'ignore'});
 if(launched.status!==0)throw Error('Démarrage du laboratoire impossible');started=true;
 const {Client}=require('pg');
 client=new Client({host:'127.0.0.1',port,user:'postgres',password,database:'postgres',ssl:false});await client.connect();
 for(const role of manifest.roles){
  if(role.rolname==='postgres')continue;
  const attributes=[role.rolsuper?'SUPERUSER':'NOSUPERUSER',role.rolinherit?'INHERIT':'NOINHERIT',role.rolbypassrls?'BYPASSRLS':'NOBYPASSRLS'];
  await client.query(`create role ${ident(role.rolname)} NOLOGIN ${attributes.join(' ')}`);
 }
 const list=run('pg_restore',['--list'],{input:dump});if(list.status!==0)throw Error('Archive PostgreSQL illisible');
 const lines=list.stdout.toString().split(/\r?\n/);
 // The portable PostgreSQL distribution lacks the Supabase Vault extension.
 // Keep its data in the encrypted archive, but do not claim infrastructure restore.
 const excluded=lines.filter(line=>!line.startsWith(';')&&/supabase_vault|(?:^|\s)vault(?:\s|$)/.test(line));
 const toc=lines.filter(line=>!excluded.includes(line)).join('\n');
 const listFile=path.join(lab,'restore-list.txt');await writeFile(listFile,toc);
 const restored=run('pg_restore',['--no-owner','--use-list='+listFile,'--exit-on-error','--host=127.0.0.1','--port='+port,'--username=postgres','--dbname=postgres'],{input:dump,env:{...process.env,PGPASSWORD:password,PGSSLMODE:'disable'}});
 if(restored.status!==0){await writeFile(path.join(lab,'restore-error.log'),restored.stderr);throw Error('La restauration a échoué. Consulter le journal privé du laboratoire.');}
 const checked=[];
 for(const table of manifest.tables){
  const count=(await client.query(`select count(*)::text as count from ${ident(table.schema)}.${ident(table.name)}`)).rows[0].count;
  if(count!==table.rows)throw Error(`Nombre de lignes différent : ${table.schema}.${table.name}`);
  if(typeof table.rls==='boolean'){
   const security=(await client.query("select c.relrowsecurity as rls,(select count(*)::int from pg_policy p where p.polrelid=c.oid) as policies,(select count(*)::int from pg_constraint k where k.conrelid=c.oid and k.contype='f') as foreign_keys from pg_class c where c.oid=$1::regclass",[ident(table.schema)+'.'+ident(table.name)])).rows[0];
   if(security.rls!==table.rls||security.policies!==table.policies||security.foreign_keys!==table.foreign_keys)throw Error(`Structure de sécurité différente : ${table.schema}.${table.name}`);
  }
  checked.push({schema:table.schema,name:table.name,rows:count});
 }
 // Exercise the restored policies with temporary fixtures, then roll them back.
 const [tenantA,tenantB,studentA,studentB,adminA]=Array.from({length:5},()=>randomUUID());
 await client.query('begin');
 await client.query("insert into public.institutions(id,name,slug) values ($1,'Restore A',$3),($2,'Restore B',$4)",[tenantA,tenantB,'restore-'+tenantA,'restore-'+tenantB]);
 for(const userId of [studentA,studentB,adminA])await client.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,'{}')",[userId,userId+'@example.invalid']);
 await client.query('update public.profiles set institution_id=$1 where user_id in ($2,$3)',[tenantA,studentA,adminA]);
 await client.query('update public.profiles set institution_id=$1 where user_id=$2',[tenantB,studentB]);
 await client.query("insert into public.user_roles(user_id,role) values ($1,'admin')",[adminA]);
 await client.query("insert into public.payments(user_id,institution_id,amount,description) values ($1,$2,10,'Restore A'),($3,$4,10,'Restore B')",[studentA,tenantA,studentB,tenantB]);
 await client.query('set local role authenticated');
 await client.query("select set_config('request.jwt.claim.sub',$1,true)",[adminA]);
 const own=(await client.query('select count(*)::int as count from public.payments where institution_id=$1',[tenantA])).rows[0].count;
 const other=(await client.query('select count(*)::int as count from public.payments where institution_id=$1',[tenantB])).rows[0].count;
 if(own!==1||other!==0)throw Error('L’isolation des établissements restaurés a échoué');
 await client.query('reset role');await client.query('rollback');
 let objects=0;
 for(const item of manifest.records.filter(r=>r.kind==='storage')){await readVerified(path.join(directory,item.file),secret,status.project+'/'+item.file,item);objects++;}
 const report={checkedAt:new Date().toISOString(),applicationDatabaseRestore:'passed',tables:checked.length,schemaSecurity:manifest.tables.every(table=>typeof table.rls==='boolean')?'passed':'not-tested',tenantIsolation:'passed',storageBytesVerified:objects,storageApiRestore:'not-tested',infrastructureRestore:'not-tested',excludedExtension:excluded.length?'supabase_vault':null,productionTouched:false};
 await writeFile(path.join(directory,'restore-check.json'),JSON.stringify(report,null,2));
 await writeFile(path.join(lab,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}catch(error){if(reportPath)await writeFile(reportPath,JSON.stringify({checkedAt:new Date().toISOString(),applicationDatabaseRestore:'failed',productionTouched:false}));console.error(error.message);process.exitCode=1;}
finally{
 if(client)await client.end().catch(()=>{});
 if(started)run('pg_ctl',['-D',dataDir,'-m','fast','-w','stop'],{stdio:'ignore'});
 secret.fill(0);
}
