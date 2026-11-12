insert into storage.buckets(id,name,public,file_size_limit) values
  ('avatars','avatars',true,5242880),
  ('student-documents','student-documents',false,26214400),
  ('professor-documents','professor-documents',false,26214400),
  ('chat-media','chat-media',false,26214400),
  ('signatures','signatures',false,5242880),
  ('bac-results','bac-results',false,26214400),
  ('justificatifs','justificatifs',false,26214400),
  ('pv-professeurs','pv-professeurs',false,26214400),
  ('releves-lycee','releves-lycee',false,26214400),
  ('preregistrations','preregistrations',false,26214400),
  ('backups','backups',false,104857600),
  ('event-media','event-media',false,26214400),
  ('media','media',false,26214400),
  ('stories','stories',false,26214400)
on conflict (id) do nothing;
create function private.path_owner(filename text) returns uuid language sql immutable set search_path = '' as $$
  select case when split_part(filename,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then split_part(filename,'/',1)::uuid else null end
$$;
revoke all on function private.path_owner(text) from public;
grant execute on function private.path_owner(text) to authenticated;
create policy storage_super on storage.objects for all to authenticated using (private.is_super()) with check (private.is_super());
create policy personal_storage_read on storage.objects for select to authenticated using (
  bucket_id in ('avatars','student-documents','professor-documents','signatures','bac-results','justificatifs','pv-professeurs','releves-lycee') and
  (private.can_read_student(private.path_owner(name)) or (private.is_admin() and private.same_institution(private.path_owner(name))))
);
create policy personal_storage_write on storage.objects for all to authenticated using (
  bucket_id in ('avatars','student-documents','professor-documents','signatures','bac-results','justificatifs','pv-professeurs','releves-lycee') and
  (private.path_owner(name)=auth.uid() or (private.is_admin() and private.same_institution(private.path_owner(name))))
) with check (
  bucket_id in ('avatars','student-documents','professor-documents','signatures','bac-results','justificatifs','pv-professeurs','releves-lycee') and
  (private.path_owner(name)=auth.uid() or (private.is_admin() and private.same_institution(private.path_owner(name))))
);
create policy chat_storage_read on storage.objects for select to authenticated using (bucket_id='chat-media' and (
  private.path_owner(name)=auth.uid() or (split_part(name,'/',2)=auth.uid()::text and private.same_institution(private.path_owner(name)))
));
create policy chat_storage_write on storage.objects for insert to authenticated with check (bucket_id='chat-media' and private.path_owner(name)=auth.uid());
create policy chat_storage_delete on storage.objects for delete to authenticated using (bucket_id='chat-media' and private.path_owner(name)=auth.uid());
revoke all on function private.can_module(text), private.same_institution(uuid) from public;
