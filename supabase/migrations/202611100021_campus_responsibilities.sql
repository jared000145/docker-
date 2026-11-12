create function public.configure_campus_responsibility(_user uuid,_global boolean,_finance boolean) returns void language plpgsql security definer set search_path='' as $$
declare t public.team_members; modules text[];
begin
 select * into t from public.team_members where user_id=_user for update;
 if t.user_id is null or t.is_principal or not(private.is_super() or private.is_admin() and t.institution_id=private.institution_id()) then raise insufficient_privilege;end if;
 perform public.set_campus_scope(_user,_global);
 select array_agg(distinct m) into modules from unnest(coalesce(t.allowed_modules,'{}')||array['director_dashboard','communaute']) m where m<>'director_finance';
 if _finance then modules:=modules||array['director_finance'];end if;
 update public.team_members set allowed_modules=modules where user_id=_user;
 insert into public.audit_logs(institution_id,user_id,action,categorie,description,record_id) values(t.institution_id,auth.uid(),'campus_responsibility','permissions',case when _global then 'Direction globale' else 'Gestion des campus affectés' end||case when _finance then ' avec synthèse financière' else ' sans ajout de synthèse financière' end,_user);
end $$;
revoke all on function public.configure_campus_responsibility(uuid,boolean,boolean) from public;
grant execute on function public.configure_campus_responsibility(uuid,boolean,boolean) to authenticated;

-- Staff-to-staff communication does not confer access to another campus's pupils.
create function private.intercampus_colleague(_person uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_roles s where s.user_id=auth.uid() and s.role='admin')
 and exists(select 1 from public.user_roles r join public.profiles p on p.user_id=r.user_id where r.user_id=_person and r.role='admin' and p.institution_id=private.institution_id());
$$;
create or replace function private.contact_allowed(_person uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.user_id=_person and p.institution_id=private.institution_id() and
 (private.intercampus_colleague(_person) or private.all_campuses() or private.staff_campus(p.campus_id) or exists(select 1 from public.campus_staff s where s.user_id=p.user_id and private.staff_campus(s.campus_id)) or
 exists(select 1 from public.user_roles r where r.user_id=p.user_id and r.role='admin' and not exists(select 1 from public.team_members t where t.user_id=p.user_id and not t.is_principal))))
$$;
create or replace function public.contact_directory(_search text default '',_campus uuid default null,_person uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(d)),'[]') from(select p.user_id,p.first_name,p.last_name,p.avatar_url,p.student_number,p.department,p.campus_id,p.filiere_id,p.level,c.name as campus_name,
 private.intercampus_colleague(p.user_id) as is_colleague,
 exists(select 1 from public.user_roles r where r.user_id=p.user_id and r.role='user') as is_student
 from public.profiles p left join public.campuses c on c.id=p.campus_id where p.institution_id=private.institution_id() and p.user_id<>auth.uid() and private.contact_allowed(p.user_id)
 and (_campus is null or p.campus_id=_campus or p.campus_id is null or private.intercampus_colleague(p.user_id)) and (_person is null or p.user_id=_person)
 and (length(trim(_search))=0 or p.first_name||' '||p.last_name||' '||coalesce(p.student_number,'')||' '||coalesce(c.name,'') ilike '%'||left(trim(_search),100)||'%') order by p.last_name,p.first_name limit 100)d
$$;
revoke all on function private.intercampus_colleague(uuid) from public;
