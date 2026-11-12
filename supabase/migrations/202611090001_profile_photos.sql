-- Prepared locally. Apply only after staging verification and owner approval.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-photos','profile-photos',false,2097152,array['image/webp','image/png'])
on conflict(id) do nothing;
create policy profile_photos_read on storage.objects for select to authenticated using (
 bucket_id='profile-photos' and (private.path_owner(name)=auth.uid() or private.same_institution(private.path_owner(name)) or private.can_read_student(private.path_owner(name)))
);
create policy profile_photos_insert on storage.objects for insert to authenticated with check (
 bucket_id='profile-photos' and private.path_owner(name)=auth.uid()
);
create policy profile_photos_update on storage.objects for update to authenticated using (
 bucket_id='profile-photos' and private.path_owner(name)=auth.uid()
) with check (bucket_id='profile-photos' and private.path_owner(name)=auth.uid());
create policy profile_photos_delete on storage.objects for delete to authenticated using (
 bucket_id='profile-photos' and private.path_owner(name)=auth.uid()
);
