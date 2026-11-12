-- Identity-based assignment and secure PV delivery to the corresponding subject.
alter table public.subjects add column professor_user_id uuid references auth.users(id);
create function private.resolve_subject_professor() returns trigger language plpgsql security definer set search_path='' as $$
declare candidate uuid;
begin
 if new.professor_user_id is not null then
  if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.user_id and r.role='professor' where p.user_id=new.professor_user_id and p.institution_id=new.institution_id) then raise exception 'Professeur étranger à l’établissement.';end if;
 elsif nullif(trim(new.professor),'') is not null then
  select min(p.user_id::text)::uuid into candidate from public.profiles p join public.user_roles r on r.user_id=p.user_id and r.role='professor'
   where p.institution_id=new.institution_id and lower(trim(p.first_name||' '||p.last_name))=lower(trim(new.professor)) having count(*)=1;
  new.professor_user_id:=candidate;
 end if;return new;
end $$;
create trigger resolve_subject_professor before insert or update of professor,professor_user_id,institution_id on public.subjects for each row execute function private.resolve_subject_professor();
update public.subjects set professor=professor where professor is not null;
create function public.professor_set_pv(_subject_id uuid,_pv_url text,_academic_year text default null,_semester text default null) returns void language plpgsql security definer set search_path='' as $$
declare s public.subjects;
begin
 select * into s from public.subjects where id=_subject_id for update;
 if s.id is null or s.professor_user_id is distinct from auth.uid() or s.institution_id is distinct from private.institution_id()
  or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professor') then raise insufficient_privilege;end if;
 if split_part(_pv_url,'/',1)<>auth.uid()::text or split_part(_pv_url,'/',2)<>_subject_id::text
  or not exists(select 1 from storage.objects where bucket_id='pv-professeurs' and name=_pv_url) then raise exception 'Fichier PV absent ou non autorisé.';end if;
 if _academic_year is distinct from (select academic_year from public.institutions where id=s.institution_id) then raise exception 'Utiliser l’année active.';end if;
 update public.subjects set pv_url=_pv_url,pv_uploaded_at=now()::text,pv_uploaded_by=auth.uid()::text,pv_academic_year=_academic_year,pv_semester=s.semester where id=s.id;
end $$;
revoke all on function public.professor_set_pv(uuid,text,text,text) from public;
grant execute on function public.professor_set_pv(uuid,text,text,text) to authenticated;
create policy pv_staff_read on storage.objects for select to authenticated using(bucket_id='pv-professeurs' and exists(
 select 1 from public.subjects s where s.pv_url=name and s.institution_id=private.institution_id() and private.can_module('notes')
));
