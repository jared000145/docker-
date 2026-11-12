import {spawn} from 'node:child_process';
import {access,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {key,root,pgTool,projectRef,cloud,connection,ident} from './runtime.mjs';
import {saveEncrypted} from './crypto.mjs';

// No production writes: a consistent PostgreSQL snapshot plus Storage downloads.
const pgDump=pgTool('pg_dump');
await access(pgDump).catch(()=>{throw Error('Outils PostgreSQL absents. Installer les binaires portables officiels et définir RECTORPLUS_PG_BIN.');});
const secret=await key(),ref=await projectRef();
const id=new Date().toISOString().replaceAll(':','-');
const directory=path.join(root,id);await mkdir(directory,{recursive:false});
await writeFile(path.join(directory,'status.json'),JSON.stringify({format:1,createdAt:id,project:ref,state:'incomplete'}),{flag:'wx'});
let client;
try{
 const connected=await connection(ref);client=connected.client;
 await client.query('begin isolation level repeatable read read only');
 const snapshot=(await client.query('select pg_export_snapshot() as id')).rows[0].id;
 const tables=(await client.query("select n.nspname as schema,c.relname as name,c.relrowsecurity as rls,(select count(*)::int from pg_policy p where p.polrelid=c.oid) as policies,(select count(*)::int from pg_constraint k where k.conrelid=c.oid and k.contype='f') as foreign_keys from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth','storage') and c.relkind in ('r','p') and not c.relispartition order by 1,2")).rows;
 for(const table of tables)table.rows=(await client.query(`select count(*)::text as count from ${ident(table.schema)}.${ident(table.name)}`)).rows[0].count;
 const inventory=async()=> (await client.query("select id,bucket_id,name,updated_at,metadata from storage.objects where bucket_id <> 'backups' order by bucket_id,name")).rows;
 const objects=await inventory();
 const buckets=(await client.query('select * from storage.buckets order by id')).rows;
 const roles=(await client.query("select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls from pg_roles where left(rolname,3)<>'pg_' order by rolname")).rows;
 const extensions=(await client.query('select extname,extversion from pg_extension order by extname')).rows;
 console.log('Capture cohérente de la base en cours…');
 const dump=await new Promise((resolve,reject)=>{
  const process=spawn(pgDump,['--format=custom','--no-owner','--no-password','--lock-wait-timeout=10s','--role=postgres','--snapshot='+snapshot],{env:connected.env,windowsHide:true,stdio:['ignore','pipe','pipe'],timeout:30*60_000});
  const pieces=[];let size=0;let overflow=false;
  process.stdout.on('data',chunk=>{size+=chunk.length;if(size>256*1024*1024){overflow=true;process.kill();}else pieces.push(chunk);});
  process.stderr.on('data',()=>{});
  process.on('error',()=>reject(Error('Démarrage de pg_dump impossible')));
  process.on('close',code=>code===0&&!overflow?resolve(Buffer.concat(pieces)):reject(Error(overflow?'La base dépasse la limite de capture locale de 256 Mo.':'pg_dump a échoué ; aucune sauvegarde validée.')));
 });
 if(!dump.subarray(0,5).equals(Buffer.from('PGDMP')))throw Error('Format de base incorrect');
 const records=[{file:'database.enc',kind:'postgres',...await saveEncrypted(path.join(directory,'database.enc'),dump,secret,ref+'/database.enc')}];
 const keys=JSON.parse(cloud(['projects','api-keys','--remote='+ref,'--output','json']));
 const serverKey=keys.find(item=>item.name==='service_role')?.api_key;if(!serverKey)throw Error('Accès serveur Storage absent');
 const storage=createClient('https://'+ref+'.supabase.co',serverKey,{auth:{persistSession:false,autoRefreshToken:false}}).storage;
 for(const [index,object] of objects.entries()){
  const {data,error}=await storage.from(object.bucket_id).download(object.name);if(error)throw Error('Lecture d’un objet Storage impossible ; archive incomplète.');
  const bytes=Buffer.from(await data.arrayBuffer());
  const file='object-'+String(index).padStart(7,'0')+'.enc';
  records.push({file,kind:'storage',bucket:object.bucket_id,name:object.name,mimeType:data.type,...await saveEncrypted(path.join(directory,file),bytes,secret,ref+'/'+file)});
 }
 // Check the live inventory after releasing the snapshot. Concurrent file changes
 // invalidate this attempt rather than producing mismatched database/file copies.
 await client.query('commit');
 const after=await inventory();
 if(JSON.stringify(after)!==JSON.stringify(objects))throw Error('Le stockage a changé pendant la capture. Recommencer.');
 const manifest={format:1,project:ref,createdAt:new Date().toISOString(),tables,buckets,roles,extensions,records,excludedStorageBuckets:['backups'],restoreState:'not-tested',providerSecretsIncluded:false,databaseAuthDataIncluded:true};
 await saveEncrypted(path.join(directory,'manifest.enc'),Buffer.from(JSON.stringify(manifest)),secret,ref+'/manifest.enc');
 await writeFile(path.join(directory,'status.json'),JSON.stringify({format:1,createdAt:id,project:ref,state:'captured',restoreState:'not-tested',records:records.length}));
 console.log(JSON.stringify({archive:directory,state:'captured',databaseTables:tables.length,storageObjects:objects.length,encrypted:true,restorationVerified:false,offsiteCopy:false}));
}catch(error){console.error(error.message);process.exitCode=1;}
finally{if(client){await client.query('rollback').catch(()=>{});await client.end();}secret.fill(0);}
