-- Restrict operational rows by their own campus, including after a pupil transfers.
do $$declare t text;begin
 foreach t in array array['grades','payments','attendance','student_documents','student_years'] loop
 execute format('create policy record_campus_scope on public.%I as restrictive for all to authenticated using(not private.restricted_staff() or user_id=auth.uid() or private.staff_campus(campus_id)) with check(not private.restricted_staff() or user_id=auth.uid() or private.staff_campus(campus_id))',t);
 end loop;
end $$;
create policy staff_student_documents on public.student_documents for select to authenticated using(institution_id=private.institution_id() and private.can_module('etudiants') and private.staff_person_scope(user_id));
create policy staff_notifications_send on public.notifications for insert to authenticated with check(institution_id=private.institution_id() and private.can_module('communaute') and private.staff_person_scope(user_id));
create policy scoped_notifications on public.notifications as restrictive for all to authenticated using(private.is_super() or user_id=auth.uid() or institution_id=private.institution_id() and private.staff_person_scope(user_id)) with check(private.is_super() or user_id=auth.uid() or institution_id=private.institution_id() and private.staff_person_scope(user_id));
-- Restricted staff may update academic year only to an already validated annual registration.
create or replace function private.protect_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or private.is_super() or private.is_admin() then return new;end if;
 if private.can_module('etudiants') and old.institution_id=private.institution_id() and exists(select 1 from public.user_roles where user_id=old.user_id and role='user') then
  if (to_jsonb(new)-array['first_name','last_name','phone','address','avatar_url','recovery_email','updated_at','level','filiere_id','classe_id','campus_id','statut_boursier','academic_year']) is distinct from (to_jsonb(old)-array['first_name','last_name','phone','address','avatar_url','recovery_email','updated_at','level','filiere_id','classe_id','campus_id','statut_boursier','academic_year']) then raise insufficient_privilege;end if;
  if new.academic_year is distinct from old.academic_year and not exists(select 1 from public.student_years y where y.user_id=new.user_id and y.institution_id=new.institution_id and y.academic_year=new.academic_year and y.niveau=new.level and y.campus_id is not distinct from new.campus_id and y.classe_id is not distinct from new.classe_id) then raise exception 'Créez d’abord une inscription annuelle cohérente.';end if;
  return new;
 end if;
 if old.user_id<>auth.uid() then raise insufficient_privilege;end if;
 if (to_jsonb(new)-array['first_name','last_name','phone','address','avatar_url','recovery_email','signature_url','updated_at']) is distinct from (to_jsonb(old)-array['first_name','last_name','phone','address','avatar_url','recovery_email','signature_url','updated_at']) then raise insufficient_privilege;end if;
 return new;
end $$;
create policy origin_anbg_file on public.admission_files for select to authenticated using(kind='anbg_decision' and private.is_admin() and private.same_institution(user_id));
create policy origin_anbg_storage on storage.objects for select to authenticated using(bucket_id='admission-files' and exists(select 1 from public.admission_files f where f.path=name and f.kind='anbg_decision' and private.is_admin() and private.same_institution(f.user_id)));
alter table public.bac_results add column publication_reference text,add column published_at timestamptz,add column published_by uuid;
create function public.publish_student_bac(_student uuid,_year text,_average numeric,_serie text,_reference text,_scores jsonb default '{}') returns uuid language plpgsql security definer set search_path='' as $$
declare p public.profiles; result uuid;
begin
 select * into p from public.profiles where user_id=_student;
 if p.institution_id is distinct from private.institution_id() or not private.can_module('etudiants') or not private.staff_campus(p.campus_id) then raise insufficient_privilege;end if;
 if _average is null or _average<0 or _average>20 or length(trim(_reference))<3 or length(trim(_serie))<1 or _year !~ '^\d{4}-\d{4}$' or jsonb_typeof(_scores)<>'object' or length(_scores::text)>20000 then raise exception 'Vérifiez la moyenne, la série et la référence du justificatif.';end if;
 if exists(select 1 from jsonb_each_text(_scores) s where s.value !~ '^[0-9]+(\.[0-9]+)?$' or case when s.value ~ '^[0-9]+(\.[0-9]+)?$' then s.value::numeric not between 0 and 20 else true end) then raise exception 'Les notes du bac doivent être comprises entre 0 et 20.';end if;
 if not exists(select 1 from public.user_roles where user_id=_student and role='user') then raise exception 'Élève introuvable.';end if;
 insert into public.bac_results(user_id,institution_id,academic_year,moyenne,serie,source,status,subject_scores,publication_reference,published_at,published_by,uploaded_by)
 values(_student,p.institution_id,_year,_average,trim(_serie),'institution','published',_scores,trim(_reference),now(),auth.uid(),auth.uid()::text) returning id into result;
 insert into public.notifications(user_id,institution_id,title,message,type) values(_student,p.institution_id,'Résultat du baccalauréat publié','Votre établissement a enregistré le résultat communiqué. Consultez votre espace Orientation pour préparer la suite de votre parcours.','info');return result;
end $$;
revoke all on function public.publish_student_bac(uuid,text,numeric,text,text,jsonb) from public;grant execute on function public.publish_student_bac(uuid,text,numeric,text,text,jsonb) to authenticated;
