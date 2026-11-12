import {spawnSync} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import {createHash,sign} from 'node:crypto';import {zipSync} from 'fflate';
import {ensureSigning,signingDir,unprotect,jdk} from './signing.mjs';
const root=process.cwd(),release=JSON.parse(fs.readFileSync('mobile/release.json','utf8').replace(/^\uFEFF/,''));
const node=process.execPath,env={...process.env,PATH:path.resolve('.tools')+path.delimiter+process.env.PATH,RECTORPLUS_MOBILE_BUILD:'1',RECTORPLUS_WEB_DIR:'.tools/mobile-web'};
function run(command,args,options={}){const result=spawnSync(command,args,{cwd:root,env,stdio:'inherit',windowsHide:true,...options});if(result.status!==0)throw Error('Étape échouée : '+path.basename(command)+' '+args[0]);}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
if(!/^\d+\.\d+\.\d+$/.test(release.nativeVersion)||!/^\d+\.\d+\.\d+$/.test(release.webVersion)||!Number.isInteger(release.nativeCode)||release.nativeCode<1||release.webBuild<1||release.minNativeCode>release.maxNativeCode)throw Error('Version mobile invalide');
const signing=ensureSigning();
if(!process.argv.includes('--bundle-only')){
if(!process.argv.includes('--skip-web')){
 fs.mkdirSync('.tools/mobile-public',{recursive:true});for(const file of fs.readdirSync('public',{withFileTypes:true})){if(['mobile','downloads'].includes(file.name))continue;fs.cpSync(path.join('public',file.name),path.join('.tools/mobile-public',file.name),{recursive:true});}
 run(node,['scripts/require-backend.mjs']);run(node,['node_modules/typescript/bin/tsc','--noEmit','-p','tsconfig.app.json']);run(node,['node_modules/vite/bin/vite.js','build','--outDir','.tools/mobile-web']);
}
const files={};for(const file of walk('.tools/mobile-web'))files[path.relative('.tools/mobile-web',file).split(path.sep).join('/')]=new Uint8Array(fs.readFileSync(file));
const archive=zipSync(files,{level:6}),sha=createHash('sha256').update(archive).digest('hex');if(archive.length>40*1024*1024)throw Error('Paquet web trop volumineux');
fs.mkdirSync('public/mobile/bundles',{recursive:true});fs.writeFileSync('public/mobile/bundles/'+sha+'.zip',archive);
for(const channel of (process.argv.includes('--preview-only')?['preview']:['stable','preview'])){
 const payload=JSON.stringify({schema:1,channel,serial:Date.now(),native:{version:release.nativeVersion,code:release.nativeCode,published:release.storePublished},web:{version:release.webVersion,build:release.webBuild,nativeApi:release.nativeApi,minNativeCode:release.minNativeCode,maxNativeCode:release.maxNativeCode,url:'https://rectorplus.vercel.app/mobile/bundles/'+sha+'.zip',sha256:sha},notes:release.releaseNotes});
 const signature=sign('RSA-SHA256',Buffer.from(payload),unprotect(path.join(signingDir,'updates-private.dpapi'))).toString('base64');fs.writeFileSync('public/mobile/updates-'+channel+'.json',JSON.stringify({payload,signature}));
}
console.log(JSON.stringify({webBundlePrepared:true,version:release.webVersion,webBuild:release.webBuild,bytes:archive.length,sha256:sha}));
if(process.argv.includes('--web-only'))process.exit(0);
run(node,['node_modules/@capacitor/cli/bin/capacitor','sync','android']);
}
const sdk=process.env.RECTORPLUS_ANDROID_SDK||path.join(process.env.LOCALAPPDATA,'Android','Sdk');fs.writeFileSync('android/local.properties','sdk.dir='+sdk.split(path.sep).join('/')+'\n');
env.JAVA_HOME=jdk;env.ANDROID_HOME=sdk;env.GRADLE_USER_HOME=path.resolve('.tools/gradle');env.JAVA_TOOL_OPTIONS='-Djavax.net.ssl.trustStore="'+path.resolve('.tools/java-trust.p12')+'" -Djavax.net.ssl.trustStorePassword=changeit';env.RECTORPLUS_STORE_FILE=signing.store;env.RECTORPLUS_STORE_PASSWORD=signing.password;
const gradle=path.resolve('android/gradlew.bat'),output=path.resolve('releases/android/'+release.nativeVersion);fs.mkdirSync(output,{recursive:true});
const gradleRun=args=>{for(let attempt=0;attempt<6;attempt++){
 const result=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/c','gradlew.bat',...args],{cwd:path.resolve('android'),env,encoding:'utf8',maxBuffer:20*1024*1024,windowsHide:true});process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');if(result.status===0)return;
 const fixed=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve('scripts/mobile/finalize-gradle-cache.ps1')],{env,encoding:'utf8',windowsHide:true});if(fixed.status||(Number(fixed.stdout.trim())<1&&!String(result.stdout+result.stderr).includes('Could not move temporary workspace')))throw Error('Compilation Android refusée. Consulter le journal de build.');
 console.log('Reprise après finalisation du cache Gradle Windows.');
 }throw Error('Le cache Gradle Windows reste verrouillé.');};
if(!process.argv.includes('--bundle-only')){
gradleRun(['testDebugUnitTest','assembleDebug','assembleRelease','-PrectorplusSigningAlias=rectorplus-app','--console=plain','--max-workers=1','--no-daemon','--no-watch-fs','-Dorg.gradle.internal.instrumentation.agent=false']);
fs.copyFileSync('android/app/build/outputs/apk/release/app-release.apk',path.join(output,'RectorPlus-'+release.nativeVersion+'.apk'));fs.copyFileSync('android/app/build/outputs/apk/debug/app-debug.apk',path.join(output,'RectorPlus-'+release.nativeVersion+'-test.apk'));
}
gradleRun(['bundleRelease','-PrectorplusSigningAlias=rectorplus-upload','--console=plain','--max-workers=1','--no-daemon','--no-watch-fs','-Dorg.gradle.internal.instrumentation.agent=false']);
fs.copyFileSync('android/app/build/outputs/bundle/release/app-release.aab',path.join(output,'RectorPlus-'+release.nativeVersion+'-playstore.aab'));
for(const alias of ['rectorplus-app','rectorplus-upload'])fs.copyFileSync(path.join(signingDir,alias+'-certificate.pem'),path.join(output,alias+'-certificate.pem'));
const hashes={version:release.nativeVersion,versionCode:release.nativeCode,webVersion:release.webVersion,webBuild:release.webBuild,files:{}};for(const name of fs.readdirSync(output))if(/\.(apk|aab|pem)$/.test(name))hashes.files[name]=createHash('sha256').update(fs.readFileSync(path.join(output,name))).digest('hex');fs.writeFileSync(path.join(output,'checksums.json'),JSON.stringify(hashes,null,2));console.log('Android packages ready: '+output);
