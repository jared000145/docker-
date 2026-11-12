-- Explicit cross-campus scope never grants additional business modules.
create table public.campus_access_grants (
 user_id uuid primary key references auth.users(id) on delete cascade,
 institution_id uuid not null references public.institutions(id),
 granted_by uuid not null, created_at timestamptz not null default now()
);
alter table public.campus_access_grants enable row level security;
grant select on public.campus_access_grants to authenticated;
grant all on public.campus_access_grants to service_role;
create policy read_scope on public.campus_access_grants for select to authenticated using(user_id=auth.uid() or private.is_super() or institution_id=private.institution_id() and private.is_admin());
create function private.all_campuses() returns boolean language sql stable security definer set search_path='' as $$
 select private.is_admin() or exists(select 1 from public.campus_access_grants where user_id=auth.uid() and institution_id=private.institution_id())
$$;
create or replace function private.staff_campus(_campus uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.all_campuses() or exists(select 1 from public.profiles where user_id=auth.uid() and campus_id=_campus)
 or exists(select 1 from public.campus_staff where user_id=auth.uid() and institution_id=private.institution_id() and campus_id=_campus)
 or (_campus is null and not exists(select 1 from public.campuses where institution_id=private.institution_id() and is_active))
$$;
create function public.my_campus_scope() returns boolean language sql stable security definer set search_path='' as $$select private.all_campuses()$$;
create function public.set_campus_scope(_user uuid,_all boolean) returns void language plpgsql security definer set search_path='' as $$
declare tenant uuid;
begin
 select institution_id into tenant from public.team_members where user_id=_user;
 if tenant is null or not(private.is_super() or private.is_admin() and tenant=private.institution_id()) then raise insufficient_privilege;end if;
 if _all then insert into public.campus_access_grants(user_id,institution_id,granted_by) values(_user,tenant,auth.uid()) on conflict(user_id) do nothing;
 else delete from public.campus_access_grants where user_id=_user and institution_id=tenant;end if;
 insert into public.audit_logs(institution_id,user_id,action,categorie,description,record_id) values(tenant,auth.uid(),'campus_scope','permissions',case when _all then 'Accès à tous les campus accordé' else 'Accès à tous les campus retiré' end,_user);
end $$;
revoke all on function private.all_campuses(),public.my_campus_scope(),public.set_campus_scope(uuid,boolean) from public;
grant execute on function private.all_campuses(),public.my_campus_scope(),public.set_campus_scope(uuid,boolean) to authenticated;

create table public.campus_expenses(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),
 campus_id uuid not null references public.campuses(id),academic_year text not null,
 amount numeric(14,2) not null check(amount>0),label text not null check(length(trim(label)) between 2 and 200),
 expense_date date not null default current_date,created_by uuid not null default auth.uid(),created_at timestamptz not null default now()
);
alter table public.campus_expenses enable row level security;
grant select,insert on public.campus_expenses to authenticated;grant all on public.campus_expenses to service_role;
create policy expense_read on public.campus_expenses for select to authenticated using(private.is_super() or institution_id=private.institution_id() and private.staff_campus(campus_id) and (private.can_module('paiements') or private.can_module('director_finance')));
create policy expense_insert on public.campus_expenses for insert to authenticated with check(institution_id=private.institution_id() and private.staff_campus(campus_id) and private.can_module('paiements') and created_by=auth.uid() and exists(select 1 from public.campuses c where c.id=campus_id and c.institution_id=private.institution_id()));
create function public.campus_overview(_year text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; finance boolean:=private.can_module('paiements') or private.can_module('director_finance');
begin
 if not(private.can_module('etudiants') or private.can_module('director_dashboard') or finance) then raise insufficient_privilege;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'students',(select count(distinct p.user_id) from public.profiles p join public.student_years y on y.user_id=p.user_id and y.institution_id=p.institution_id where p.institution_id=c.institution_id and coalesce(y.campus_id,p.campus_id)=c.id and y.academic_year=_year and y.enrollment_status='active'),
 'received',case when finance then (select coalesce(sum(paid_amount),0) from public.payments where institution_id=c.institution_id and campus_id=c.id and academic_year=_year) else null end,
 'expenses',case when finance then (select coalesce(sum(amount),0) from public.campus_expenses where institution_id=c.institution_id and campus_id=c.id and academic_year=_year) else null end) order by c.name),'[]') into result
 from public.campuses c where c.institution_id=private.institution_id() and c.is_active and private.staff_campus(c.id);
 return result;
