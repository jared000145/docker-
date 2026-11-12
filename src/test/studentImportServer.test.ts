import {beforeEach,expect,it,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {importStudent} from '../../supabase/functions/_shared/studentImport';
const tenantA='10000000-0000-4000-8000-000000000001',tenantB='10000000-0000-4000-8000-000000000002';
const row={first_name:'Aïcha',last_name:'Diallo',level:'L1',academic_year:'2026-2027',matricule:'EXCEL-001',filiere_id:'20000000-0000-4000-8000-000000000001'};
beforeEach(()=>vi.stubGlobal('crypto',webcrypto));
function fixture(){
 const tables:Record<string,any[]>={institutions:[{id:tenantA,academic_year:'2026-2027',name:'Université QA'},{id:tenantB,academic_year:'2026-2027',name:'Autre QA'}],filieres:[{id:row.filiere_id,institution_id:tenantA}],classes:[],profiles:[],user_roles:[]};
 const users:any[]=[];const state={failProvision:false};
 const db={from:(table:string)=>{
  const filters:((row:any)=>boolean)[]=[];let single=false;let limit=Infinity;
  const builder={select:()=>builder,eq:(key:string,value:unknown)=>{filters.push(row=>row[key]===value);return builder;},ilike:(key:string,value:string)=>{filters.push(row=>String(row[key]||'').toLowerCase()===value.toLowerCase());return builder;},limit:(value:number)=>{limit=value;return builder;},maybeSingle:()=>{single=true;return builder;},single:()=>{single=true;return builder;},then:(resolve:any,reject:any)=>{const data=(tables[table]||[]).filter(row=>filters.every(filter=>filter(row))).slice(0,limit);return Promise.resolve({data:single?data[0]||null:data,error:null}).then(resolve,reject);}};
  return builder;
 },auth:{admin:{createUser:vi.fn(async(payload:any)=>{
  if(users.some(user=>user.email===payload.email))return {data:{user:null},error:{message:'Duplicate'}};
  const user={id:crypto.randomUUID(),...payload};users.push(user);tables.profiles.push({user_id:user.id,email:user.email,institution_id:null});tables.user_roles.push({user_id:user.id,role:'user'});return {data:{user},error:null};
 }),getUserById:vi.fn(async(id:string)=>({data:{user:users.find(user=>user.id===id)},error:null}))}},rpc:vi.fn(async(_name:string,args:any)=>{
  if(_name==='reserve_registration_number')return {data:'UQ-AD-2026-0001',error:null};
  if(state.failProvision){state.failProvision=false;return {error:{message:'Connection lost'}};}
  Object.assign(tables.profiles.find(profile=>profile.user_id===args._user_id),args._profile,{institution_id:args._institution_id});return {error:null};
 })};return {db,tables,users,state};
}
it('creates a real student profile contract and replays without duplicates or password reset',async()=>{
 const {db,users,tables}=fixture();const result=await importStudent(db,tenantA,{...row,role:'super_admin'},'a'.repeat(64));
 expect(result.status).toBe('created');expect(result.password).toBe('123456');expect(users[0].app_metadata.must_change_password).toBe(true);expect(users).toHaveLength(1);expect(tables.profiles[0]).toMatchObject({institution_id:tenantA,student_number:'EXCEL-001',academic_year:'2026-2027'});
 const again=await importStudent(db,tenantA,row,'a'.repeat(64));expect(again.status).toBe('already_imported');expect(again).not.toHaveProperty('password');expect(users).toHaveLength(1);expect(db.rpc).toHaveBeenCalledTimes(1);expect(db.rpc.mock.calls[0][1]._role).toBe('user');
});
it('resumes a tagged partial account after a provisioning failure',async()=>{
 const {db,state,users}=fixture();state.failProvision=true;
 await expect(importStudent(db,tenantA,row,'a'.repeat(64))).rejects.toThrow(/incomplète/);
 const resumed=await importStudent(db,tenantA,row,'a'.repeat(64));expect(resumed.status).toBe('resumed');expect(resumed).not.toHaveProperty('password');expect(users).toHaveLength(1);
});
it('refuses an existing matricule from another import and a changed payload',async()=>{
 const {db,users}=fixture();await importStudent(db,tenantA,row,'a'.repeat(64));
 await expect(importStudent(db,tenantA,row,'b'.repeat(64))).rejects.toMatchObject({status:409});
 await expect(importStudent(db,tenantA,{...row,last_name:'Autre'},'a'.repeat(64))).rejects.toMatchObject({status:409});expect(users).toHaveLength(1);
});
it('checks tenant references and active year before creating Auth users',async()=>{
 const {db,users}=fixture();
 await expect(importStudent(db,tenantB,row,'a'.repeat(64))).rejects.toThrow(/Filière/);
 await expect(importStudent(db,tenantA,{...row,academic_year:'2025-2026'},'a'.repeat(64))).rejects.toThrow(/année active/);expect(users).toHaveLength(0);
});
it('does not overwrite a promoted account or merge a homonym',async()=>{
 const {db,tables,users}=fixture();await importStudent(db,tenantA,row,'a'.repeat(64));tables.user_roles[0].role='admin';
 await expect(importStudent(db,tenantA,row,'a'.repeat(64))).rejects.toThrow(/changé de rôle/);
 await expect(importStudent(db,tenantA,{...row,matricule:''},'c'.repeat(64))).rejects.toThrow(/homonyme/);expect(users).toHaveLength(1);
});
