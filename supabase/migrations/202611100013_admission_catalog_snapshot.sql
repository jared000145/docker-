create or replace function public.submit_admission(_filiere uuid,_motivation text default '') returns uuid language plpgsql security definer set search_path='' as $$
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
 values(auth.uid(),p.institution_id,f.institution_id,f.id,f.campus_id,'pending',_motivation,fund.route,fees,jsonb_build_object('program_name',f.name,'institution_name',(select i.name from public.institutions i where i.id=f.institution_id),'profile',jsonb_build_object('first_name',p.first_name,'last_name',p.last_name,'student_number',p.student_number,'email',p.email,'level',p.level),'files',docs,'file_ids',file_ids,'school_years',(select coalesce(jsonb_agg(jsonb_build_object('year',academic_year,'level',niveau,'progression',progression)),'[]') from public.student_years where user_id=p.user_id),'submitted_at',now(),'anbg_reference',fund.reference),1) returning id into result;
 insert into public.notifications(user_id,institution_id,title,message,type) select t.user_id,f.institution_id,'Nouvelle candidature',p.first_name||' '||p.last_name||' · '||f.name,'info' from public.team_members t where t.institution_id=f.institution_id and (t.is_principal or 'etudiants'=any(t.allowed_modules)) and (t.is_principal or exists(select 1 from public.campus_access_grants g where g.user_id=t.user_id) or exists(select 1 from public.campus_staff s where s.user_id=t.user_id and s.campus_id=f.campus_id));
 insert into public.notifications(user_id,institution_id,title,message,type) values(p.user_id,p.institution_id,'Dossier transmis','Votre candidature pour '||f.name||' a été reçue. Vous recevrez une notification après examen.','info');
 return result;
end $$;
