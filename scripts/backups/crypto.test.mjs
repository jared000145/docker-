import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {encrypt,decrypt,sha256} from './crypto.mjs';
test('encrypted backup restores its exact bytes',()=>{
 const key=randomBytes(32),data=randomBytes(100_000),encrypted=encrypt(data,key,'database');
 assert.deepEqual(decrypt(encrypted,key,'database'),data);
 assert.equal(sha256(decrypt(encrypted,key,'database')),sha256(data));
 assert.notDeepEqual(encrypt(data,key,'database'),encrypted);
});
test('damaged, truncated, substituted or wrong-key backups are rejected',()=>{
 const key=randomBytes(32),encrypted=encrypt(Buffer.from('private data'),key,'database');
 const damaged=Buffer.from(encrypted);damaged[damaged.length-1]^=1;
 for(const [data,secret,context] of [[damaged,key,'database'],[encrypted.subarray(0,20),key,'database'],[encrypted,randomBytes(32),'database'],[encrypted,key,'different-object']])assert.throws(()=>decrypt(data,secret,context));
});