end $$;

-- Annual registration owns its class, campus and attempt. Old years are never overwritten.
alter table public.student_years add column campus_id uuid references public.campuses(id),add column classe_id uuid references public.classes(id),add column progression text not null default 'initial' check(progression in('initial','promotion','repeat','transfer')),add column previous_year_id uuid references public.student_years(id);
update public.student_years y set campus_id=p.campus_id,classe_id=p.classe_id from public.profiles p where p.user_id=y.user_id and p.institution_id=y.institution_id and p.academic_year=y.academic_year;
create function public.advance_student(_student uuid,_from text,_to text,_level text,_class uuid default null,_campus uuid default null,_repeat boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.profiles; previous public.student_years; result uuid; class_campus uuid; year_start integer;
begin
 select * into p from public.profiles where user_id=_student for update;
 if not found or p.institution_id is distinct from private.institution_id() or not private.can_module('etudiants') or not private.staff_campus(p.campus_id) then raise insufficient_privilege;end if;
 if _from !~ '^\d{4}-\d{4}$' or _to !~ '^\d{4}-\d{4}$' or split_part(_to,'-',1)::int<>split_part(_from,'-',1)::int+1 or split_part(_to,'-',2)::int<>split_part(_to,'-',1)::int+1 then raise exception 'Choisissez deux années consécutives.';end if;
 if not exists(select 1 from public.user_roles where user_id=_student and role='user') then raise exception 'Élève introuvable.';end if;
 select * into previous from public.student_years where user_id=_student and institution_id=p.institution_id and academic_year=_from order by created_at desc limit 1;
 if previous.id is null or previous.enrollment_status in('expelled','dropped') then raise exception 'Inscription source absente ou inactive.';end if;
 if exists(select 1 from public.student_years where user_id=_student and institution_id=p.institution_id and academic_year=_to) then raise exception 'Une inscription existe déjà pour cette année.';end if;
 if length(trim(_level))<1 or (_repeat and _level<>previous.niveau) then raise exception 'Un redoublement conserve le même niveau.';end if;
 if _campus is not null and not exists(select 1 from public.campuses where id=_campus and institution_id=p.institution_id and is_active and private.staff_campus(id)) then raise exception 'Campus inaccessible.';end if;
 if _class is not null then
  select campus_id into class_campus from public.classes where id=_class and institution_id=p.institution_id and academic_year=_to and niveau=_level;
  if not found or class_campus is distinct from _campus then raise exception 'Classe incompatible avec cette année, ce niveau ou ce campus.';end if;
 end if;
 insert into public.student_years(user_id,institution_id,academic_year,niveau,filiere_id,campus_id,classe_id,enrollment_status,can_access,status,progression,previous_year_id)
 values(_student,p.institution_id,_to,_level,p.filiere_id,_campus,_class,'active',true,'active',case when _repeat then 'repeat' else 'promotion' end,previous.id) returning id into result;
 if not exists(select 1 from public.student_year_history where user_id=_student and academic_year=_to) then
 insert into public.student_year_history(user_id,academic_year,level,filiere_id,status,decision) values(_student,_to,_level,p.filiere_id,case when _repeat then 'redoublement' else 'in_progress' end,case when _repeat then 'Réinscription au même niveau' else 'Passage au niveau suivant' end);end if;
 update public.profiles set academic_year=_to,level=_level,classe_id=_class,campus_id=_campus where user_id=_student;
 insert into public.audit_logs(institution_id,user_id,action,categorie,record_id,description) values(p.institution_id,auth.uid(),'annual_registration','scolarite',_student,_from||' → '||_to||case when _repeat then ' · redoublement' else ' · passage' end);
 return result;
end $$;
revoke all on function public.campus_overview(text),public.advance_student(uuid,text,text,text,uuid,uuid,boolean) from public;
grant execute on function public.campus_overview(text),public.advance_student(uuid,text,text,text,uuid,uuid,boolean) to authenticated;
