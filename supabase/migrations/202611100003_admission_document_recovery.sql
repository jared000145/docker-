alter table public.admission_files add column bucket text not null default 'admission-files' check(bucket in('admission-files','student-documents','bac-results'));
create function public.recover_admission_documents() returns integer language plpgsql security definer set search_path='' as $$
declare d record; k text; added integer:=0; p public.profiles;
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 select * into p from public.profiles where user_id=auth.uid();
 for d in select distinct on(doc_type) * from public.student_documents where user_id=auth.uid() and (doc_type in('bac_diploma','bac_transcript') or doc_type in('bulletin','releve','terminal_transcript') and academic_year=p.academic_year and p.level ilike '%terminal%') order by doc_type,created_at desc loop
  k:=case when d.doc_type in('bulletin','releve') then 'terminal_transcript' else d.doc_type end;
  if exists(select 1 from public.admission_files where user_id=auth.uid() and kind=k) then continue;end if;
  if private.path_owner(d.file_url)=auth.uid() and exists(select 1 from storage.objects where bucket_id='student-documents' and name=d.file_url) then
   insert into public.admission_files(user_id,kind,path,file_name,bucket) values(auth.uid(),k,d.file_url,d.title,'student-documents') on conflict(path) do nothing;
   if found then added:=added+1;end if;
  end if;
 end loop;return added;
end $$;
create policy admission_source_read on storage.objects for select to authenticated using(bucket_id in('student-documents','bac-results') and exists(select 1 from public.admission_files f join public.applications a on a.user_id=f.user_id where f.bucket=bucket_id and f.path=name and a.dossier->'file_ids' ? f.id::text and private.admission_staff(a.target_institution_id,a.campus_id)));
-- A shared original must remain available exactly as submitted, even if its owner edits their dossier later.
create policy admission_source_immutable_update on storage.objects as restrictive for update to authenticated using(not exists(select 1 from public.admission_files f where f.bucket=bucket_id and f.path=name)) with check(not exists(select 1 from public.admission_files f where f.bucket=bucket_id and f.path=name));
create policy admission_source_immutable_delete on storage.objects as restrictive for delete to authenticated using(not exists(select 1 from public.admission_files f where f.bucket=bucket_id and f.path=name));
revoke all on function public.recover_admission_documents() from public;grant execute on function public.recover_admission_documents() to authenticated;
