import assert from 'node:assert/strict';import{randomUUID as uuid}from'node:crypto';
export async function testRegistrationNumbers(db){
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");const tenant=uuid(),other=uuid();for(const id of[tenant,other])await db.query("insert into public.institutions(id,name,slug,access_key,is_active)values($1::uuid,'Université QA',$1::text,$1::text,true)",[id]);
 const year=(await db.query("select extract(year from now() at time zone 'Europe/Paris')::int y")).rows[0].y;
 await db.exec('set role service_role');const reserve=async(key,institution=tenant)=> (await db.query("select public.reserve_registration_number($1,'UOB','JPN',$2) n",[institution,key])).rows[0].n;
 const first=await reserve('test-request-'+uuid());assert.equal(first,`UOB-JPN-${year}-0001`);
 const stableKey='test-request-'+uuid(),stable=await reserve(stableKey);assert.equal(await reserve(stableKey),stable);await assert.rejects(reserve(stableKey,other));
 const batch=await Promise.all(Array.from({length:20},()=>reserve('test-request-'+uuid())));assert.equal(new Set(batch).size,20);assert.ok(batch.every(n=>n.startsWith(`UOB-JPN-${year}-`)));
 await db.exec('reset role;set role authenticated');await assert.rejects(reserve('test-request-'+uuid()));await assert.rejects(db.query('select * from public.registration_number_reservations'));await db.exec('reset role');console.log('PASS: server-only registration numbers, institution and person initials, registration year, idempotence, uniqueness and cross-institution reservation isolation.');
}
