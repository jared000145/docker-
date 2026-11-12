import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash,verify} from 'node:crypto';
import {jdk} from './signing.mjs';
const release=JSON.parse(fs.readFileSync('mobile/release.json','utf8'));
const output=path.resolve('releases/android/'+release.nativeVersion);
const hashes=JSON.parse(fs.readFileSync(path.join(output,'checksums.json'),'utf8'));
for(const [name,hash]of Object.entries(hashes.files))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(output,name))).digest('hex'),hash,name);
const config=JSON.parse(fs.readFileSync('android/app/src/main/assets/capacitor.config.json','utf8'));
assert.equal(config.appId,'com.rectorplus.app');assert.ok(!config.server?.url,'Release must contain local assets');
const sdk=process.env.RECTORPLUS_ANDROID_SDK||path.join(process.env.LOCALAPPDATA,'Android','Sdk');
const apk=spawnSync(path.join(jdk,'bin/java.exe'),['-jar',path.join(sdk,'build-tools','36.0.0','lib','apksigner.jar'),'verify','--verbose','--print-certs',path.join(output,'RectorPlus-'+release.nativeVersion+'.apk')],{encoding:'utf8',windowsHide:true});
assert.equal(apk.status,0,apk.stdout+apk.stderr);console.log(apk.stdout);
const aab=spawnSync(path.join(jdk,'bin/jarsigner.exe'),['-J-Duser.language=en','-verify',path.join(output,'RectorPlus-'+release.nativeVersion+'-playstore.aab')],{encoding:'utf8',windowsHide:true});
assert.equal(aab.status,0,aab.stdout+aab.stderr);assert.match(aab.stdout,/jar verified/);console.log('AAB signature verified.');
const key={key:fs.readFileSync('android/app/src/main/res/raw/mobile_update_public.der'),format:'der',type:'spki'};
for(const channel of ['stable','preview']){
 const envelope=JSON.parse(fs.readFileSync('public/mobile/updates-'+channel+'.json','utf8'));
 assert.ok(verify('RSA-SHA256',Buffer.from(envelope.payload),key,Buffer.from(envelope.signature,'base64')));
 const manifest=JSON.parse(envelope.payload);assert.equal(manifest.channel,channel);
 const file=path.join('public',new URL(manifest.web.url).pathname);
 assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),manifest.web.sha256);
}
console.log('Packages, local configuration and signed update manifests verified.');
