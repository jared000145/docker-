import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const MAGIC=Buffer.from('RPBK1');
export const sha256=data=>createHash('sha256').update(data).digest('hex');
export function encrypt(data,key,context){
  if(key.length!==32)throw Error('Clé de sauvegarde invalide');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(context));
  const body=Buffer.concat([cipher.update(data),cipher.final()]);
  return Buffer.concat([MAGIC,iv,cipher.getAuthTag(),body]);
}
export function decrypt(data,key,context){
  if(key.length!==32||data.length<33||!data.subarray(0,5).equals(MAGIC))throw Error('Archive de sauvegarde invalide');
  const cipher=createDecipheriv('aes-256-gcm',key,data.subarray(5,17));
  cipher.setAAD(Buffer.from(context));cipher.setAuthTag(data.subarray(17,33));
  return Buffer.concat([cipher.update(data.subarray(33)),cipher.final()]);
}
export async function saveEncrypted(filename,data,key,context){
  await writeFile(filename,encrypt(data,key,context),{flag:'wx',mode:0o600});
  return {bytes:data.length,sha256:sha256(data)};
}
export async function readVerified(filename,key,context,expected){
  const data=decrypt(await readFile(filename),key,context);
  if(data.length!==expected.bytes||sha256(data)!==expected.sha256)throw Error('Contrôle d’intégrité échoué');
  return data;
}
