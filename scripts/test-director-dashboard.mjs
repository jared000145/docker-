import assert from 'node:assert/strict';import {randomUUID as uuid} from 'node:crypto';
export async function testDirectorDashboard(db){
 const inst=uuid(),foreign=uuid(),a=uuid(),b=uuid(),owner=uuid(),director=uuid(),pupil=uuid(),other=uuid(),stranger=uuid(),subject=uuid();
 async function as(id){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);if(id)await db.exec('set role authenticated');}
 const summary=async(campus=null,year='2026-2027')=>(await db.query('select public.director_dashboard($1,$2) x',[year,campus])).rows[0].x;
 await as(null);
 for(const id of [inst,foreign])await db.query("insert into public.institutions(id,name,slug,access_key,is_active,academic_year) values($1::uuid,'Director QA',$1::text,$1::text,true,'2026-2027')",[id]);
 await db.query("insert into public.campuses(id,institution_id,name,is_main) values($1,$3,'Campus A',true),($2,$3,'Campus B',false)",[a,b,inst]);
 for(const[id,tenant,campus,role]of[[owner,inst,null,'admin'],[director,inst,a,'admin'],[pupil,inst,a,'user'],[other,inst,b,'user'],[stranger,foreign,null,'admin']]){await db.query('insert into auth.users(id,email)values($1,$2)',[id,id+'@qa.invalid']);await db.query("update public.profiles set institution_id=$2,campus_id=$3,level='L1',academic_year='2026-2027' where user_id=$1",[id,tenant,campus]);await db.query('delete from public.user_roles where user_id=$1',[id]);await db.query('insert into public.user_roles(user_id,role)values($1,$2::public.app_role)',[id,role]);}
 for(const[id,principal]of[[owner,true],[director,false]])await db.query("insert into public.team_members(user_id,institution_id,email,first_name,last_name,team_role,is_principal,allowed_modules,academic_scope) values($1::uuid,$2::uuid,$1::text,'Direction','QA','directeur',$3,array['director_dashboard'],'all')",[id,inst,principal]);
 for(const[id,campus]of[[pupil,a],[other,b]])await db.query("insert into public.student_years(user_id,institution_id,academic_year,niveau,campus_id,enrollment_status,created_at) values($1,$2,'2026-2027','L1',$3,'active','2026-08-01')",[id,inst,campus]);
 await db.query("insert into public.subjects(id,institution_id,campus_id,name) values($1,$2,$3,'Mathématiques')",[subject,inst,a]);
 await db.query("insert into public.grades(user_id,institution_id,campus_id,subject_id,academic_year,average) values($1,$2,$3,$4,'2026-2027',14)",[pupil,inst,a,subject]);
 for(const[id,campus,amount,paid]of[[pupil,a,1000,700],[other,b,900,500]])await db.query("insert into public.payments(user_id,institution_id,campus_id,academic_year,amount,paid_amount,description) values($1,$2,$3,'2026-2027',$4,$5,'QA frais')",[id,inst,campus,amount,paid]);
 await db.query("insert into public.events(institution_id,campus_id,title,event_date,created_by) values($1,$2,'Campus B agenda',now(),$3)",[inst,b,owner]);
 await as(director);assert.equal((await db.query("select id from public.events where institution_id=$1",[inst])).rows.length,0,'foreign campus agenda is private');let d=await summary();assert.equal(d.students,1);assert.equal(d.sites.length,1);assert.equal(d.success,100);assert.equal(d.received,null);assert.equal(d.unpaid,null);assert.equal(d.evolution.length,6);await assert.rejects(summary(b));await assert.rejects(db.query('select public.set_campus_photo($1,null)',[a]));
 await as(owner);d=await summary();assert.equal(d.students,2);assert.equal(d.received,1200);assert.equal(d.unpaid,700);assert.equal(d.sites.length,2);assert.equal((await summary(a)).students,1);assert.equal((await summary(null,'2025-2026')).students,0);assert.equal((await summary(null,'2025-2026')).success,null);assert.equal((await summary(null,'2025-2026')).received,0);await assert.rejects(db.query('select public.set_campus_photo($1,$2)',[a,'evil/path.jpg']));
 await as(stranger);await assert.rejects(summary(a));
 await as(pupil);await assert.rejects(summary());
 await as(null);await db.exec('set role anon');await assert.rejects(summary());await as(null);
 console.log('PASS: director annual aggregates, campus isolation, foreign campus rejection, finance redaction, no empty-year success, real totals, six-month evolution and campus photo authorization.');
}
