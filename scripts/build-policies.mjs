import { readFile, writeFile } from 'node:fs/promises';
const tables = JSON.parse(await readFile('scripts/schema-contract.json', 'utf8'));
let sql = `-- Conservative tenant isolation; unknown tables remain super-admin only.
create schema if not exists private;
grant usage on schema private to authenticated;
create function private.institution_id() returns uuid language sql stable security definer set search_path = '' as $$
  select institution_id from public.profiles where user_id = auth.uid() limit 1
$$;
create function private.is_super() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'super_admin')
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_super() or (exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
    and not exists(select 1 from public.team_members where user_id = auth.uid() and not is_principal))
$$;
create function private.can_read_student(student uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select student = auth.uid() or private.is_super() or exists (
    select 1 from public.parent_students l join public.parents p on p.id = l.parent_id
    join public.profiles child on child.user_id = l.student_user_id
    where l.student_user_id = student and p.user_id = auth.uid() and p.institution_id = child.institution_id
  )
$$;
revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
`;
const shared = new Set(['filieres','classes','subjects','subject_classes','ues','ue_matieres','campuses','classrooms','schedule_events','events','library_books','library_settings','fee_types','parametres_etablissement','video_conferences','bde_posts','bde_members','community_posts','stories']);
const selfWrite = new Set(['community_posts','community_comments','community_likes','community_reactions','community_bookmarks','community_comment_likes','library_annotations','library_bookmarks','library_favorites','library_reading_history','event_comments','event_likes','event_registrations','story_likes','story_replies','story_views','push_subscriptions']);
const restricted = new Set(['user_roles','user_roles_v2','roles','role_permissions','permissions','team_members','institutions','institution_subscriptions','audit_logs','backups_history','backup_logs']);
for (const {name, columns} of tables) {
  sql += `grant select, insert, update, delete on public."${name}" to authenticated;\n`;
  sql += `create policy super_access on public."${name}" for all to authenticated using (private.is_super()) with check (private.is_super());\n`;
  if (name === 'institutions') {
    sql += `create policy institution_read on public.institutions for select to authenticated using (id = private.institution_id());\n`;
    continue;
  }
  if (columns.includes('institution_id') && !restricted.has(name)) sql += `create policy tenant_admin on public."${name}" for all to authenticated using (private.is_admin() and institution_id = private.institution_id()) with check (private.is_admin() and institution_id = private.institution_id());\n`;
  const owner = columns.includes('student_user_id') ? 'student_user_id' : columns.includes('student_id') ? 'student_id' : columns.includes('user_id') ? 'user_id' : null;
  if (owner) sql += `create policy owner_read on public."${name}" for select to authenticated using (private.can_read_student("${owner}"));\n`;
  if (shared.has(name) && columns.includes('institution_id')) sql += `create policy tenant_read on public."${name}" for select to authenticated using (institution_id = private.institution_id());\n`;
  if (selfWrite.has(name) && owner) sql += `create policy owner_write on public."${name}" for all to authenticated using ("${owner}" = auth.uid()) with check ("${owner}" = auth.uid()${columns.includes('institution_id') ? ' and institution_id = private.institution_id()' : ''});\n`;
}
sql += `
-- A user may edit only personal contact fields, never their institution or role.
revoke update on public.profiles from authenticated;
grant update (first_name, last_name, phone, address, avatar_url, recovery_email, signature_url) on public.profiles to authenticated;
create policy own_profile_update on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy parent_links_read on public.parent_students for select to authenticated using (exists(select 1 from public.parents p where p.id = parent_id and p.user_id = auth.uid()));
create policy principal_team_read on public.team_members for select to authenticated using (private.is_admin() and institution_id = private.institution_id());
create policy subscription_read on public.institution_subscriptions for select to authenticated using (institution_id = private.institution_id());
alter table public.profiles add constraint profiles_auth_user foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.user_roles add constraint user_roles_auth_user foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.user_roles add unique (user_id, role);
alter table public.profiles alter column first_name set default '';
alter table public.profiles alter column last_name set default '';
alter table public.team_members alter column academic_scope set default 'all';
alter table public.student_years alter column can_access set default true;
alter table public.student_years alter column status set default 'active';
alter table public.student_years alter column enrollment_status set default 'enrolled';
alter table public.institutions alter column cycle set default 'universite';
alter table public.institutions alter column institution_type set default 'universite';
alter table public.institutions alter column enabled_cycles set default '{universite}';
alter table public.institutions alter column pass_threshold set default 10;
alter table public.institutions alter column credits_total_annee set default 60;
alter table public.institutions alter column credits_min_passage set default 30;
alter table public.institutions alter column credits_max_passage set default 60;
alter table public.institutions alter column academic_year set default '2026-2027';
alter table public.institutions alter column is_active set default true;
create unique index institutions_slug_unique on public.institutions (slug) where slug is not null;
create function private.on_account_created() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id,email,first_name,last_name) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'first_name',''),coalesce(new.raw_user_meta_data->>'last_name',''));
  insert into public.user_roles(user_id,role) values(new.id,'user');
  return new;
end $$;
create trigger account_created after insert on auth.users for each row execute function private.on_account_created();
`;
await writeFile('supabase/migrations/202611080002_access.sql', sql);
