-- Administrative module grants remain bounded by campus and academic scope.
create function private.staff_person_scope(_person uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.user_id=_person and p.institution_id=private.institution_id() and private.staff_campus(p.campus_id)
 and not exists(select 1 from public.team_members t where t.user_id=auth.uid() and t.institution_id=p.institution_id and coalesce(t.academic_scope,'all')<>'all'
 and not(case t.academic_scope when 'licence' then p.level in('L1','L2','L3') when 'master' then p.level in('M1','M2') when 'college' then p.level in('6e','5e','4e','3e') when 'lycee' then p.level in('2nde','1ère','Terminale') else false end)))
$$;
create function private.restricted_staff() returns boolean language sql stable security definer set search_path='' as $$
 select not private.is_admin() and exists(select 1 from public.team_members where user_id=auth.uid() and institution_id=private.institution_id() and not is_principal)
$$;
revoke all on function private.staff_person_scope(uuid),private.restricted_staff() from public;
grant execute on function private.staff_person_scope(uuid),private.restricted_staff() to authenticated;
do $$declare t text;begin
 foreach t in array array['profiles','grades','payments','attendance','student_years','grades_trimestre'] loop
  execute format('create policy staff_scope on public.%I as restrictive for all to authenticated using(not private.restricted_staff() or user_id=auth.uid() or private.staff_person_scope(user_id)) with check(not private.restricted_staff() or user_id=auth.uid() or private.staff_person_scope(user_id))',t);
 end loop;
 foreach t in array array['subjects','filieres','classes','schedule_events'] loop
  execute format('create policy staff_scope on public.%I as restrictive for all to authenticated using(not private.restricted_staff() or campus_id is null or private.staff_campus(campus_id)) with check(not private.restricted_staff() or campus_id is null or private.staff_campus(campus_id))',t);
 end loop;
end $$;
create or replace function private.protect_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or private.is_super() or private.is_admin() then return new;end if;
 if private.can_module('etudiants') and old.institution_id=private.institution_id() and exists(select 1 from public.user_roles where user_id=old.user_id and role='user') then
  if (to_jsonb(new)-array['first_name','last_name','phone','address','avatar_url','recovery_email','updated_at','level','filiere_id','classe_id','campus_id','statut_boursier']) is distinct from (to_jsonb(old)-array['first_name','last_name','phone','address','avatar_url','recovery_email','updated_at','level','filiere_id','classe_id','campus_id','statut_boursier']) then raise insufficient_privilege;end if;
  return new;
 end if;
 if old.user_id<>auth.uid() then raise insufficient_privilege;end if;
 if (to_jsonb(new)-array['first_name','last_name','phone','address','avatar_url','recovery_email','signature_url','updated_at']) is distinct from (to_jsonb(old)-array['first_name','last_name','phone','address','avatar_url','recovery_email','signature_url','updated_at']) then raise insufficient_privilege;end if;
 return new;
end $$;
