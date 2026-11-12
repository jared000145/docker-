import { readFile, writeFile } from 'node:fs/promises';
const tables = JSON.parse(await readFile('scripts/schema-contract.json', 'utf8'));
const modules = {
  etudiants: ['profiles','student_years','student_year_history','student_documents','enrollments','applications'],
  profs: ['professor_documents','professor_experiences','professor_history'],
  notes: ['grades','grades_trimestre','course_validation'],
  rattrapage: ['rattrapages'], presences: ['attendance','attendance_sessions'],
  paiements: ['payments','payment_installments','fee_types'],
  documents: ['library_books','library_settings','library_sync_logs'],
  parametres_academiques: ['classes','filieres','subjects','subject_classes','ues','ue_matieres','campuses','parametres_etablissement'],
  communaute: ['events','bde_posts','bde_members','notifications'],
  releves: ['releves_trimestre'], cloture: ['filiere_closures','trimestre_closures'],
  planning: ['schedule_events'], salles: ['classrooms'], soutenances: ['soutenances','soutenance_jury'],
  parents: ['parents'], equipe: ['team_members','roles','role_permissions','user_roles_v2'], audit: ['audit_logs'],
};
let sql = `create function private.can_module(module text) returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin() or exists(select 1 from public.team_members where user_id=auth.uid() and institution_id=private.institution_id() and module=any(allowed_modules))
$$;
create function private.same_institution(person uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where user_id=person and institution_id=private.institution_id())
$$;
grant execute on function private.can_module(text), private.same_institution(uuid) to authenticated;
`;
for (const [module, names] of Object.entries(modules)) for (const name of names) {
  const table = tables.find(t => t.name === name);
  if (!table) continue;
  let scope = table.columns.includes('institution_id') ? 'institution_id=private.institution_id()' : null;
  if (!scope && table.columns.includes('user_id')) scope = 'private.same_institution(user_id)';
  if (!scope && name === 'role_permissions') scope = 'exists(select 1 from public.roles r where r.id=role_id and r.institution_id=private.institution_id())';
  if (!scope) continue;
  // Access control itself can only be changed by principals.
  const condition = `${scope} and ${module === 'equipe' ? 'private.is_admin()' : `private.can_module('${module}')`}`;
  sql += `create policy module_access on public."${name}" for all to authenticated using (${condition}) with check (${condition});\n`;
}
sql += `
create policy staff_role_read on public.user_roles for select to authenticated using (private.is_admin() and private.same_institution(user_id));
create policy permissions_read on public.permissions for select to authenticated using (true);
create policy scoped_parent_links on public.parent_students for all to authenticated using (private.can_module('parents') and exists(select 1 from public.parents p where p.id=parent_id and p.institution_id=private.institution_id()))
with check (private.can_module('parents') and private.same_institution(student_user_id) and exists(select 1 from public.parents p where p.id=parent_id and p.institution_id=private.institution_id()));
create policy own_notification_update on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy tenant_admin on public.messages;
create policy own_messages_read on public.messages for select to authenticated using (sender_id=auth.uid() or recipient_id=auth.uid());
create policy own_messages_insert on public.messages for insert to authenticated with check (sender_id=auth.uid() and institution_id=private.institution_id() and private.same_institution(recipient_id));
create policy own_messages_update on public.messages for update to authenticated using (sender_id=auth.uid() or recipient_id=auth.uid()) with check (sender_id=auth.uid() or recipient_id=auth.uid());
create function private.protect_message() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.is_super() then return new; end if;
  if new.sender_id<>old.sender_id or new.recipient_id<>old.recipient_id or new.institution_id is distinct from old.institution_id then raise insufficient_privilege; end if;
  if auth.uid()=old.recipient_id and (to_jsonb(new)-array['is_read','read_at','delivered_at','viewed_at','deleted_for']) is distinct from (to_jsonb(old)-array['is_read','read_at','delivered_at','viewed_at','deleted_for']) then raise insufficient_privilege; end if;
  return new;
end $$;
create trigger protect_message before update on public.messages for each row execute function private.protect_message();
`;
await writeFile('supabase/migrations/202611080005_modules.sql', sql);
