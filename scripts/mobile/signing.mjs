import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {generateKeyPairSync,randomBytes} from 'node:crypto';
export const signingDir=path.resolve('.tools/android-signing');
export const jdk=process.env.RECTORPLUS_JAVA_HOME||'C:/Program Files/Android/Android Studio/jbr';
export function protect(bytes,file){
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Add-Type -AssemblyName System.Security; $data=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $encrypted=[Security.Cryptography.ProtectedData]::Protect($data,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[IO.File]::WriteAllBytes($env:RECTORPLUS_SECRET_FILE,$encrypted)`],{input:bytes.toString('base64'),encoding:'utf8',windowsHide:true,env:{...process.env,RECTORPLUS_SECRET_FILE:file}});
 if(result.status)throw Error('Protection Windows des clés impossible');
}
export function unprotect(file){
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Add-Type -AssemblyName System.Security; $clear=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($env:RECTORPLUS_SECRET_FILE),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Write([Convert]::ToBase64String($clear))`],{encoding:'utf8',windowsHide:true,env:{...process.env,RECTORPLUS_SECRET_FILE:file}});
 if(result.status)throw Error('Déverrouillage des clés impossible pour cet utilisateur Windows');return Buffer.from(result.stdout.trim(),'base64');
}
export function signingPassword(){return unprotect(path.join(signingDir,'password.dpapi')).toString('utf8');}
export function ensureSigning(){
 mkdirSync(signingDir,{recursive:true});
 const store=path.join(signingDir,'rectorplus-release.p12'),secret=path.join(signingDir,'password.dpapi');
 if(!existsSync(secret)){if(existsSync(store))throw Error('Keystore présent sans secret : ne pas remplacer la clé existante');protect(Buffer.from(randomBytes(36).toString('base64url')),secret);}
 const password=signingPassword();
 for(const [alias,size]of[['rectorplus-app','4096'],['rectorplus-upload','3072']]){
  const env={...process.env,RECTORPLUS_KEY_PASSWORD:password};
  const existing=spawnSync(path.join(jdk,'bin/keytool.exe'),['-list','-keystore',store,'-storepass:env','RECTORPLUS_KEY_PASSWORD','-alias',alias],{env,windowsHide:true,stdio:'ignore'});
  if(existing.status){const result=spawnSync(path.join(jdk,'bin/keytool.exe'),['-genkeypair','-keystore',store,'-storetype','PKCS12','-storepass:env','RECTORPLUS_KEY_PASSWORD','-keypass:env','RECTORPLUS_KEY_PASSWORD','-alias',alias,'-keyalg','RSA','-keysize',size,'-validity','10000','-dname','CN=RectorPlus,OU=Android,O=RectorPlus','-noprompt'],{env,windowsHide:true,encoding:'utf8'});if(result.status)throw Error('Création des certificats Android impossible');}
  const exported=spawnSync(path.join(jdk,'bin/keytool.exe'),['-exportcert','-rfc','-keystore',store,'-storepass:env','RECTORPLUS_KEY_PASSWORD','-alias',alias,'-file',path.join(signingDir,alias+'-certificate.pem')],{env,windowsHide:true,encoding:'utf8'});if(exported.status)throw Error('Export du certificat public impossible');
 }
 const privatePath=path.join(signingDir,'updates-private.dpapi'),publicPath=path.resolve('android/app/src/main/res/raw/mobile_update_public.der');
 if(!existsSync(privatePath)){if(existsSync(publicPath))throw Error('Clé publique existante : retrouver la clé privée avant publication');const keys=generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'der'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});protect(Buffer.from(keys.privateKey),privatePath);writeFileSync(publicPath,keys.publicKey);}
 return {store,password};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/,''))){ensureSigning();console.log('Clés Android et clé de mises à jour disponibles ; secrets protégés par Windows.');}
