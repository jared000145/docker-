-- Tenant-bound community and student association data.
alter table public.bde_members add column institution_id uuid references public.institutions(id);
alter table public.bde_posts add column institution_id uuid references public.institutions(id);
update public.bde_members m set institution_id=p.institution_id from public.profiles p where p.user_id=m.user_id;
update public.bde_posts m set institution_id=p.institution_id from public.profiles p where p.user_id=m.author_id;
create function private.community_references() returns trigger language plpgsql security definer set search_path='' as $$
declare tenant uuid; parent_tenant uuid; data jsonb:=to_jsonb(new); person uuid;
begin
 person:=nullif(coalesce(data->>'author_id',data->>'user_id'),'')::uuid;
 select institution_id into tenant from public.profiles where user_id=person;
 if tenant is null then raise exception 'Compte sans établissement.';end if;
 if data?'post_id' then
  select institution_id into parent_tenant from public.community_posts where id=(data->>'post_id')::uuid;
  if parent_tenant is distinct from tenant then raise exception 'Publication étrangère à l’établissement.';end if;
 end if;
 if data?'comment_id' then
  select institution_id into parent_tenant from public.community_comments where id=(data->>'comment_id')::uuid;
  if parent_tenant is distinct from tenant then raise exception 'Commentaire étranger à l’établissement.';end if;
 end if;
 if data->>'institution_id' is not null and (data->>'institution_id')::uuid<>tenant then raise exception 'Établissement incohérent.';end if;
 new.institution_id:=tenant;
 if tg_op='UPDATE' and (to_jsonb(new)->>'institution_id' is distinct from to_jsonb(old)->>'institution_id' or coalesce(to_jsonb(new)->>'author_id',to_jsonb(new)->>'user_id') is distinct from coalesce(to_jsonb(old)->>'author_id',to_jsonb(old)->>'user_id')) then raise insufficient_privilege;end if;
 return new;
end $$;
do $$declare t text;begin
 foreach t in array array['community_posts','community_comments','community_likes','community_reactions','community_bookmarks','community_comment_likes','bde_members','bde_posts'] loop
  execute format('create trigger community_references before insert or update on public.%I for each row execute function private.community_references()',t);
 end loop;
end $$;
create policy author_write on public.community_posts for all to authenticated using(author_id=auth.uid() and institution_id=private.institution_id()) with check(author_id=auth.uid() and institution_id=private.institution_id());
create policy comments_read on public.community_comments for select to authenticated using(institution_id=private.institution_id());
create policy comment_author on public.community_comments for all to authenticated using(author_id=auth.uid() and institution_id=private.institution_id()) with check(author_id=auth.uid() and institution_id=private.institution_id());
create policy likes_read on public.community_likes for select to authenticated using(institution_id=private.institution_id());
create policy reactions_read on public.community_reactions for select to authenticated using(institution_id=private.institution_id());
create policy comment_likes_read on public.community_comment_likes for select to authenticated using(institution_id=private.institution_id());
do $$declare t text;begin
 foreach t in array array['community_comments','community_likes','community_reactions','community_bookmarks'] loop
  execute format('create policy post_author_cleanup on public.%I for delete to authenticated using(exists(select 1 from public.community_posts p where p.id=post_id and p.author_id=auth.uid() and p.institution_id=private.institution_id()))',t);
 end loop;
end $$;
create policy bde_members_read on public.bde_members for select to authenticated using(institution_id=private.institution_id());
create policy bde_posts_read on public.bde_posts for select to authenticated using(institution_id=private.institution_id());
create policy bde_members_manage on public.bde_members for all to authenticated using(institution_id=private.institution_id() and private.can_module('communaute')) with check(institution_id=private.institution_id() and private.can_module('communaute'));
create policy bde_posts_manage on public.bde_posts for all to authenticated using(institution_id=private.institution_id() and private.can_module('communaute')) with check(institution_id=private.institution_id() and private.can_module('communaute'));
create function public.community_directory() returns table(user_id uuid,first_name text,last_name text,avatar_url text,level text,filiere_id uuid,institution_id uuid) language sql stable security definer set search_path='' as $$
 select p.user_id,p.first_name,p.last_name,p.avatar_url,p.level,p.filiere_id,p.institution_id from public.profiles p where p.institution_id=private.institution_id() and private.subscription_active(p.institution_id) order by p.last_name,p.first_name limit 2000
$$;
revoke all on function public.community_directory() from public;
grant execute on function public.community_directory() to authenticated;
create policy peer_student_role on public.user_roles for select to authenticated using(role='user' and private.same_institution(user_id));
create policy media_owner on storage.objects for all to authenticated using(bucket_id in('media','stories','event-media') and private.path_owner(name)=auth.uid()) with check(bucket_id in('media','stories','event-media') and private.path_owner(name)=auth.uid());
create policy media_tenant_read on storage.objects for select to authenticated using(bucket_id in('media','stories','event-media') and private.same_institution(private.path_owner(name)));
