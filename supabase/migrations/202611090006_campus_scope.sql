alter table public.classes add column campus_id uuid references public.campuses(id);
-- Campus assignments form an explicit scope; no fallback to an unrelated main campus.
create function private.staff_campus(_campus uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_admin() or exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.campus_id=_campus)
  or exists(select 1 from public.campus_staff s where s.user_id=auth.uid() and s.institution_id=private.institution_id() and s.campus_id=_campus)
  or (_campus is null and not exists(select 1 from public.campus_staff s where s.user_id=auth.uid()) and not exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.campus_id is not null))
$$;
create function private.director_module(_module text,_campus uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select private.subscription_active(private.institution_id()) and private.staff_campus(_campus) and private.can_module(_module)
$$;
revoke all on function private.staff_campus(uuid),private.director_module(text,uuid) from public;
grant execute on function private.staff_campus(uuid),private.director_module(text,uuid) to authenticated;
create policy scoped_campus_read on public.campuses for select to authenticated using(institution_id=private.institution_id() and private.staff_campus(id));
create policy own_campus_assignment on public.campus_staff for select to authenticated using(user_id=auth.uid() and institution_id=private.institution_id());
-- Read-only direction views, scoped to assigned campuses and student cycles.
create function private.director_student(_student uuid,_module text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.team_members t on t.user_id=auth.uid() and t.institution_id=p.institution_id
  where p.user_id=_student and p.institution_id=private.institution_id() and private.director_module(_module,p.campus_id)
  and (coalesce(t.academic_scope,'all')='all' or t.academic_scope='licence' and p.level in ('L1','L2','L3') or t.academic_scope='master' and p.level in ('M1','M2')
   or t.academic_scope='college' and p.level in ('6e','5e','4e','3e') or t.academic_scope='lycee' and p.level in ('2nde','1ère','Terminale')))
$$;
revoke all on function private.director_student(uuid,text) from public;
grant execute on function private.director_student(uuid,text) to authenticated;
create policy director_student_read on public.profiles for select to authenticated using(private.director_student(user_id,'director_dashboard') or private.director_student(user_id,'director_reports'));
create policy director_role_read on public.user_roles for select to authenticated using(private.director_student(user_id,'director_dashboard') or private.director_student(user_id,'director_reports'));
create policy director_grade_read on public.grades for select to authenticated using(institution_id=private.institution_id() and (private.director_student(user_id,'director_dashboard') or private.director_student(user_id,'director_reports')));
create policy director_payment_read on public.payments for select to authenticated using(institution_id=private.institution_id() and private.director_student(user_id,'director_finance'));

create function public.manage_campus(_institution uuid,_campus uuid default null,_data jsonb default '{}',_action text default 'save') returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; member uuid;
begin
 if not private.is_super() and not (private.is_admin() and private.institution_id()=_institution) then raise insufficient_privilege;end if;
 perform 1 from public.institutions where id=_institution for update;if not found then raise exception 'Établissement introuvable.';end if;
 if _campus is not null and not exists(select 1 from public.campuses where id=_campus and institution_id=_institution) then raise exception 'Campus étranger.';end if;
 if _action='assign' then
  member:=(_data->>'user_id')::uuid;
  if _campus is null or not exists(select 1 from public.team_members where user_id=member and institution_id=_institution) then raise exception 'Membre ou campus invalide.';end if;
  if not exists(select 1 from public.campus_staff where user_id=member and campus_id=_campus) then
   insert into public.campus_staff(user_id,campus_id,institution_id,role) values(member,_campus,_institution,'staff');
  end if;return _campus;
 elsif _action='unassign' then
  delete from public.campus_staff where campus_id=_campus and institution_id=_institution and user_id=(_data->>'user_id')::uuid;return _campus;
 elsif _action='archive' then
  if exists(select 1 from public.campuses where id=_campus and is_main) then raise exception 'Choisissez un autre campus principal avant archivage.';end if;
  update public.campuses set is_active=false,updated_at=now() where id=_campus;return _campus;
 elsif _action<>'save' then raise exception 'Action invalide.';end if;
 if length(trim(coalesce(_data->>'name','')))<2 or length(_data->>'name')>160 or coalesce(_data->>'cycle','lmd') not in ('lmd','bts') then raise exception 'Nom ou cycle invalide.';end if;
 if coalesce((_data->>'is_main')::boolean,false) then update public.campuses set is_main=false where institution_id=_institution and id is distinct from _campus;end if;
 result:=coalesce(_campus,gen_random_uuid());
 insert into public.campuses(id,institution_id,name,city,address,phone,email,cycle,is_active,is_main)
 values(result,_institution,trim(_data->>'name'),nullif(_data->>'city',''),nullif(_data->>'address',''),nullif(_data->>'phone',''),nullif(_data->>'email',''),coalesce(_data->>'cycle','lmd'),coalesce((_data->>'is_active')::boolean,true),coalesce((_data->>'is_main')::boolean,false))
 on conflict(id) do update set name=excluded.name,city=excluded.city,address=excluded.address,phone=excluded.phone,email=excluded.email,cycle=excluded.cycle,is_active=excluded.is_active,is_main=excluded.is_main,updated_at=now();
 return result;
end $$;
revoke all on function public.manage_campus(uuid,uuid,jsonb,text) from public;
grant execute on function public.manage_campus(uuid,uuid,jsonb,text) to authenticated;
