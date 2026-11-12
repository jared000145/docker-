import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {key,root} from './runtime.mjs';
import {decrypt,readVerified} from './crypto.mjs';
const directory=path.resolve(process.argv[2]||(await readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>path.join(root,entry.name)).sort().at(-1)||'');
if(!directory.startsWith(root+path.sep))throw Error('Choisir une archive du dossier local de sauvegardes');
const secret=await key();
try{
 const status=JSON.parse(await readFile(path.join(directory,'status.json'),'utf8'));
 if(status.state!=='captured')throw Error('La capture est incomplète.');
 const manifest=JSON.parse(decrypt(await readFile(path.join(directory,'manifest.enc')),secret,status.project+'/manifest.enc').toString());
 if(manifest.project!==status.project||manifest.format!==1)throw Error('Manifeste non reconnu');
 for(const record of manifest.records){
  if(!/^(database|object-\d+)\.enc$/.test(record.file))throw Error('Nom de fichier invalide');
  await readVerified(path.join(directory,record.file),secret,status.project+'/'+record.file,record);
 }
 const result={verifiedAt:new Date().toISOString(),archive:path.basename(directory),integrity:'passed',records:manifest.records.length,restorationVerified:false};
 await writeFile(path.join(directory,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{secret.fill(0);}
