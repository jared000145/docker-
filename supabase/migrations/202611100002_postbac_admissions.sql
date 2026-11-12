alter table public.filieres add column registration_fee numeric(14,2) check(registration_fee>=0),add column tuition_fee numeric(14,2) check(tuition_fee>=0),add column uniform_fee numeric(14,2) check(uniform_fee>=0),add column other_fee numeric(14,2) check(other_fee>=0),add column fee_notes text,add column admission_keywords text,add column minimum_average numeric check(minimum_average between 0 and 20);
alter table public.applications add column campus_id uuid references public.campuses(id),add column funding text not null default 'direct',add column fee_snapshot jsonb not null default '{}',add column payment_status text not null default 'awaiting_admission',add column payment_reference text;
create function private.admission_staff(_institution uuid,_campus uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_super() or _institution=private.institution_id() and private.can_module('etudiants') and private.staff_campus(_campus)
$$;
revoke all on function private.admission_staff(uuid,uuid) from public;grant execute on function private.admission_staff(uuid,uuid) to authenticated;
create policy admission_inbox on public.applications for select to authenticated using(private.admission_staff(target_institution_id,campus_id));
create policy admission_messages_read on public.application_messages for select to authenticated using(exists(select 1 from public.applications a where a.id=application_id and (a.user_id=auth.uid() or private.admission_staff(a.target_institution_id,a.campus_id))));
create policy admission_messages_send on public.application_messages for insert to authenticated with check(sender_id=auth.uid() and length(trim(content)) between 1 and 5000 and exists(select 1 from public.applications a where a.id=application_id and (a.user_id=auth.uid() or private.admission_staff(a.target_institution_id,a.campus_id))));

create table public.admission_files(
 id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id),
 kind text not null check(kind in('terminal_transcript','bac_diploma','bac_transcript','anbg_decision')),
 path text unique not null,file_name text not null,created_at timestamptz not null default now()
);
create table public.admission_funding(
 user_id uuid primary key references auth.users(id),route text not null default 'direct' check(route in('direct','anbg')),
 status text not null default 'direct' check(status in('direct','pending_anbg','verified_anbg')),
 reference text,target_filiere_id uuid references public.filieres(id),verified_by uuid,verified_at timestamptz
);
alter table public.admission_files enable row level security;alter table public.admission_funding enable row level security;
grant select on public.admission_files,public.admission_funding to authenticated;grant all on public.admission_files,public.admission_funding to service_role;
create policy own_admission_files on public.admission_files for select to authenticated using(user_id=auth.uid() or private.is_super() or exists(select 1 from public.applications a where a.user_id=admission_files.user_id and private.admission_staff(a.target_institution_id,a.campus_id) and a.dossier->'file_ids' ? admission_files.id::text));
create policy funding_read on public.admission_funding for select to authenticated using(user_id=auth.uid() or private.is_super() or private.is_admin() and private.same_institution(user_id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('admission-files','admission-files',false,10485760,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
create policy admission_upload on storage.objects for insert to authenticated with check(bucket_id='admission-files' and private.path_owner(name)=auth.uid());
create policy admission_file_read on storage.objects for select to authenticated using(bucket_id='admission-files' and (private.path_owner(name)=auth.uid() or exists(select 1 from public.admission_files f join public.applications a on a.user_id=f.user_id where f.path=name and a.dossier->'file_ids' ? f.id::text and private.admission_staff(a.target_institution_id,a.campus_id))));
create function public.attach_admission_file(_kind text,_path text,_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null or private.path_owner(_path) is distinct from auth.uid() or not exists(select 1 from storage.objects where bucket_id='admission-files' and name=_path) or length(_name)>240 then raise insufficient_privilege;end if;
 insert into public.admission_files(user_id,kind,path,file_name) values(auth.uid(),_kind,_path,_name) returning id into result;return result;
end $$;
create function public.set_admission_funding(_route text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or _route not in('direct','anbg') then raise insufficient_privilege;end if;
 if exists(select 1 from public.applications where user_id=auth.uid() and status in('pending','in_review','accepted')) then raise exception 'La voie de financement est liée à vos candidatures en cours.';end if;
 insert into public.admission_funding(user_id,route,status) values(auth.uid(),_route,case when _route='anbg' then 'pending_anbg' else 'direct' end)
 on conflict(user_id) do update set route=excluded.route,status=excluded.status,reference=null,target_filiere_id=null,verified_by=null,verified_at=null;
end $$;
create function public.verify_anbg_decision(_student uuid,_reference text,_filiere uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not(private.is_super() or private.is_admin() and private.same_institution(_student)) then raise insufficient_privilege;end if;
 if length(trim(_reference))<3 or not exists(select 1 from public.admission_files where user_id=_student and kind='anbg_decision') or not exists(select 1 from public.filieres where id=_filiere) then raise exception 'Justificatif, référence et formation de destination requis.';end if;
 update public.admission_funding set status='verified_anbg',reference=trim(_reference),target_filiere_id=_filiere,verified_by=auth.uid(),verified_at=now() where user_id=_student and route='anbg';
 if not found then raise exception 'Aucune demande ANBG.';end if;
 insert into public.notifications(user_id,title,message,type,institution_id) select _student,'Décision ANBG vérifiée','Votre justificatif a été vérifié. Vous pouvez transmettre le dossier à la formation indiquée.','info',institution_id from public.profiles where user_id=_student;
end $$;
create function public.list_open_programs() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('institution_id',i.id,'institution_name',i.name,'city',c.city,'logo_url',i.logo_url,'filiere_id',f.id,'filiere_name',f.name,'filiere_description',f.description,'campus_id',f.campus_id,'campus_name',c.name,'admission_level',f.admission_level,'admission_info',f.admission_info,'keywords',f.admission_keywords,'minimum_average',f.minimum_average,'registration_fee',f.registration_fee,'tuition_fee',f.tuition_fee,'uniform_fee',f.uniform_fee,'other_fee',f.other_fee,'fee_notes',f.fee_notes,'currency','XAF') order by i.name,f.name),'[]')
 from public.filieres f join public.institutions i on i.id=f.institution_id left join public.campuses c on c.id=f.campus_id
 where i.is_active=true and i.accepts_applications and (i.institution_type='university' or 'universite'=any(i.enabled_cycles)) and (f.campus_id is null or c.is_active)
$$;
create function public.submit_admission(_filiere uuid,_motivation text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare p public.profiles; f public.filieres; fund public.admission_funding; docs jsonb; file_ids jsonb; result uuid; fees jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 select * into p from public.profiles where user_id=auth.uid() for update;
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='user') or not(coalesce(p.post_bac,false) or p.level ilike '%terminal%' or p.level in('Tle','TLE')) then raise exception 'Cet espace est réservé aux élèves de Terminale et bacheliers.';end if;
 select * into f from public.filieres where id=_filiere;
 if f.id is null or not exists(select 1 from jsonb_array_elements(public.list_open_programs()) x where x->>'filiere_id'=_filiere::text) then raise exception 'Formation indisponible.';end if;
 if exists(select 1 from public.applications where user_id=auth.uid() and target_filiere_id=_filiere and status in('pending','in_review','accepted')) then raise exception 'Une candidature est déjà en cours pour cette formation.';end if;
 select * into fund from public.admission_funding where user_id=auth.uid();
 if fund.user_id is null then raise exception 'Choisissez votre voie de financement.';end if;
 if fund.route='anbg' and (fund.status<>'verified_anbg' or fund.target_filiere_id is distinct from _filiere) then raise exception 'Attendez la décision ANBG vérifiée pour cette formation.';end if;
 if (select count(distinct kind) from public.admission_files where user_id=auth.uid() and kind in('terminal_transcript','bac_diploma','bac_transcript'))<3 then raise exception 'Bulletin de Terminale, attestation du bac et relevé du bac requis.';end if;
 if length(_motivation)>5000 then raise exception 'Motivation trop longue.';end if;
 select jsonb_agg(to_jsonb(d)),jsonb_agg(d.id::text) into docs,file_ids from(select distinct on(kind) id,kind,path,file_name from public.admission_files where user_id=auth.uid() and (kind<>'anbg_decision' or fund.route='anbg') order by kind,created_at desc,id desc)d;
 fees:=jsonb_build_object('registration',f.registration_fee,'tuition',f.tuition_fee,'uniform',f.uniform_fee,'other',f.other_fee,'currency','XAF','notes',f.fee_notes);
 insert into public.applications(user_id,origin_institution_id,target_institution_id,target_filiere_id,campus_id,status,motivation,funding,fee_snapshot,dossier,dossier_version)
 values(auth.uid(),p.institution_id,f.institution_id,f.id,f.campus_id,'pending',_motivation,fund.route,fees,jsonb_build_object('profile',jsonb_build_object('first_name',p.first_name,'last_name',p.last_name,'student_number',p.student_number,'email',p.email,'level',p.level),'files',docs,'file_ids',file_ids,'school_years',(select coalesce(jsonb_agg(jsonb_build_object('year',academic_year,'level',niveau,'progression',progression)),'[]') from public.student_years where user_id=p.user_id),'submitted_at',now(),'anbg_reference',fund.reference),1) returning id into result;
 insert into public.notifications(user_id,institution_id,title,message,type) select t.user_id,f.institution_id,'Nouvelle candidature',p.first_name||' '||p.last_name||' · '||f.name,'info' from public.team_members t where t.institution_id=f.institution_id and (t.is_principal or 'etudiants'=any(t.allowed_modules)) and (t.is_principal or exists(select 1 from public.campus_access_grants g where g.user_id=t.user_id) or exists(select 1 from public.campus_staff s where s.user_id=t.user_id and s.campus_id=f.campus_id));
 insert into public.notifications(user_id,institution_id,title,message,type) values(p.user_id,p.institution_id,'Dossier transmis','Votre candidature pour '||f.name||' a été reçue. Vous recevrez une notification après examen.','info');
 return result;
end $$;
create function public.decide_admission(_application uuid,_status text,_note text default '') returns void language plpgsql security definer set search_path='' as $$
declare a public.applications;
begin
 select * into a from public.applications where id=_application for update;
 if not found or not private.admission_staff(a.target_institution_id,a.campus_id) then raise insufficient_privilege;end if;
 if _status not in('in_review','accepted','rejected') or a.status in('accepted','rejected') or (_status='rejected' and length(trim(_note))<3) then raise exception 'Décision ou transition invalide.';end if;
 update public.applications set status=_status,decision_note=_note,decided_by=auth.uid()::text,decided_at=now()::text,updated_at=now(),payment_status=case when _status='accepted' then 'pay_on_site' else 'awaiting_admission' end where id=a.id;
 insert into public.notifications(user_id,institution_id,title,message,type) values(a.user_id,a.origin_institution_id,'Suivi de votre candidature',case _status when 'accepted' then 'Candidature acceptée. Contactez l’établissement pour payer sur place.' when 'rejected' then 'Candidature refusée : '||_note else 'Votre dossier est en cours d’examen.' end,'info');
end $$;
create function public.record_admission_payment(_application uuid,_reference text) returns void language plpgsql security definer set search_path='' as $$
declare a public.applications;
begin
 select * into a from public.applications where id=_application for update;
 if not found or not(private.is_super() or a.target_institution_id=private.institution_id() and private.can_module('paiements') and private.staff_campus(a.campus_id)) then raise insufficient_privilege;end if;
 if a.status<>'accepted' or a.payment_status='received' or length(trim(_reference))<3 then raise exception 'Admission acceptée et référence de reçu requises.';end if;
 update public.applications set payment_status='received',payment_reference=trim(_reference),updated_at=now() where id=a.id;
 insert into public.audit_logs(institution_id,user_id,action,categorie,record_id,description) values(a.target_institution_id,auth.uid(),'admission_payment','finance',a.id,trim(_reference));
end $$;
revoke all on function public.attach_admission_file(text,text,text),public.set_admission_funding(text),public.verify_anbg_decision(uuid,text,uuid),public.list_open_programs(),public.submit_admission(uuid,text),public.decide_admission(uuid,text,text),public.record_admission_payment(uuid,text) from public;
grant execute on function public.attach_admission_file(text,text,text),public.set_admission_funding(text),public.verify_anbg_decision(uuid,text,uuid),public.list_open_programs(),public.submit_admission(uuid,text),public.decide_admission(uuid,text,text),public.record_admission_payment(uuid,text) to authenticated;
