-- Keep permission grants identical on the server and in navigation.
create function private.module_permission_keys(_module text) returns text[] language sql immutable set search_path='' as $$
 select case _module
 when 'etudiants' then array['manage_etudiants'] when 'profs' then array['manage_profs'] when 'notes' then array['manage_notes']
 when 'rattrapage' then array['manage_rattrapages'] when 'presences' then array['manage_presences'] when 'paiements' then array['manage_paiements']
 when 'documents' then array['manage_documents'] when 'parametres_academiques' then array['manage_academic_settings'] when 'communaute' then array['manage_evenements']
 when 'releves' then array['validate_releve'] when 'cloture' then array['validate_releve'] when 'bulletins' then array['validate_bulletin']
 when 'planning' then array['manage_planning'] when 'salles' then array['manage_salles'] when 'soutenances' then array['manage_soutenances']
 when 'parents' then array['manage_parents'] when 'equipe' then array['manage_team'] when 'audit' then array['view_audit'] when 'exclusions' then array['manage_exclusions']
 when 'director_dashboard' then array['view_director_dashboard'] when 'director_documents' then array['view_pedagogique_validation','view_cycle_validation']
 when 'director_reports' then array['view_director_reports'] when 'director_finance' then array['view_director_finance'] when 'director_signature' then array['manage_signature'] else array[]::text[] end
$$;
create or replace function private.can_module(module text) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_admin() or exists(select 1 from public.team_members where user_id=auth.uid() and institution_id=private.institution_id() and module=any(allowed_modules))
 or exists(select 1 from public.user_roles_v2 ur join public.roles r on r.id=ur.role_id and r.institution_id=ur.institution_id join public.role_permissions rp on rp.role_id=r.id join public.permissions p on p.id=rp.permission_id
  where ur.user_id=auth.uid() and ur.institution_id=private.institution_id() and p.key=any(private.module_permission_keys(module)))
$$;
revoke all on function private.module_permission_keys(text) from public;
drop policy tenant_read on public.campuses;
-- Parent links are validated even when posted directly to the API.
create function private.check_parent_link() returns trigger language plpgsql security definer set search_path='' as $$
declare institution uuid;
begin
 select institution_id into institution from public.parents where id=new.parent_id;
 if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.user_id and r.role='user' where p.user_id=new.student_user_id and p.institution_id=institution) then raise exception 'Enfant étranger ou non étudiant.';end if;
 if exists(select 1 from public.parent_students where parent_id=new.parent_id and student_user_id=new.student_user_id and id<>new.id) then raise exception 'Cet enfant est déjà lié à ce parent.';end if;
 return new;
end $$;
create trigger check_parent_link before insert or update on public.parent_students for each row execute function private.check_parent_link();
-- Do not cancel financial obligations silently when excluding a student.
create function public.exclude_student(_user_id uuid,_reason text,_exit_type text,_academic_year text) returns void language plpgsql security definer set search_path='' as $$
declare institution uuid;
begin
 select institution_id into institution from public.profiles where user_id=_user_id;
 if not private.is_super() and not(institution=private.institution_id() and private.can_module('exclusions')) then raise insufficient_privilege;end if;
 if length(trim(_reason))<3 then raise exception 'Motif obligatoire.';end if;
 update public.student_years set enrollment_status=case when _exit_type='abandon' then 'dropped' else 'expelled' end,can_access=false,exit_type=_exit_type,exit_date=now()::text,exit_decided_by=auth.uid()::text,block_reason=_reason,debt_frozen=true,updated_at=now()
 where user_id=_user_id and institution_id=institution and academic_year=_academic_year;
 if not found then raise exception 'Inscription annuelle introuvable.';end if;
end $$;
create function public.freeze_student_debt(_user_id uuid,_reason text,_exit_type text,_academic_year text) returns void language plpgsql security definer set search_path='' as $$
declare institution uuid;
begin
 select institution_id into institution from public.profiles where user_id=_user_id;
 if not private.is_super() and not(institution=private.institution_id() and private.can_module('exclusions')) then raise insufficient_privilege;end if;
 if length(trim(_reason))<3 then raise exception 'Motif obligatoire.';end if;
 update public.student_years set debt_frozen=true,block_reason=_reason,updated_at=now() where user_id=_user_id and institution_id=institution and academic_year=_academic_year;
 if not found then raise exception 'Inscription annuelle introuvable.';end if;
end $$;
create function public.reactivate_student(_student_year_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare institution uuid;
begin
 select institution_id into institution from public.student_years where id=_student_year_id;
 if not private.is_super() and not(institution=private.institution_id() and private.can_module('exclusions')) then raise insufficient_privilege;end if;
 update public.student_years set enrollment_status='active',can_access=true,debt_frozen=false,exit_type=null,exit_date=null,exit_decided_by=null,block_reason=null,updated_at=now() where id=_student_year_id;
end $$;
revoke all on function public.exclude_student(uuid,text,text,text),public.freeze_student_debt(uuid,text,text,text),public.reactivate_student(uuid) from public;
grant execute on function public.exclude_student(uuid,text,text,text),public.freeze_student_debt(uuid,text,text,text),public.reactivate_student(uuid) to authenticated;
